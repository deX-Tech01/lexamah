# LexAmah: change the download access code from the admin dashboard

This ZIP combines the previous ON/OFF control and the new code-change feature. Use this ZIP even if you have not installed the previous download-settings ZIP.

## Files to copy

Copy the files into the matching locations in your existing project root (the folder containing dist and supabase). Merge folders and replace matching files; do not replace or delete whole folders.

| Action | File |
| --- | --- |
| Replace | dist/js/admin.js |
| Replace | dist/js/backend.js |
| Replace | dist/js/downloads.js |
| Add or replace | dist/js/download-settings.js |
| Add | supabase/download-code-update.sql |
| Replace | supabase/functions/content-download/index.ts |
| Replace | supabase/functions/_shared/server.ts |
| Optional instructions | docs/DOWNLOAD-CODE-UPDATE.md |

Your existing uploads, users, logo, watermark settings and other files are kept. This update assumes the earlier LexAmah security and user-management SQL is already installed.

## 1. Run the SQL

Open your existing Supabase project > SQL Editor > New query. In VS Code, open supabase/download-code-update.sql, copy all of it into the SQL editor, and click Run.

This file includes both download-settings setup and secure code-change functions. You do not need to run the earlier download-settings.sql separately. Do not rerun the entire setup.sql.

The new table stores a salted bcrypt hash, not the original access code. Browser accounts cannot read the hash table. The database verifies administrator access before allowing a change. Rerunning this migration preserves the saved code and ON/OFF choice.

## 2. Deploy the download function

In the VS Code terminal, open your project root, then run:

```bash
npx supabase login
npx supabase functions deploy content-download --project-ref tvycfhrbdtyxmyeymdgo --no-verify-jwt
```

The function checks the user's active session inside its handler. Keep your existing Supabase secrets and any custom LEXAMAH_ALLOWED_ORIGINS setting. The server/service-role key stays in Supabase, never in browser JavaScript.

## 3. Push website changes

Run these commands inside your existing Git project root:

```bash
git add dist/js/admin.js dist/js/backend.js dist/js/downloads.js dist/js/download-settings.js supabase/download-code-update.sql supabase/functions/content-download/index.ts supabase/functions/_shared/server.ts docs/DOWNLOAD-CODE-UPDATE.md
git commit -m "Allow admins to change the download access code"
git push
```

Wait for Vercel to finish deploying, then refresh the website. The ZIP does not automatically update your Vercel site or apply Supabase SQL.

## 4. Change your download access code

1. Sign in with your admin account.
2. Open Admin Dashboard > Download Settings.
3. Under Change download access code, enter the new code twice.
4. Click Save new access code. A success message confirms the change.
5. Keep Require an access code for downloads checked and click Save download setting if you want the code required.

The ON/OFF setting and the code are saved separately. Changing a code while the requirement is OFF stores it for when you turn the requirement ON. Your account login password is unchanged.

Until you first save a dashboard code, the existing code remains 5Gsupport, or your existing LEXAMAH_DOWNLOAD_CODE environment override. After you save a dashboard code, that code takes priority and the old default/environment code stops working. If you forget the download code, sign in as admin and set another one; the current code is not displayed.

Codes are case-sensitive. Spaces at the beginning and end are ignored. Use at least 4 characters and no more than 64 UTF-8 bytes; ordinary letters, numbers and symbols allow up to 64 characters, while emoji/accented letters can use more space.

New download requests use the latest code. A file link already issued can remain usable for its 60-second lifetime. Files already downloaded cannot be recalled. Users must remain logged in and active even when the code requirement is OFF.

## Verify

- With the requirement ON, save a new code. Test that the old code fails and the new one works from a student account.
- Turn the requirement OFF and save. A signed-in student should download without a code.
- Turn it ON again. The new code should be required.
- A student cannot change the setting or code. A logged-out/disabled user cannot download.

Validation: project syntax/workflow tests and code-rotation tests passed; the admin form was tested in a browser using mock data. PostgreSQL permission, validation and rerun checks were tested locally with a crypto stub because that local engine lacks pgcrypto. Actual hashing and deployment must be verified in your Supabase project after the SQL and function update.
