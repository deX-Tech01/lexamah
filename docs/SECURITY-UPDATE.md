# LexAmah access, personal progress and document reader update

This partial update is for the existing project with user-management.sql already installed. Preserve your index.html, favicon/logo, data.js, and existing uploads. No account or resource is deleted by this migration.

## Copy these files

Replace matching files:
- dist/js/app.js
- dist/js/backend.js
- dist/js/store.js
- dist/js/admin.js
- dist/js/users.js
- dist/css/styles.css
- supabase/functions/account-login/index.ts
- supabase/functions/_shared/server.ts

Add:
- dist/js/progress-sync.js
- dist/js/document-reader.js
- the entire dist/vendor folder (PDF.js, worker, font data, Mammoth and licenses)
- supabase/security-update.sql
- supabase/functions/content-view/index.ts

The ZIP includes the existing content-download, admin-users and admin-mail function folders to keep shared dependencies together. Replace these matching copies too. supabase/config.toml is included; it contains the new content-view section. All deployment commands below explicitly disable gateway JWT verification because the handlers themselves verify the session with Supabase and check account/admin permissions.

## Run SQL

Copy all of supabase/security-update.sql into Supabase SQL Editor and Run. Expect Success. No rows returned. Do not rerun older standalone migrations after this patch: their previous function definitions could undo the strengthened admin checks. setup.sql in the maintained source is cumulative; the partial ZIP uses only this migration for your existing project.

The migration uses your existing lexamah_admins allowlist. Only the confirmed Supabase Auth account whose user ID is in that table can acquire an admin session. Signup metadata, a typed email address, or a guessed #admin URL cannot grant access. Login remains username/password; username lookup resolves the authorized account's email on the server.

A maximum of two admin sessions across devices/accounts is enforced with a PostgreSQL transaction lock. Reopening tabs with the same Supabase session does not consume extra slots. The third admin login is rejected. Open visible pages renew the lease every minute. Sign out releases it immediately; after closing the browser, a slot is released within three minutes. Background tabs may lose admin access after three minutes and must acquire a slot again on return. Shared content, user management, About updates and upload writes require a valid lease, not merely a hidden menu. Other user accounts have no admin privileges.

Protected study pages (including Materials, Settings, Content Studio, quiz and progress) require login. About, Support and account/recovery pages remain public. Account Connection is visible only to a verified administrator. Students' Content Studio edits are personal and cannot publish to the shared library.

## Deploy Supabase functions

From the FULL existing project in VS Code Git Bash:

```bash
cd ~/Downloads/LexAmah-updated/LexAmah
```

Run separately:

```bash
npx supabase functions deploy account-login --project-ref tvycfhrbdtyxmyeymdgo --no-verify-jwt
```
```bash
npx supabase functions deploy content-download --project-ref tvycfhrbdtyxmyeymdgo --no-verify-jwt
```
```bash
npx supabase functions deploy content-view --project-ref tvycfhrbdtyxmyeymdgo --no-verify-jwt
```
```bash
npx supabase functions deploy admin-users --project-ref tvycfhrbdtyxmyeymdgo --no-verify-jwt
```

Email integration can remain deferred. If admin-mail was previously deployed, redeploy it too so it uses the latest shared helper. Do not add email credentials unless enabling that feature.

Keep LEXAMAH_ALLOWED_ORIGINS set to your live address https://lexuniport.vercel.app and your local testing addresses. The helper's defaults now include that live origin, but an existing secret overrides defaults.

## Publish the frontend to your existing GitHub/Vercel project

After all files are copied and the SQL/functions are installed:

```bash
git add .
git commit -m "Secure LexAmah accounts and add document reading"
git push
```

Vercel deploys the production main branch. Root stays repository root; Output Directory remains dist; no build command. Do not replace index.html, so your custom favicon is preserved. Refresh the live page after Vercel reports Ready. Complete the installation before testing; older frontend versions cannot acquire the new admin lease.

## Personal progress

Browser storage is now keyed by Supabase user ID. Login/logout clears in-memory quizzes, timers, notes, audio, document readers, remote resources and administrator records. Progress, bookmarks, personal tasks/content and notes sync to an account-owned lexamah_user_progress row, enforced with RLS. Switching account cannot display or upload another account's state. Account profile refresh is separate from progress sync.

The old lexamah:v1 browser data mixed accounts and cannot be safely attributed to one person. It is retained as an unused legacy key; it is not automatically copied into each new account. Preserve an old backup if needed. A version-2 backup records its owner and cannot be imported into a different account. Cloud snapshots load on login; a device's pending unsynced changes take precedence. Simultaneous editing from multiple devices uses the last uploaded snapshot, not collaborative merging. Original names/emails/phone details remain in the account profile.

## Read notes

Read notes opens the attached PDF, DOCX document text, TXT, JPG or PNG inside a reading modal. PDFs have page navigation and zoom. There are no editing, printing or download controls in this reader. Reading a successfully displayed resource updates that account's reading progress. Download remains a separate code-gated action using 5Gsupport. Viewing uses content-view and does not increment download counts. DOCX viewing shows document text; for full page layout, upload a PDF. If no file is attached, authored body text is shown.

Files delivered to a browser can still be recovered, photographed or captured. This removes download controls from the reading interface; it is not DRM. Existing local downloads cannot be revoked.

## Verification

Automated JavaScript/handler tests pass for route guards, sidebar toggles, hidden admin navigation, user-scoped storage, cross-account backup rejection, cloud sync ownership, rejected third admin login and authenticated read-only document authorization.

The full SQL setup and this migration were executed and rerun in an isolated PostgreSQL-compatible PGlite test database with simulated Supabase Auth/storage schemas. Tests passed for two admin slots, rejection of a third, release/expiry, logged-out session invalidation, per-user progress RLS, blocked non-admin shared writes and denied user directory access. This verifies SQL behavior in a test environment, not that it has been applied to your Supabase project. No real user account was changed, no email was sent, and browser visual QA was unavailable.

Before announcing the update: test a student signup/login, two different accounts' progress on the same device, a third admin session on a separate browser, PDF reading and access-code downloading on the live URL.
