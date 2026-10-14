-- Run on the existing project after user-management.sql. Preserves accounts/content.
begin;
create table if not exists public.lexamah_admin_sessions (
 session_id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,expires_at timestamptz not null
);
alter table public.lexamah_admin_sessions enable row level security;
revoke all on public.lexamah_admin_sessions from public,anon,authenticated;
grant all on public.lexamah_admin_sessions to service_role;
create or replace function public.lexamah_admin_member()
returns boolean language sql stable security definer set search_path=''
as $$ select public.lexamah_account_active() and exists(select 1 from public.lexamah_admins a join auth.users u on u.id=a.user_id where a.user_id=auth.uid() and u.email_confirmed_at is not null); $$;
revoke all on function public.lexamah_admin_member() from public,anon;
grant execute on function public.lexamah_admin_member() to authenticated;
create or replace function public.lexamah_claim_admin_session()
returns boolean language plpgsql security definer set search_path=''
as $$ declare sid uuid; begin
 if not public.lexamah_admin_member() then return false; end if;
 sid := nullif(auth.jwt()->>'session_id','')::uuid;
 if sid is null or not exists(select 1 from auth.sessions where id=sid and user_id=auth.uid()) then return false; end if;
 perform pg_advisory_xact_lock(847361029);
 delete from public.lexamah_admin_sessions a where a.expires_at<=now() or not exists(select 1 from auth.sessions s where s.id=a.session_id and s.user_id=a.user_id);
 if exists(select 1 from public.lexamah_admin_sessions where session_id=sid and user_id=auth.uid()) then
  update public.lexamah_admin_sessions set expires_at=now()+interval '3 minutes' where session_id=sid; return true;
 end if;
 if (select count(*) from public.lexamah_admin_sessions)>=2 then return false; end if;
 insert into public.lexamah_admin_sessions values(sid,auth.uid(),now()+interval '3 minutes'); return true;
