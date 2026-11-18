-- LexAmah setup: safe to rerun; creates only new lexamah_* objects.
-- Run this complete file in Supabase Dashboard > SQL Editor.
begin;
create table if not exists public.lexamah_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.lexamah_admins enable row level security;
create or replace function public.lexamah_is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.lexamah_admins where user_id = (select auth.uid())); $$;
revoke all on function public.lexamah_is_admin() from public, anon;
grant execute on function public.lexamah_is_admin() to authenticated;
grant select on public.lexamah_admins to authenticated;
revoke insert, update, delete on public.lexamah_admins from anon, authenticated;
do $$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='lexamah_admins' and policyname='lexamah own admin membership') then
  create policy "lexamah own admin membership" on public.lexamah_admins for select to authenticated using (user_id=(select auth.uid()));
 end if;
end; $$;
create table if not exists public.lexamah_materials (
 id uuid primary key default gen_random_uuid(),title text not null,subject text not null,description text not null default '',body text not null default '',url text not null default '',storage_path text,file_name text,file_size bigint,created_at timestamptz not null default now()
);
create table if not exists public.lexamah_lectures (
 id uuid primary key default gen_random_uuid(),title text not null,subject text not null,description text not null default '',url text not null default '',storage_path text,file_name text,file_size bigint,created_at timestamptz not null default now()
);
create table if not exists public.lexamah_cases (
 id uuid primary key default gen_random_uuid(),title text not null,subject text not null,citation text not null default '',description text not null default '',body text not null default '',url text not null default '',storage_path text,file_name text,file_size bigint,created_at timestamptz not null default now()
);
create table if not exists public.lexamah_flashcards (
 id uuid primary key default gen_random_uuid(),subject text not null,front text not null,back text not null,created_at timestamptz not null default now()
);
create table if not exists public.lexamah_quiz_sets (
 id uuid primary key default gen_random_uuid(),name text not null,subject text not null,description text not null default '',time_minutes integer not null default 10 check(time_minutes between 1 and 180),difficulty text not null default 'Practice',created_at timestamptz not null default now()
);
create table if not exists public.lexamah_quiz_questions (
 id uuid primary key default gen_random_uuid(),quiz_set_id uuid not null references public.lexamah_quiz_sets(id) on delete cascade,question text not null,options jsonb not null check(jsonb_typeof(options)='array' and jsonb_array_length(options)=4),correct_index integer not null check(correct_index between 0 and 3),explanation text not null default '',created_at timestamptz not null default now()
);
create table if not exists public.lexamah_quiz_attempts (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,quiz_set_id uuid not null references public.lexamah_quiz_sets(id) on delete restrict,score integer not null check(score>=0),total_questions integer not null check(total_questions>0 and score<=total_questions),created_at timestamptz not null default now()
);
do $$ declare t text; begin
 foreach t in array array['lexamah_materials','lexamah_lectures','lexamah_cases','lexamah_flashcards','lexamah_quiz_sets','lexamah_quiz_questions'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('grant select, insert, update, delete on public.%I to authenticated',t);
  execute format('revoke all on public.%I from anon',t);
  if not exists(select 1 from pg_policies where schemaname='public' and tablename=t and policyname='lexamah signed in read') then
   execute format('create policy "lexamah signed in read" on public.%I for select to authenticated using (true)',t);
  end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename=t and policyname='lexamah admins manage') then
   execute format('create policy "lexamah admins manage" on public.%I for all to authenticated using ((select public.lexamah_is_admin())) with check ((select public.lexamah_is_admin()))',t);
  end if;
 end loop;
end; $$;
alter table public.lexamah_quiz_attempts enable row level security;
grant select, insert on public.lexamah_quiz_attempts to authenticated;
revoke all on public.lexamah_quiz_attempts from anon;
revoke update, delete on public.lexamah_quiz_attempts from authenticated;
do $$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='lexamah_quiz_attempts' and policyname='lexamah own attempts read') then
  create policy "lexamah own attempts read" on public.lexamah_quiz_attempts for select to authenticated using (user_id=(select auth.uid()));
 end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='lexamah_quiz_attempts' and policyname='lexamah own attempts insert') then
  create policy "lexamah own attempts insert" on public.lexamah_quiz_attempts for insert to authenticated with check(user_id=(select auth.uid()));
 end if;
