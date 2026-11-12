-- Adds both the on/off setting and admin-editable access code. Safe to rerun.
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
