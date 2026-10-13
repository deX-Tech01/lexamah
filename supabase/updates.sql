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