end; $$;
create index if not exists lexamah_quiz_questions_set_idx on public.lexamah_quiz_questions(quiz_set_id);
create index if not exists lexamah_quiz_attempts_user_idx on public.lexamah_quiz_attempts(user_id);
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('lexamah-files','lexamah-files',false,52428800,array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain','image/jpeg','image/png','audio/mpeg','audio/mp4','video/mp4'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
do $$ begin
 if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='lexamah students read files') then
  create policy "lexamah students read files" on storage.objects for select to authenticated using (bucket_id='lexamah-files');
 end if;
 if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='lexamah admins upload files') then
  create policy "lexamah admins upload files" on storage.objects for insert to authenticated with check (bucket_id='lexamah-files' and (select public.lexamah_is_admin()));
 end if;
 if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='lexamah admins update files') then
  create policy "lexamah admins update files" on storage.objects for update to authenticated using (bucket_id='lexamah-files' and (select public.lexamah_is_admin())) with check (bucket_id='lexamah-files' and (select public.lexamah_is_admin()));
 end if;
 if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='lexamah admins delete files') then
  create policy "lexamah admins delete files" on storage.objects for delete to authenticated using (bucket_id='lexamah-files' and (select public.lexamah_is_admin()));
 end if;
end; $$;
notify pgrst,'reload schema';
commit;
-- Scores are personal study metrics; do not use client-submitted results for graded examinations.

-- Account, lecture notes and audio updates.
-- Run after setup.sql on an existing LexAmah project. Safe to rerun.
begin;
create table if not exists public.lexamah_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 username text not null check(username ~ '^[a-zA-Z0-9_.]{3,30}$'),
 full_name text not null check(length(trim(full_name))>0),
 institution text not null check(length(trim(institution))>0),
 level text not null check(length(trim(level))>0),
 created_at timestamptz not null default now()
);
create unique index if not exists lexamah_profiles_username_unique on public.lexamah_profiles(lower(username));
alter table public.lexamah_profiles enable row level security;
revoke all on public.lexamah_profiles from anon,authenticated;
grant select on public.lexamah_profiles to authenticated;
grant update(full_name,institution,level) on public.lexamah_profiles to authenticated;
grant all on public.lexamah_profiles to service_role;
do $$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='lexamah_profiles' and policyname='lexamah own profile') then
  create policy "lexamah own profile" on public.lexamah_profiles for select to authenticated using(user_id=(select auth.uid()));
  create policy "lexamah update own profile" on public.lexamah_profiles for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
 end if;
end; $$;
create or replace function public.lexamah_create_signup_profile()
returns trigger language plpgsql security definer set search_path=''
as $$ begin
 if new.raw_user_meta_data->>'lexamah_signup'='true' then
  insert into public.lexamah_profiles(user_id,username,full_name,institution,level)
  values(new.id,trim(new.raw_user_meta_data->>'username'),trim(new.raw_user_meta_data->>'full_name'),trim(new.raw_user_meta_data->>'institution'),trim(new.raw_user_meta_data->>'level'));
 end if;
 return new;
end; $$;
revoke all on function public.lexamah_create_signup_profile() from public,anon,authenticated;
drop trigger if exists lexamah_signup_profile on auth.users;
create trigger lexamah_signup_profile after insert on auth.users for each row execute function public.lexamah_create_signup_profile();
create or replace function public.lexamah_account_lookup(p_username text)
returns jsonb language sql stable security definer set search_path=''
as $$ select jsonb_build_object('email',u.email,'profile',jsonb_build_object('username',p.username,'full_name',p.full_name,'institution',p.institution,'level',p.level))
 from public.lexamah_profiles p join auth.users u on u.id=p.user_id where lower(p.username)=lower(trim(p_username)); $$;
