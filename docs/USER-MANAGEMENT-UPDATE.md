# LexAmah: users, phone numbers and bulk email

This is a partial update for the existing LexAmah project that already has About and launch tools installed. Copy the included files into the matching locations in your full project. Preserve your data.js, account keys and other existing content. The ZIP includes dist/js/users.js, replaces app.js/admin.js/backend.js/styles.css, adds user-management.sql and two functions, and replaces the shared function helper. It includes the existing login/download functions so all shared imports are available.

## Install in VS Code

Extract the ZIP. Copy its dist and supabase folder contents into your EXISTING LexAmah-updated/LexAmah folder, accepting replacement of the matching files. Do not run deployment from this partial update folder. Keep the other existing project files.

## Supabase SQL

Open supabase/user-management.sql, copy the entire file to Supabase SQL Editor and Run. Expect Success. No rows returned. This migration preserves existing accounts. Existing phone fields are blank until users add their number in Settings. New signups require a phone number; it is a contact field, not SMS verification.

The migration adds an admin-only paginated user directory (50 per page) with search by name, username, phone or email. Disable marks the profile and bans Auth. Restrictive RLS protects existing tokens. Shared Edge handlers also check active status. Public About information and local browser resources remain public/local; files already downloaded cannot be revoked. Existing signed audio links can remain valid up to two hours. Administrator accounts and your own account cannot be disabled/deleted through this screen. Remove another administrator's role manually before managing that account. Permanent deletion cascades LexAmah profile/quiz records, retains anonymous download totals, and may fail for Storage ownership or foreign keys in older custom tables: review those in Supabase rather than automatically deleting unknown data.

## Deploy functions

In VS Code Git Bash run each command separately:

```bash
cd ~/Downloads/LexAmah-updated/LexAmah
```

```bash
npx supabase functions deploy account-login --project-ref tvycfhrbdtyxmyeymdgo --no-verify-jwt
```

```bash
npx supabase functions deploy content-download --project-ref tvycfhrbdtyxmyeymdgo --no-verify-jwt
```

```bash
npx supabase functions deploy admin-users --project-ref tvycfhrbdtyxmyeymdgo --no-verify-jwt
```

```bash
npx supabase functions deploy admin-mail --project-ref tvycfhrbdtyxmyeymdgo --no-verify-jwt
```

Each handler verifies its caller internally. Never put a service-role or email API key into any browser JavaScript file. The shared helper includes the earlier Prefer CORS fix and port 3000 origins. Preserve/add your final website origin in LEXAMAH_ALLOWED_ORIGINS.

## Set up bulk email

1. Create a Resend account at https://resend.com and verify a sender domain you own in its Domains page. Follow its DNS instructions. A verified sender is needed to email your users; the default test sender is not suitable for your whole user list.
2. Create an API key with sending permission.
3. In Supabase Dashboard, open Edge Functions > Secrets and add:
   - RESEND_API_KEY: your Resend API key.
   - LEXAMAH_MAIL_FROM: your verified sender, for example `LexAmah <support@yourdomain.com>`. Replace this with a real address on your verified domain.
4. Log in to LexAmah as an administrator. Go to Admin Dashboard > Bulk Email and Refresh history.
5. Enter a subject and announcement. Press Review recipients & message. The preview shows the actual recipient count; preparing does not send anything.
6. Press Send to confirm. Only active LexAmah accounts with confirmed email addresses are included. Recipients receive individual emails; addresses are not exposed to each other. Keep the page open during sending.
7. Progress is saved in Supabase. If interrupted, open the same message from history and resume within 23 hours. Already accepted recipients are skipped; provider idempotency protects ambiguous retries. Failed recipients and their errors can be viewed by reopening the message. Rate limits pause sending; resume later after checking Resend limits. Pending recipients in an old message may already have received it; do not blindly recreate the entire message.

This sends plain-text platform announcements. It does not add attachments, marketing subscription management or background scheduled sending. Accepted means Resend accepted the email, not that it reached the inbox. Check delivery/bounces in Resend. Provider sending quotas still apply.

## Verify before going live

Use a test student: signup with phone, confirm email, log in, and check contact details in Admin > Users. Disable and confirm new login/download requests fail; re-enable and test login again. Delete only a disposable test account by typing its username. Verify a regular student cannot list users or call admin functions. Test email first with a small controlled list of registered accounts. No live account was modified or email sent while preparing this update.

All existing automated tests and the new server permission/mail retry tests pass with mocked services. The SQL migration, real account actions and email delivery still require verification on your Supabase project; no authenticated Supabase deployment was performed here. Browser visual QA was unavailable in this environment.

API references: https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid ; https://supabase.com/docs/reference/javascript/auth-admin-deleteuser ; https://resend.com/docs/api-reference/emails/send-email ; https://resend.com/docs/dashboard/emails/idempotency-keys
