-- 1. Create/confirm your account in LexAmah Settings first.
-- 2. Replace YOUR_EMAIL_ADDRESS with the exact email used for that account.
-- 3. Run this in Supabase SQL Editor (never in client/browser code).
do $$
declare account_id uuid;
begin
 select id into account_id from auth.users where lower(email)=lower('Chimdike247@gmail.com');
 if account_id is null then
  raise exception 'No account found. Replace YOUR_EMAIL_ADDRESS with your signup email, or create the account first.';
 end if;
 insert into public.lexamah_admins(user_id) values(account_id) on conflict(user_id) do nothing;
end; $$;