revoke all on function public.lexamah_account_lookup(text) from public,anon,authenticated;
grant execute on function public.lexamah_account_lookup(text) to service_role;
create table if not exists public.lexamah_lecture_notes (
 id uuid primary key default gen_random_uuid(),title text not null,subject text not null,description text not null default '',body text not null default '',url text not null default '',storage_path text,file_name text,file_size bigint,storage_bucket text default 'lexamah-files',mime_type text,created_at timestamptz not null default now()
);
alter table public.lexamah_lecture_notes enable row level security;
grant select,insert,update,delete on public.lexamah_lecture_notes to authenticated;
revoke all on public.lexamah_lecture_notes from anon;
do $$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='lexamah_lecture_notes' and policyname='lexamah notes read') then
  create policy "lexamah notes read" on public.lexamah_lecture_notes for select to authenticated using(true);
  create policy "lexamah notes admins" on public.lexamah_lecture_notes for all to authenticated using((select public.lexamah_is_admin())) with check((select public.lexamah_is_admin()));
 end if;
end; $$;
alter table public.lexamah_materials add column if not exists storage_bucket text default 'lexamah-files';
alter table public.lexamah_materials add column if not exists mime_type text;
alter table public.lexamah_cases add column if not exists storage_bucket text default 'lexamah-files';
alter table public.lexamah_cases add column if not exists mime_type text;
alter table public.lexamah_lectures add column if not exists storage_bucket text default 'lexamah-files';
alter table public.lexamah_lectures add column if not exists mime_type text;
do $$ begin
 if not exists(select 1 from pg_constraint where conname='lexamah_recordings_audio_only' and conrelid='public.lexamah_lectures'::regclass) then
  alter table public.lexamah_lectures add constraint lexamah_recordings_audio_only check(storage_path is not null and storage_bucket is not null and storage_bucket='lexamah-audio' and mime_type is not null and mime_type like 'audio/%') not valid;
 end if;
end; $$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('lexamah-audio','lexamah-audio',false,52428800,array['audio/mpeg','audio/mp4','audio/aac','audio/wav','audio/x-wav','audio/ogg','audio/webm','audio/flac'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
-- Document URLs are issued only by the download function after code validation.
drop policy if exists "lexamah students read files" on storage.objects;
do $$ begin
 if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='lexamah admins read documents') then
  create policy "lexamah admins read documents" on storage.objects for select to authenticated using(bucket_id='lexamah-files' and (select public.lexamah_is_admin()));
 end if;
 if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='lexamah audio student playback') then
  create policy "lexamah audio student playback" on storage.objects for select to authenticated using(bucket_id='lexamah-audio');
  create policy "lexamah audio admin insert" on storage.objects for insert to authenticated with check(bucket_id='lexamah-audio' and (select public.lexamah_is_admin()));
  create policy "lexamah audio admin update" on storage.objects for update to authenticated using(bucket_id='lexamah-audio' and (select public.lexamah_is_admin())) with check(bucket_id='lexamah-audio' and (select public.lexamah_is_admin()));
  create policy "lexamah audio admin delete" on storage.objects for delete to authenticated using(bucket_id='lexamah-audio' and (select public.lexamah_is_admin()));
 end if;
end; $$;
notify pgrst,'reload schema';
commit;

-- Administrator-managed subject catalog.
-- Run in SQL Editor once. Safe to rerun: deleted subjects are not re-seeded.
begin;
do $$ begin
 if to_regclass('public.lexamah_subjects') is null then
  create table public.lexamah_subjects (
   id uuid primary key default gen_random_uuid(),
   name text not null check(length(trim(name)) between 1 and 120 and lower(trim(name))<>'all subjects'),
   created_at timestamptz not null default now()
  );
  insert into public.lexamah_subjects(name) values
   ('Tort Law'),('Contract Law'),('Criminal Law'),('Constitutional Law'),('Legal Methods'),('Equity & Trusts');
 end if;
