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
