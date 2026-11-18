-- LexAmah update for projects that already have the account/security setup.
-- Re-running preserves settings, assistants, posts and uploads.
begin;

create table if not exists public.lexamah_content_assistants (
 user_id uuid primary key references auth.users(id) on delete cascade,
 appointed_at timestamptz not null default now()
);
alter table public.lexamah_content_assistants enable row level security;
revoke all on public.lexamah_content_assistants from public,anon,authenticated;

-- Assistants never become members of lexamah_admins. The existing two-session
-- limit is shared, with at most one assistant seat so the main admin has room.
create or replace function public.lexamah_assistant_member()
returns boolean language sql stable security definer set search_path=''
as $$
 select public.lexamah_account_active() and exists (
  select 1 from public.lexamah_content_assistants a join auth.users u on u.id=a.user_id
  where a.user_id=auth.uid() and u.email_confirmed_at is not null
 );
$$;
revoke all on function public.lexamah_assistant_member() from public,anon,authenticated;

create or replace function public.lexamah_claim_assistant_session()
returns boolean language plpgsql security definer set search_path=''
as $$ declare sid uuid:=nullif(auth.jwt()->>'session_id','')::uuid; begin
 if sid is null or not public.lexamah_assistant_member()
  or not exists(select 1 from auth.sessions where id=sid and user_id=auth.uid()) then return false; end if;
 perform pg_advisory_xact_lock(847361029);
 if not public.lexamah_assistant_member() then return false; end if;
 delete from public.lexamah_admin_sessions a
  where a.expires_at<=now()
   or not exists(select 1 from auth.sessions s where s.id=a.session_id and s.user_id=a.user_id)
   or (not exists(select 1 from public.lexamah_admins m where m.user_id=a.user_id)
       and not exists(select 1 from public.lexamah_content_assistants c where c.user_id=a.user_id));
 if exists(select 1 from public.lexamah_admin_sessions where session_id=sid and user_id=auth.uid()) then
  update public.lexamah_admin_sessions set expires_at=now()+interval '3 minutes' where session_id=sid;
  return true;
 end if;
 if (select count(*) from public.lexamah_admin_sessions)>=2
  or exists(select 1 from public.lexamah_admin_sessions a
   where not exists(select 1 from public.lexamah_admins m where m.user_id=a.user_id)) then return false; end if;
 insert into public.lexamah_admin_sessions(session_id,user_id,expires_at) values(sid,auth.uid(),now()+interval '3 minutes');
 return true;
end; $$;
revoke all on function public.lexamah_claim_assistant_session() from public,anon,authenticated;

create or replace function public.lexamah_is_content_assistant()
returns boolean language sql stable security definer set search_path=''
as $$
 select public.lexamah_assistant_member() and exists (
  select 1 from public.lexamah_admin_sessions a join auth.sessions s on s.id=a.session_id and s.user_id=a.user_id
  where a.user_id=auth.uid() and a.session_id=nullif(auth.jwt()->>'session_id','')::uuid and a.expires_at>now()
 );
$$;
revoke all on function public.lexamah_is_content_assistant() from public,anon,authenticated;
grant execute on function public.lexamah_is_content_assistant() to authenticated;

create or replace function public.lexamah_content_team()
returns jsonb language plpgsql stable security definer set search_path=''
as $$ begin
 if not public.lexamah_is_admin() then raise exception 'Main administrator access required.' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object(
  'user_id',p.user_id,'username',p.username,'name',p.full_name,'disabled',p.disabled
 ) order by lower(p.username)) from public.lexamah_content_assistants a join public.lexamah_profiles p on p.user_id=a.user_id), '[]'::jsonb);
end; $$;
revoke all on function public.lexamah_content_team() from public,anon,authenticated;
grant execute on function public.lexamah_content_team() to authenticated;