end; $$;
create unique index if not exists lexamah_subjects_name_unique on public.lexamah_subjects(lower(trim(name)));
alter table public.lexamah_subjects enable row level security;
grant select on public.lexamah_subjects to anon,authenticated;
grant insert,update,delete on public.lexamah_subjects to authenticated;
do $$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='lexamah_subjects' and policyname='lexamah subjects read') then
  create policy "lexamah subjects read" on public.lexamah_subjects for select to anon,authenticated using(true);
 end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='lexamah_subjects' and policyname='lexamah subjects admins') then
  create policy "lexamah subjects admins" on public.lexamah_subjects for all to authenticated using((select public.lexamah_is_admin())) with check((select public.lexamah_is_admin()));
 end if;
end; $$;
notify pgrst,'reload schema';
commit;

-- Editable public mission, founder profiles and contributor credits.
begin;
create table if not exists public.lexamah_about (
 id text primary key check(id='main'),
 content jsonb not null default '{"mission":"","founders":[],"contributors":[]}'::jsonb check(jsonb_typeof(content)='object'),
 updated_at timestamptz not null default now()
);
insert into public.lexamah_about(id) values('main') on conflict(id) do nothing;
alter table public.lexamah_about enable row level security;
grant select on public.lexamah_about to anon,authenticated;
grant update on public.lexamah_about to authenticated;
revoke insert,delete on public.lexamah_about from anon,authenticated;
do $$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='lexamah_about' and policyname='lexamah about public read') then
  create policy "lexamah about public read" on public.lexamah_about for select to anon,authenticated using(true);
  create policy "lexamah about admin update" on public.lexamah_about for update to authenticated using((select public.lexamah_is_admin())) with check((select public.lexamah_is_admin()));
 end if;
end; $$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('lexamah-portraits','lexamah-portraits',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
do $$ begin
 if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='lexamah portraits admin') then
  create policy "lexamah portraits admin" on storage.objects for all to authenticated using(bucket_id='lexamah-portraits' and (select public.lexamah_is_admin())) with check(bucket_id='lexamah-portraits' and (select public.lexamah_is_admin()));
 end if;
end; $$;
notify pgrst,'reload schema';
commit;

-- Usage and download reporting.
begin;
create table if not exists public.lexamah_visits (
 visitor_id uuid not null, visit_day date not null, identity_key text not null,
 user_id uuid references auth.users(id) on delete cascade, last_seen timestamptz not null default now(),
 primary key(visitor_id,visit_day,identity_key)
);
create table if not exists public.lexamah_download_events (
 id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id) on delete set null,
 resource_type text not null,resource_id text,created_at timestamptz not null default now()
);
alter table public.lexamah_visits enable row level security;
alter table public.lexamah_download_events enable row level security;
revoke all on public.lexamah_visits,public.lexamah_download_events from anon,authenticated;
create or replace function public.lexamah_record_visit(p_visitor_id uuid)
returns void language plpgsql security definer set search_path=''
as $$ begin
 insert into public.lexamah_visits(visitor_id,visit_day,identity_key,user_id,last_seen)
 values(p_visitor_id,(now() at time zone 'Africa/Lagos')::date,coalesce(auth.uid()::text,'anonymous'),auth.uid(),now())
 on conflict(visitor_id,visit_day,identity_key) do update set last_seen=now();
end; $$;
revoke all on function public.lexamah_record_visit(uuid) from public;
grant execute on function public.lexamah_record_visit(uuid) to anon,authenticated;
create or replace function public.lexamah_record_download(p_user_id uuid,p_resource_type text,p_resource_id text)
returns void language sql security definer set search_path=''
as $$ insert into public.lexamah_download_events(user_id,resource_type,resource_id) values(p_user_id,p_resource_type,p_resource_id); $$;
revoke all on function public.lexamah_record_download(uuid,text,text) from public,anon,authenticated;
grant execute on function public.lexamah_record_download(uuid,text,text) to service_role;
create or replace function public.lexamah_admin_stats()
returns jsonb language plpgsql stable security definer set search_path=''
as $$ begin
 if not public.lexamah_is_admin() then raise exception 'Administrator access is required'; end if;
 return jsonb_build_object(
  'registered_users',(select count(*) from public.lexamah_profiles),
  'visitors_7d',(select count(distinct visitor_id) from public.lexamah_visits where last_seen>=now()-interval '7 days'),
  'active_users_7d',(select count(distinct user_id) from public.lexamah_visits where last_seen>=now()-interval '7 days'),
  'downloads',(select count(*) from public.lexamah_download_events)
 );
