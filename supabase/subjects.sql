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
