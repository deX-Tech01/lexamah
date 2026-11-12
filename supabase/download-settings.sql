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