end; $$;
revoke all on function public.lexamah_admin_stats() from public,anon;
grant execute on function public.lexamah_admin_stats() to authenticated;
create index if not exists lexamah_visits_seen_idx on public.lexamah_visits(last_seen);
notify pgrst,'reload schema';
commit;

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

-- Run after the existing LexAmah security update. Safe to rerun.
begin;
create table if not exists public.lexamah_download_settings (
 id text primary key check(id='main'),
 require_access_code boolean not null default true,
 updated_at timestamptz not null default now()
);
insert into public.lexamah_download_settings(id) values('main') on conflict(id) do nothing;
alter table public.lexamah_download_settings enable row level security;
revoke all on public.lexamah_download_settings from public,anon,authenticated;
grant select on public.lexamah_download_settings to authenticated;
grant update(require_access_code,updated_at) on public.lexamah_download_settings to authenticated;
grant select on public.lexamah_download_settings to service_role;
drop policy if exists "active accounts read download policy" on public.lexamah_download_settings;
create policy "active accounts read download policy" on public.lexamah_download_settings for select to authenticated
using((select public.lexamah_account_active()));
drop policy if exists "admins change download policy" on public.lexamah_download_settings;
create policy "admins change download policy" on public.lexamah_download_settings for update to authenticated
using((select public.lexamah_is_admin())) with check((select public.lexamah_is_admin()));
notify pgrst,'reload schema';
commit;

-- Admin-editable download code
-- Only a hash is stored; browser accounts have no access to this table.
begin;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create table if not exists public.lexamah_download_code (
 id text primary key check(id='main'),
 code_hash text not null,
 updated_at timestamptz not null default now()
);
alter table public.lexamah_download_code enable row level security;
revoke all on public.lexamah_download_code from public,anon,authenticated,service_role;

