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
