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
