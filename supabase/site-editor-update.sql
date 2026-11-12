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