create or replace function public.lexamah_appoint_assistant(p_username text)
returns void language plpgsql security definer set search_path=''
as $$ declare target uuid; begin
 if not public.lexamah_is_admin() then raise exception 'Main administrator access required.' using errcode='42501'; end if;
 if p_username is null or length(btrim(p_username)) not between 3 and 30 then raise exception 'Enter an existing account username.'; end if;
 select p.user_id into target from public.lexamah_profiles p join auth.users u on u.id=p.user_id
  where lower(p.username)=lower(btrim(p_username)) and not p.disabled and u.email_confirmed_at is not null
   and (u.banned_until is null or u.banned_until<now());
 if target is null then raise exception 'No active, confirmed account was found with that username.'; end if;
 if exists(select 1 from public.lexamah_admins where user_id=target) then raise exception 'That account is already a main administrator.'; end if;
 insert into public.lexamah_content_assistants(user_id) values(target) on conflict do nothing;
end; $$;
revoke all on function public.lexamah_appoint_assistant(text) from public,anon,authenticated;
grant execute on function public.lexamah_appoint_assistant(text) to authenticated;

create or replace function public.lexamah_dismiss_assistant(p_user_id uuid)
returns void language plpgsql security definer set search_path=''
as $$ begin
 if not public.lexamah_is_admin() then raise exception 'Main administrator access required.' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(847361029);
 if exists(select 1 from public.lexamah_admins where user_id=p_user_id) then raise exception 'Main administrator accounts are protected.' using errcode='42501'; end if;
 delete from public.lexamah_content_assistants where user_id=p_user_id;
 if found then delete from public.lexamah_admin_sessions where user_id=p_user_id; end if;
end; $$;
revoke all on function public.lexamah_dismiss_assistant(uuid) from public,anon,authenticated;
grant execute on function public.lexamah_dismiss_assistant(uuid) to authenticated;

create or replace function public.lexamah_own_upload(p_path text)
returns boolean language sql stable set search_path=''
as $$
 select coalesce(starts_with(p_path,auth.uid()::text||'/')
  and substring(p_path from 38) ~ '^[a-fA-F0-9-]{36}-[a-zA-Z0-9._-]{1,100}$',false);
$$;
revoke all on function public.lexamah_own_upload(text) from public,anon,authenticated;
grant execute on function public.lexamah_own_upload(text) to authenticated;

-- Allow only the assistant's own entries, and only their own attached files.
-- Quiz answers, subjects, shared overrides, portraits, settings and user
-- management continue to require lexamah_is_admin().
do $$ declare t text; allowed text; writable text; file_check text; begin
 foreach t in array array['lexamah_materials','lexamah_lecture_notes','lexamah_lectures','lexamah_cases','lexamah_flashcards'] loop
  execute format('alter table public.%I add column if not exists contributor_id uuid references auth.users(id) on delete set null',t);
  execute format('alter table public.%I alter column contributor_id set default auth.uid()',t);
  execute format('create index if not exists %I on public.%I(contributor_id) where contributor_id is not null',t||'_contributor_idx',t);
  allowed:='((select public.lexamah_is_content_assistant()) and contributor_id=(select auth.uid()))';
  file_check:=case when t='lexamah_flashcards' then 'true'
   when t='lexamah_lectures' then '(storage_bucket=''lexamah-audio'' and public.lexamah_own_upload(storage_path))'
   else '(storage_path is null or (storage_bucket=''lexamah-files'' and public.lexamah_own_upload(storage_path)))'
   end;
  writable:='('||allowed||' and '||file_check||')';
  execute format('drop policy if exists "assistants manage own uploads" on public.%I',t);
  execute format('create policy "assistants manage own uploads" on public.%I for all to authenticated using (%s) with check (%s)',t,allowed,writable);
  execute format('drop policy if exists "admin only insert" on public.%I',t);
  execute format('drop policy if exists "admin only update" on public.%I',t);
  execute format('drop policy if exists "admin only delete" on public.%I',t);
  execute format('create policy "admin only insert" on public.%I as restrictive for insert to authenticated with check ((select public.lexamah_is_admin()) or %s)',t,writable);
  execute format('create policy "admin only update" on public.%I as restrictive for update to authenticated using ((select public.lexamah_is_admin()) or %s) with check ((select public.lexamah_is_admin()) or %s)',t,allowed,writable);
  execute format('create policy "admin only delete" on public.%I as restrictive for delete to authenticated using ((select public.lexamah_is_admin()) or %s)',t,allowed);
 end loop;