end; $$;
revoke all on function public.lexamah_claim_admin_session() from public,anon;
grant execute on function public.lexamah_claim_admin_session() to authenticated;
create or replace function public.lexamah_release_admin_session()
returns void language sql security definer set search_path=''
as $$ delete from public.lexamah_admin_sessions where session_id=nullif(auth.jwt()->>'session_id','')::uuid and user_id=auth.uid(); $$;
revoke all on function public.lexamah_release_admin_session() from public,anon;
grant execute on function public.lexamah_release_admin_session() to authenticated;
create or replace function public.lexamah_is_admin()
returns boolean language sql stable security definer set search_path=''
as $$ select public.lexamah_admin_member() and exists(select 1 from public.lexamah_admin_sessions a join auth.sessions s on s.id=a.session_id and s.user_id=a.user_id where a.user_id=auth.uid() and a.session_id=nullif(auth.jwt()->>'session_id','')::uuid and a.expires_at>now()); $$;
-- Member/session checks are authoritative; user-editable profile metadata never grants admin access.
create table if not exists public.lexamah_user_progress (
 user_id uuid primary key references auth.users(id) on delete cascade,
 data jsonb not null default '{}' check(jsonb_typeof(data)='object' and octet_length(data::text)<=4000000),updated_at timestamptz not null default now()
);
alter table public.lexamah_user_progress enable row level security;
revoke all on public.lexamah_user_progress from anon,authenticated;
grant select,insert,update on public.lexamah_user_progress to authenticated;
grant all on public.lexamah_user_progress to service_role;
drop policy if exists "own progress only" on public.lexamah_user_progress;
create policy "own progress only" on public.lexamah_user_progress for all to authenticated
using(user_id=auth.uid() and (select public.lexamah_account_active())) with check(user_id=auth.uid() and (select public.lexamah_account_active()));
-- Lock legacy and current shared tables regardless of old permissive policies.
do $$ declare t record; op text; begin
 for t in select tablename from pg_tables where schemaname='public' and tablename in ('lexamah_materials','lexamah_lecture_notes','lexamah_lectures','lexamah_cases','lexamah_flashcards','lexamah_quiz_sets','lexamah_quiz_questions','lexamah_subjects','lexamah_about','materials','lectures','cases','flashcards','quiz_sets','quiz_questions') loop
  execute format('alter table public.%I enable row level security',t.tablename);
  if t.tablename not in ('lexamah_about','lexamah_subjects') then
   execute format('revoke all on public.%I from anon',t.tablename);
   execute format('drop policy if exists "signed in readers" on public.%I',t.tablename);
   execute format('create policy "signed in readers" on public.%I as restrictive for select to authenticated using ((select public.lexamah_account_active()))',t.tablename);
  end if;
  foreach op in array array['insert','update','delete'] loop
   execute format('drop policy if exists %I on public.%I','admin only '||op,t.tablename);
   if op='insert' then execute format('create policy %I on public.%I as restrictive for insert to authenticated with check ((select public.lexamah_is_admin()))','admin only '||op,t.tablename);
   elsif op='update' then execute format('create policy %I on public.%I as restrictive for update to authenticated using ((select public.lexamah_is_admin())) with check ((select public.lexamah_is_admin()))','admin only '||op,t.tablename);
   else execute format('create policy %I on public.%I as restrictive for delete to authenticated using ((select public.lexamah_is_admin()))','admin only '||op,t.tablename); end if;
  end loop;
 end loop;
 for t in select tablename from pg_tables where schemaname='public' and tablename in ('quiz_attempts','lexamah_quiz_attempts','lexamah_profiles') loop
  execute format('alter table public.%I enable row level security',t.tablename);
  execute format('revoke all on public.%I from anon',t.tablename);
  execute format('drop policy if exists "account owned rows" on public.%I',t.tablename);
  execute format('create policy "account owned rows" on public.%I as restrictive for all to authenticated using (user_id=auth.uid() and (select public.lexamah_account_active())) with check (user_id=auth.uid() and (select public.lexamah_account_active()))',t.tablename);
 end loop;
end; $$;
-- Document content stays private. Reading signs an authenticated, short-lived link in content-view.
drop policy if exists "admin documents only" on storage.objects;
create policy "admin documents only" on storage.objects as restrictive for select to authenticated using(bucket_id<>'lexamah-files' or (select public.lexamah_is_admin()));
-- Protect all managed upload buckets even if a legacy permissive policy exists.
do $$ declare op text; begin
 foreach op in array array['insert','update','delete'] loop
  execute format('drop policy if exists %I on storage.objects','managed uploads '||op);
  if op='insert' then execute format('create policy %I on storage.objects as restrictive for insert to authenticated with check (bucket_id not in (''lexamah-files'',''lexamah-audio'',''lexamah-portraits'') or (select public.lexamah_is_admin()))','managed uploads '||op);
  elsif op='update' then execute format('create policy %I on storage.objects as restrictive for update to authenticated using (bucket_id not in (''lexamah-files'',''lexamah-audio'',''lexamah-portraits'') or (select public.lexamah_is_admin())) with check (bucket_id not in (''lexamah-files'',''lexamah-audio'',''lexamah-portraits'') or (select public.lexamah_is_admin()))','managed uploads '||op);
  else execute format('create policy %I on storage.objects as restrictive for delete to authenticated using (bucket_id not in (''lexamah-files'',''lexamah-audio'',''lexamah-portraits'') or (select public.lexamah_is_admin()))','managed uploads '||op); end if;
 end loop;
end; $$;
drop policy if exists "anonymous private files" on storage.objects;
create policy "anonymous private files" on storage.objects as restrictive for all to anon
using(bucket_id not in ('lexamah-files','lexamah-audio','lexamah-portraits')) with check(bucket_id not in ('lexamah-files','lexamah-audio','lexamah-portraits'));
notify pgrst,'reload schema';
commit;