create or replace function public.lexamah_change_download_code(p_code text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
 normalized text := pg_catalog.btrim(p_code);
 crypto_schema text;
 hashed text;
begin
 if not coalesce(public.lexamah_is_admin(),false) then
  raise exception 'Administrator access is required.' using errcode='42501';
 end if;
 if normalized is null or pg_catalog.char_length(normalized)<4 or pg_catalog.octet_length(normalized)>64
    or normalized ~ '[[:cntrl:]]' then
  raise exception 'Use at least 4 characters, up to 64 letters, numbers or symbols. Choose a shorter code if it includes emoji or accented letters.' using errcode='22023';
 end if;
 select n.nspname into strict crypto_schema
 from pg_catalog.pg_extension e join pg_catalog.pg_namespace n on n.oid=e.extnamespace
 where e.extname='pgcrypto';
 execute pg_catalog.format('select %I.crypt($1, %I.gen_salt(''bf'', 10))',crypto_schema,crypto_schema)
 into hashed using normalized;
 insert into public.lexamah_download_code(id,code_hash,updated_at) values('main',hashed,pg_catalog.now())
 on conflict(id) do update set code_hash=excluded.code_hash,updated_at=excluded.updated_at;
 return true;
end;
$$;
revoke all on function public.lexamah_change_download_code(text) from public,anon,authenticated,service_role;
grant execute on function public.lexamah_change_download_code(text) to authenticated;

-- Called only by the Edge Function after checking the user's active session.
-- NULL means no dashboard override exists: preserve the existing environment/default code.
create or replace function public.lexamah_verify_download_code(p_code text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
 stored_hash text;
 crypto_schema text;
 matches boolean;
 normalized text := pg_catalog.btrim(p_code);
begin
 select code_hash into stored_hash from public.lexamah_download_code where id='main';
 if stored_hash is null then return null; end if;
 if normalized is null or pg_catalog.octet_length(normalized)>64 then return false; end if;
 select n.nspname into strict crypto_schema
 from pg_catalog.pg_extension e join pg_catalog.pg_namespace n on n.oid=e.extnamespace
 where e.extname='pgcrypto';
 execute pg_catalog.format('select $1 = %I.crypt($2, $1)',crypto_schema)
 into matches using stored_hash,normalized;
 return coalesce(matches,false);
end;
$$;
revoke all on function public.lexamah_verify_download_code(text) from public,anon,authenticated,service_role;
grant execute on function public.lexamah_verify_download_code(text) to service_role;
notify pgrst,'reload schema';
commit;

-- Shared branding and signup examples
-- Public branding and sign-up examples. Requires the existing security update.
begin;
create or replace function public.lexamah_valid_signup_examples(value jsonb)
returns boolean language sql immutable set search_path='' as $$
 select case when pg_catalog.jsonb_typeof(value)='object' then
  (select count(*) from pg_catalog.jsonb_each(value))=7 and not exists(
   select 1 from pg_catalog.jsonb_each(value) entry
   where entry.key not in ('full_name','email','phone_number','institution','level','username','password')
      or pg_catalog.jsonb_typeof(entry.value)<>'string'
      or pg_catalog.char_length(entry.value #>> '{}')>160
      or (entry.value #>> '{}') ~ '[[:cntrl:]]'
  ) else false end;
$$;
create table if not exists public.lexamah_branding (
 id text primary key check(id='main'),
 site_name text not null default 'LexAmah' check(char_length(btrim(site_name)) between 1 and 60 and site_name !~ '[[:cntrl:]]'),
 logo_path text check(logo_path is null or logo_path ~ '^logos/[a-zA-Z0-9_-]+\.png$'),
 watermark_text text not null default 'LexAmah' check(btrim(watermark_text) ~ '^[ -~]{1,60}$'),
 signup_examples jsonb not null default '{"full_name":"Adv Chimdike","email":"AdvChimdike@gmail.com","phone_number":"08012345678 or +2348012345678","institution":"University of Port Harcourt","level":"LLB 4","username":"AdvChimdike","password":"Choose a password (at least 8 characters)"}'::jsonb
  check(public.lexamah_valid_signup_examples(signup_examples)),
 updated_at timestamptz not null default now()
);
insert into public.lexamah_branding(id) values('main') on conflict(id) do nothing;
alter table public.lexamah_branding enable row level security;
revoke all on public.lexamah_branding from public,anon,authenticated;
grant select on public.lexamah_branding to anon,authenticated;
grant update(site_name,logo_path,watermark_text,signup_examples,updated_at) on public.lexamah_branding to authenticated;
drop policy if exists "public reads branding" on public.lexamah_branding;
create policy "public reads branding" on public.lexamah_branding for select to anon,authenticated using(true);
drop policy if exists "admins update branding" on public.lexamah_branding;
create policy "admins update branding" on public.lexamah_branding for update to authenticated
 using((select public.lexamah_is_admin())) with check((select public.lexamah_is_admin()));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('lexamah-branding','lexamah-branding',true,2097152,array['image/png'])
on conflict(id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists "admins manage branding logos" on storage.objects;
create policy "admins manage branding logos" on storage.objects for all to authenticated
 using(bucket_id='lexamah-branding' and (select public.lexamah_is_admin()))
 with check(bucket_id='lexamah-branding' and name ~ '^logos/[a-zA-Z0-9_-]+\.png$' and (select public.lexamah_is_admin()));
-- Also restrict any broader legacy policies from granting students write access.
drop policy if exists "branding logos admin insert" on storage.objects;
create policy "branding logos admin insert" on storage.objects as restrictive for insert to authenticated
 with check(bucket_id<>'lexamah-branding' or (select public.lexamah_is_admin()));
drop policy if exists "branding logos admin update" on storage.objects;
create policy "branding logos admin update" on storage.objects as restrictive for update to authenticated
 using(bucket_id<>'lexamah-branding' or (select public.lexamah_is_admin()))
 with check(bucket_id<>'lexamah-branding' or (select public.lexamah_is_admin()));
drop policy if exists "branding logos admin delete" on storage.objects;
create policy "branding logos admin delete" on storage.objects as restrictive for delete to authenticated
 using(bucket_id<>'lexamah-branding' or (select public.lexamah_is_admin()));
-- Anonymous accounts also cannot use any legacy upload policies for this bucket.
drop policy if exists "anonymous branding insert blocked" on storage.objects;
create policy "anonymous branding insert blocked" on storage.objects as restrictive for insert to anon
 with check(bucket_id<>'lexamah-branding');
drop policy if exists "anonymous branding update blocked" on storage.objects;
create policy "anonymous branding update blocked" on storage.objects as restrictive for update to anon
 using(bucket_id<>'lexamah-branding') with check(bucket_id<>'lexamah-branding');
drop policy if exists "anonymous branding delete blocked" on storage.objects;
create policy "anonymous branding delete blocked" on storage.objects as restrictive for delete to anon
 using(bucket_id<>'lexamah-branding');
notify pgrst,'reload schema';
commit;

-- Admin site text, appearance and built-in / legacy edits
-- Run after the existing LexAmah security/branding updates.
begin;
create table if not exists public.lexamah_site_editor (
 id text primary key check(id='main'),
 copy jsonb not null default '{}'::jsonb check(jsonb_typeof(copy)='object' and octet_length(copy::text)<=1000000),
 appearance jsonb not null default '{}'::jsonb check(jsonb_typeof(appearance)='object' and octet_length(appearance::text)<=50000),
 updated_at timestamptz not null default now()
);
insert into public.lexamah_site_editor(id) values('main') on conflict do nothing;
alter table public.lexamah_site_editor enable row level security;
revoke all on public.lexamah_site_editor from public,anon,authenticated;
grant select on public.lexamah_site_editor to anon,authenticated;
grant update(copy,appearance,updated_at) on public.lexamah_site_editor to authenticated;
drop policy if exists "public reads site presentation" on public.lexamah_site_editor;
create policy "public reads site presentation" on public.lexamah_site_editor for select to anon,authenticated using(true);
drop policy if exists "admin edits site presentation" on public.lexamah_site_editor;
create policy "admin edits site presentation" on public.lexamah_site_editor for update to authenticated
using((select public.lexamah_is_admin())) with check((select public.lexamah_is_admin()));
create table if not exists public.lexamah_library_overrides (
 kind text not null check(kind in ('materials','lectureNotes','lectures','cases','flashcards','quizSets','quizQuestions')),
 source text not null check(source in ('builtin','legacy')),
 source_id text not null check(char_length(source_id) between 1 and 180),
 content jsonb not null default '{}'::jsonb check(jsonb_typeof(content)='object' and octet_length(content::text)<=200000),
 hidden boolean not null default false,
 updated_at timestamptz not null default now(),
 primary key(kind,source,source_id)
);
alter table public.lexamah_library_overrides enable row level security;
revoke all on public.lexamah_library_overrides from public,anon,authenticated;
grant select,insert,update,delete on public.lexamah_library_overrides to authenticated;
drop policy if exists "active accounts read library edits" on public.lexamah_library_overrides;
create policy "active accounts read library edits" on public.lexamah_library_overrides for select to authenticated using((select public.lexamah_account_active()));
drop policy if exists "admin manages library edits" on public.lexamah_library_overrides;
create policy "admin manages library edits" on public.lexamah_library_overrides for all to authenticated
using((select public.lexamah_is_admin())) with check((select public.lexamah_is_admin()));
notify pgrst,'reload schema';
commit;

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