end; $$;

drop policy if exists "assistant files read" on storage.objects;
create policy "assistant files read" on storage.objects for select to authenticated
 using(bucket_id in ('lexamah-files','lexamah-audio') and (select public.lexamah_is_content_assistant()) and public.lexamah_own_upload(name));
drop policy if exists "assistant files insert" on storage.objects;
create policy "assistant files insert" on storage.objects for insert to authenticated
 with check(bucket_id in ('lexamah-files','lexamah-audio') and (select public.lexamah_is_content_assistant()) and public.lexamah_own_upload(name));
drop policy if exists "assistant files delete" on storage.objects;
create policy "assistant files delete" on storage.objects for delete to authenticated
 using(bucket_id in ('lexamah-files','lexamah-audio') and (select public.lexamah_is_content_assistant()) and public.lexamah_own_upload(name));
drop policy if exists "admin documents only" on storage.objects;
create policy "admin documents only" on storage.objects as restrictive for select to authenticated
 using(bucket_id<>'lexamah-files' or (select public.lexamah_is_admin()) or ((select public.lexamah_is_content_assistant()) and public.lexamah_own_upload(name)));
drop policy if exists "managed uploads insert" on storage.objects;
create policy "managed uploads insert" on storage.objects as restrictive for insert to authenticated
 with check(bucket_id not in ('lexamah-files','lexamah-audio','lexamah-portraits') or (select public.lexamah_is_admin())
 or (bucket_id in ('lexamah-files','lexamah-audio') and (select public.lexamah_is_content_assistant()) and public.lexamah_own_upload(name)));
drop policy if exists "managed uploads delete" on storage.objects;
create policy "managed uploads delete" on storage.objects as restrictive for delete to authenticated
 using(bucket_id not in ('lexamah-files','lexamah-audio','lexamah-portraits') or (select public.lexamah_is_admin())
 or (bucket_id in ('lexamah-files','lexamah-audio') and (select public.lexamah_is_content_assistant()) and public.lexamah_own_upload(name)));

