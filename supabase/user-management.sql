-- Existing installations: run after launch-tools.sql. Safe to rerun.
begin;
alter table public.lexamah_profiles add column if not exists phone_number text not null default '';
alter table public.lexamah_profiles add column if not exists disabled boolean not null default false;
grant update(phone_number) on public.lexamah_profiles to authenticated;
create or replace function public.lexamah_create_signup_profile()
returns trigger language plpgsql security definer set search_path=''
as $$ begin
 if new.raw_user_meta_data->>'lexamah_signup'='true' then
  if coalesce(new.raw_user_meta_data->>'phone_number','') !~ '^\+?[0-9 ()-]{7,25}$' then raise exception 'Enter a valid phone number'; end if;
  insert into public.lexamah_profiles(user_id,username,full_name,institution,level,phone_number)
  values(new.id,trim(new.raw_user_meta_data->>'username'),trim(new.raw_user_meta_data->>'full_name'),trim(new.raw_user_meta_data->>'institution'),trim(new.raw_user_meta_data->>'level'),trim(new.raw_user_meta_data->>'phone_number'));
 end if; return new;
end; $$;
create or replace function public.lexamah_account_active()
returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from auth.users u where u.id=auth.uid() and (u.banned_until is null or u.banned_until < now())) and not exists(select 1 from public.lexamah_profiles p where p.user_id=auth.uid() and p.disabled); $$;
revoke all on function public.lexamah_account_active() from public,anon;
grant execute on function public.lexamah_account_active() to authenticated;
create or replace function public.lexamah_is_admin()
returns boolean language sql stable security definer set search_path=''
as $$ select public.lexamah_account_active() and exists(select 1 from public.lexamah_admins where user_id=auth.uid()); $$;
-- Restrictive policies protect already-issued access tokens as well as fresh logins.
do $$ declare t record; begin
 for t in select tablename from pg_tables where schemaname='public' and (tablename like 'lexamah\_%' escape '\' or tablename in ('materials','lectures','cases','flashcards','quiz_sets','quiz_questions','quiz_attempts')) loop
  execute format('drop policy if exists "lexamah active accounts" on public.%I',t.tablename);
  execute format('create policy "lexamah active accounts" on public.%I as restrictive for all to authenticated using ((select public.lexamah_account_active())) with check ((select public.lexamah_account_active()))',t.tablename);
 end loop;
end; $$;
drop policy if exists "lexamah active storage" on storage.objects;
create policy "lexamah active storage" on storage.objects as restrictive for all to authenticated
using (bucket_id not in ('lexamah-files','lexamah-audio','lexamah-portraits') or (select public.lexamah_account_active()))
with check (bucket_id not in ('lexamah-files','lexamah-audio','lexamah-portraits') or (select public.lexamah_account_active()));
create or replace function public.lexamah_account_lookup(p_username text)
returns jsonb language sql stable security definer set search_path=''
as $$ select jsonb_build_object('email',u.email,'profile',jsonb_build_object('username',p.username,'full_name',p.full_name,'institution',p.institution,'level',p.level,'phone_number',p.phone_number))
from public.lexamah_profiles p join auth.users u on u.id=p.user_id where lower(p.username)=lower(trim(p_username)) and not p.disabled; $$;
create or replace function public.lexamah_admin_users(p_offset integer default 0,p_query text default '')
returns jsonb language plpgsql stable security definer set search_path=''
as $$ declare result jsonb; begin
 if not public.lexamah_is_admin() then raise exception 'Administrator access required'; end if;
 select jsonb_build_object('total',count(*),'users',coalesce((select jsonb_agg(to_jsonb(x)) from (
 select p.*,u.email,u.email_confirmed_at,exists(select 1 from public.lexamah_admins a where a.user_id=p.user_id) as is_admin
 from public.lexamah_profiles p join auth.users u on u.id=p.user_id
 where concat_ws(' ',p.full_name,p.username,p.phone_number,u.email) ilike '%'||left(p_query,100)||'%'
 order by p.created_at desc,p.user_id limit 50 offset greatest(p_offset,0)) x),'[]'::jsonb)) into result
 from public.lexamah_profiles p join auth.users u on u.id=p.user_id where concat_ws(' ',p.full_name,p.username,p.phone_number,u.email) ilike '%'||left(p_query,100)||'%';
 return result; end; $$;
revoke all on function public.lexamah_admin_users(integer,text) from public,anon;
grant execute on function public.lexamah_admin_users(integer,text) to authenticated;
create table if not exists public.lexamah_mail_jobs(id uuid primary key,created_by uuid references auth.users(id) on delete set null,subject text not null,message text not null,created_at timestamptz not null default now());
create table if not exists public.lexamah_mail_recipients(job_id uuid references public.lexamah_mail_jobs(id) on delete cascade,email text not null,user_id uuid references auth.users(id) on delete cascade,status text not null default 'pending',provider_id text,error text,primary key(job_id,email));
alter table public.lexamah_mail_jobs enable row level security;
alter table public.lexamah_mail_recipients enable row level security;
revoke all on public.lexamah_mail_jobs,public.lexamah_mail_recipients from anon,authenticated;
grant all on public.lexamah_mail_jobs,public.lexamah_mail_recipients to service_role;
create or replace function public.lexamah_create_mail_job(p_id uuid,p_admin uuid,p_subject text,p_message text)
returns void language plpgsql security definer set search_path=''
as $$ begin
 if not exists(select 1 from public.lexamah_admins where user_id=p_admin) then raise exception 'Administrator required'; end if;
 insert into public.lexamah_mail_jobs values(p_id,p_admin,p_subject,p_message,now());
 insert into public.lexamah_mail_recipients(job_id,email,user_id)
 select p_id,lower(u.email),p.user_id from public.lexamah_profiles p join auth.users u on u.id=p.user_id
 where not p.disabled and u.email_confirmed_at is not null and u.email is not null;
end; $$;
revoke all on function public.lexamah_create_mail_job(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.lexamah_create_mail_job(uuid,uuid,text,text) to service_role;
create or replace function public.lexamah_mail_counts(p_id uuid)
returns jsonb language sql stable security definer set search_path=''
as $$ select jsonb_build_object('total',count(*),'pending',count(*) filter(where status='pending'),'sent',count(*) filter(where status='sent'),'failed',count(*) filter(where status='failed'),'skipped',count(*) filter(where status='skipped')) from public.lexamah_mail_recipients where job_id=p_id; $$;
revoke all on function public.lexamah_mail_counts(uuid) from public,anon,authenticated;
grant execute on function public.lexamah_mail_counts(uuid) to service_role;
notify pgrst,'reload schema';
commit;
