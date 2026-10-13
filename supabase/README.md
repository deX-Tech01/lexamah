# Supabase setup

Run setup.sql for a new database, or updates.sql after an earlier LexAmah setup.

Deploy account-login and content-download using the commands in docs/SETUP.md. Supabase server keys stay only in Edge Functions. No AI key is required.

For an existing account, assign a username using assign-username.sql. For an administrator, run grant-admin.sql with the account email.

Recording uploads use the private audio-only lexamah-audio bucket. Materials and lecture notes use lexamah-files; student downloads go through the server access-code check. Default code: 5Gsupport.

The assistant has not executed these scripts or deployed these functions against your authenticated Supabase project.