create table if not exists public.lexamah_tip_settings (
 id text primary key check(id='main'),
 enabled boolean not null default false,
 title text not null default 'Share Tips' check(length(btrim(title)) between 1 and 55)
);
insert into public.lexamah_tip_settings(id) values('main') on conflict do nothing;
create table if not exists public.lexamah_tip_posts (
 id bigint generated always as identity primary key,
 author_id uuid not null references auth.users(id) on delete cascade,
 username text not null,
 title text not null check(length(title) between 1 and 120),
 body text not null check(length(body) between 10 and 3000),
 created_at timestamptz not null default now()
);
create table if not exists public.lexamah_tip_comments (
 id bigint generated always as identity primary key,
 post_id bigint not null references public.lexamah_tip_posts(id) on delete cascade,
 author_id uuid not null references auth.users(id) on delete cascade,
 username text not null,
 body text not null check(length(body) between 1 and 700),
 created_at timestamptz not null default now()
);
create table if not exists public.lexamah_tip_likes (
 post_id bigint not null references public.lexamah_tip_posts(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 primary key(post_id,user_id)
);
create index if not exists lexamah_tip_posts_author_time_idx on public.lexamah_tip_posts(author_id,created_at desc);
create index if not exists lexamah_tip_comments_post_idx on public.lexamah_tip_comments(post_id,id desc);
create index if not exists lexamah_tip_comments_author_time_idx on public.lexamah_tip_comments(author_id,created_at desc);
create index if not exists lexamah_tip_likes_user_idx on public.lexamah_tip_likes(user_id);

alter table public.lexamah_tip_settings enable row level security;
alter table public.lexamah_tip_posts enable row level security;
alter table public.lexamah_tip_comments enable row level security;
alter table public.lexamah_tip_likes enable row level security;
revoke all on public.lexamah_tip_settings,public.lexamah_tip_posts,public.lexamah_tip_comments,public.lexamah_tip_likes from public,anon,authenticated;
revoke all on sequence public.lexamah_tip_posts_id_seq,public.lexamah_tip_comments_id_seq from public,anon,authenticated;

-- Returning only the active user's role and the public-facing label replaces
-- the previous sequence of access and session requests.
create or replace function public.lexamah_workspace_access()
returns jsonb language plpgsql security definer set search_path=''
as $$ declare staff_role text:='student'; begin
 if not public.lexamah_account_active() then return jsonb_build_object('active',false); end if;
 if public.lexamah_admin_member() then
  if public.lexamah_claim_admin_session() then staff_role:='owner'; end if;
 elsif public.lexamah_assistant_member() and public.lexamah_claim_assistant_session() then staff_role:='assistant';
 end if;
 return jsonb_build_object('active',true,'role',staff_role,'tips',(
  select jsonb_build_object('title',title,'enabled',enabled) from public.lexamah_tip_settings where id='main'
 ));
end; $$;
revoke all on function public.lexamah_workspace_access() from public,anon,authenticated;
grant execute on function public.lexamah_workspace_access() to authenticated;

create or replace function public.lexamah_save_tip_settings(p_title text,p_enabled boolean)
returns jsonb language plpgsql security definer set search_path=''
as $$ declare saved jsonb; begin
 if not public.lexamah_is_admin() then raise exception 'Main administrator access required.' using errcode='42501'; end if;
 if p_title is null or length(btrim(p_title)) not between 1 and 55 or p_title ~ '[[:cntrl:]]' or p_enabled is null then
  raise exception 'Enter a section name between 1 and 55 characters.';
 end if;
 update public.lexamah_tip_settings set title=btrim(p_title),enabled=p_enabled where id='main'
 returning jsonb_build_object('title',title,'enabled',enabled) into saved;
 return saved;
end; $$;
revoke all on function public.lexamah_save_tip_settings(text,boolean) from public,anon,authenticated;
grant execute on function public.lexamah_save_tip_settings(text,boolean) to authenticated;

create or replace function public.lexamah_require_tips(p_moderate boolean)
returns void language plpgsql stable security definer set search_path=''
as $$ begin
 if p_moderate then
  if not public.lexamah_is_admin() then raise exception 'Main administrator access required.' using errcode='42501'; end if;
 else
  if not public.lexamah_account_active() then raise exception 'Sign in to use the student tips section.' using errcode='42501'; end if;
  if not exists(select 1 from public.lexamah_tip_settings where id='main' and enabled) then
   raise exception 'The student tips section is turned off.' using errcode='42501';
  end if;
 end if;
end; $$;
revoke all on function public.lexamah_require_tips(boolean) from public,anon,authenticated;

create or replace function public.lexamah_tip_feed(p_before bigint default null,p_moderate boolean default false)
returns jsonb language plpgsql stable security definer set search_path=''
as $$ declare result jsonb; begin
 perform public.lexamah_require_tips(p_moderate);
 with page as (
  select * from public.lexamah_tip_posts where p_before is null or id<p_before order by id desc limit 11
 ), items as (
  select t.id, t.username, t.title,t.created_at,left(t.body,220) as preview,
   (length(t.body)>220) as truncated,
   (select count(*) from public.lexamah_tip_likes l where l.post_id=t.id) as likes,
   (select count(*) from public.lexamah_tip_comments c where c.post_id=t.id) as comments
  from page t order by t.id desc limit 10
 )
 select jsonb_build_object('items',coalesce(jsonb_agg(to_jsonb(items) order by items.id desc),'[]'::jsonb),
  'next',case when (select count(*) from page)>10 then min(items.id) end)
 into result from items;
 return result;
end; $$;
revoke all on function public.lexamah_tip_feed(bigint,boolean) from public,anon,authenticated;
grant execute on function public.lexamah_tip_feed(bigint,boolean) to authenticated;

create or replace function public.lexamah_tip_detail(p_post_id bigint,p_moderate boolean default false)
returns jsonb language plpgsql stable security definer set search_path=''
as $$ declare result jsonb; begin
 perform public.lexamah_require_tips(p_moderate);
 select jsonb_build_object('id',t.id,'username',t.username,'title',t.title,'body',t.body,'created_at',t.created_at,
  'mine',t.author_id=auth.uid(),
  'likes',(select count(*) from public.lexamah_tip_likes l where l.post_id=t.id),
  'liked',exists(select 1 from public.lexamah_tip_likes l where l.post_id=t.id and l.user_id=auth.uid()),
  'comments',(select count(*) from public.lexamah_tip_comments c where c.post_id=t.id))
 into result from public.lexamah_tip_posts t where t.id=p_post_id;
 if result is null then raise exception 'This tip is no longer available.'; end if;
 return result;
end; $$;
revoke all on function public.lexamah_tip_detail(bigint,boolean) from public,anon,authenticated;
grant execute on function public.lexamah_tip_detail(bigint,boolean) to authenticated;

create or replace function public.lexamah_tip_comment_page(p_post_id bigint,p_before bigint default null,p_moderate boolean default false)
returns jsonb language plpgsql stable security definer set search_path=''
as $$ declare result jsonb; begin
 perform public.lexamah_require_tips(p_moderate);
 with page as (
  select id,username,body,created_at,author_id=auth.uid() as mine from public.lexamah_tip_comments
   where post_id=p_post_id and (p_before is null or id<p_before) order by id desc limit 21
 ), items as (select * from page order by id desc limit 20)
 select jsonb_build_object('items',coalesce(jsonb_agg(to_jsonb(items) order by items.id desc),'[]'::jsonb),
  'next',case when (select count(*) from page)>20 then min(items.id) end)
 into result from items;
 return result;
end; $$;
revoke all on function public.lexamah_tip_comment_page(bigint,bigint,boolean) from public,anon,authenticated;
grant execute on function public.lexamah_tip_comment_page(bigint,bigint,boolean) to authenticated;

create or replace function public.lexamah_publish_tip(p_title text,p_body text)
returns bigint language plpgsql security definer set search_path=''
as $$ declare author text; new_id bigint; begin
 perform public.lexamah_require_tips(false);
 if p_title is null or p_body is null or length(btrim(p_title)) not between 1 and 120
  or length(regexp_replace(p_body,'^[[:space:]]+|[[:space:]]+$','','g')) not between 10 and 3000 then
  raise exception 'Enter a title and a tip of 10 to 3,000 characters.';
 end if;
 select username into author from public.lexamah_profiles where user_id=auth.uid();
 if author is null then raise exception 'A registered username is required to post.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,91001));
 if (select count(*) from public.lexamah_tip_posts where author_id=auth.uid() and created_at>now()-interval '1 day')>=5
  then raise exception 'You can publish up to five tips per day. Try again later.'; end if;
 insert into public.lexamah_tip_posts(author_id,username,title,body)
 values(auth.uid(),author,btrim(p_title),regexp_replace(p_body,'^[[:space:]]+|[[:space:]]+$','','g')) returning id into new_id;
 return new_id;
end; $$;
revoke all on function public.lexamah_publish_tip(text,text) from public,anon,authenticated;
grant execute on function public.lexamah_publish_tip(text,text) to authenticated;

create or replace function public.lexamah_comment_on_tip(p_post_id bigint,p_body text)
returns jsonb language plpgsql security definer set search_path=''
as $$ declare author text; saved jsonb; message text:=regexp_replace(p_body,'^[[:space:]]+|[[:space:]]+$','','g'); begin
 perform public.lexamah_require_tips(false);
 if message is null or length(message) not between 1 and 700 then raise exception 'Enter a comment of up to 700 characters.'; end if;
 if not exists(select 1 from public.lexamah_tip_posts where id=p_post_id) then raise exception 'This tip is no longer available.'; end if;
 select username into author from public.lexamah_profiles where user_id=auth.uid();
 if author is null then raise exception 'A registered username is required to comment.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,91002));
 if (select count(*) from public.lexamah_tip_comments where author_id=auth.uid() and created_at>now()-interval '1 hour')>=30
  then raise exception 'You can send up to 30 comments per hour. Try again later.'; end if;
 insert into public.lexamah_tip_comments(post_id,author_id,username,body) values(p_post_id,auth.uid(),author,message)
 returning jsonb_build_object('id',id,'username',username,'body',body,'created_at',created_at,'mine',true) into saved;
 return saved;
end; $$;
revoke all on function public.lexamah_comment_on_tip(bigint,text) from public,anon,authenticated;
grant execute on function public.lexamah_comment_on_tip(bigint,text) to authenticated;

create or replace function public.lexamah_set_tip_like(p_post_id bigint,p_liked boolean)
returns jsonb language plpgsql security definer set search_path=''
as $$ begin
 perform public.lexamah_require_tips(false);
 if not exists(select 1 from public.lexamah_tip_posts where id=p_post_id) then raise exception 'This tip is no longer available.'; end if;
 if p_liked is true then
  insert into public.lexamah_tip_likes(post_id,user_id) values(p_post_id,auth.uid()) on conflict do nothing;
 else delete from public.lexamah_tip_likes where post_id=p_post_id and user_id=auth.uid();
 end if;
 return jsonb_build_object('liked',exists(select 1 from public.lexamah_tip_likes where post_id=p_post_id and user_id=auth.uid()),
  'likes',(select count(*) from public.lexamah_tip_likes where post_id=p_post_id));
end; $$;
revoke all on function public.lexamah_set_tip_like(bigint,boolean) from public,anon,authenticated;
grant execute on function public.lexamah_set_tip_like(bigint,boolean) to authenticated;

create or replace function public.lexamah_delete_tip(p_post_id bigint)
returns void language plpgsql security definer set search_path=''
as $$ declare owner_access boolean:=public.lexamah_is_admin(); begin
 if not owner_access then perform public.lexamah_require_tips(false); end if;
 delete from public.lexamah_tip_posts where id=p_post_id and (owner_access or author_id=auth.uid());
 if not found then raise exception 'You cannot delete that tip.' using errcode='42501'; end if;
end; $$;
revoke all on function public.lexamah_delete_tip(bigint) from public,anon,authenticated;
grant execute on function public.lexamah_delete_tip(bigint) to authenticated;

create or replace function public.lexamah_delete_tip_comment(p_comment_id bigint)
returns void language plpgsql security definer set search_path=''
as $$ declare owner_access boolean:=public.lexamah_is_admin(); begin
 if not owner_access then perform public.lexamah_require_tips(false); end if;
 delete from public.lexamah_tip_comments where id=p_comment_id and (owner_access or author_id=auth.uid());
 if not found then raise exception 'You cannot delete that comment.' using errcode='42501'; end if;
end; $$;
revoke all on function public.lexamah_delete_tip_comment(bigint) from public,anon,authenticated;
grant execute on function public.lexamah_delete_tip_comment(bigint) to authenticated;

notify pgrst,'reload schema';
commit;
