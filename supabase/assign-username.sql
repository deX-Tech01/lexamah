-- Existing users: replace YOUR_EMAIL_ADDRESS and edit the example details.
insert into public.lexamah_profiles(user_id,username,full_name,institution,level)
select id,'AdvChimdike','Adv Chimdike','University of Port Harcourt','LLB 4'
from auth.users where lower(email)=lower('YOUR_EMAIL_ADDRESS')
on conflict(user_id) do update set username=excluded.username,full_name=excluded.full_name,institution=excluded.institution,level=excluded.level;
-- If 0 rows are inserted, verify that the email matches an existing account.
