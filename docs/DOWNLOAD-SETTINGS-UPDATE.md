# LexAmah download access-code setting

This update adds Admin Dashboard > Download Settings. Check or uncheck **Require an access code for downloads**, then click **Save download setting**.

- ON: downloads require the existing access code, 5Gsupport (or your existing LEXAMAH_DOWNLOAD_CODE server override).
- OFF: signed-in, active users download without entering an access code.
- Only an administrator with a valid admin session can change this setting. It applies to all users and protected downloads, including materials and lecture notes. Login remains required.
- The default is ON. Rerunning the SQL preserves your saved choice. Previously issued file links expire after 60 seconds; files already downloaded cannot be recalled.

## 1. Copy only these update files

Open the extracted ZIP. Copy its contents into the root of your existing LexAmah project, where dist and supabase already exist. Merge folders; do not delete or replace entire folders.

Replace:
- dist/js/admin.js
- dist/js/backend.js
- dist/js/downloads.js
- supabase/functions/content-download/index.ts
- supabase/functions/_shared/server.ts (included to support function deployment)

Add:
- dist/js/download-settings.js
- supabase/download-settings.sql
- docs/DOWNLOAD-SETTINGS-UPDATE.md (these instructions)

Keep your existing files, logo, Supabase connection, and other functions. This ZIP contains no account data and does not reset uploads.

## 2. Run the new SQL once

In your existing Supabase project, open SQL Editor > New query. Open supabase/download-settings.sql in VS Code, copy all its contents into the query, and click Run.

This assumes your existing LexAmah security/user-management setup is already installed. Run only this new SQL file for this update; do not rerun the entire setup.sql.

## 3. Deploy the updated download function

Open the VS Code terminal in your existing project root (the folder containing supabase). Run:

```bash
npx supabase login
npx supabase functions deploy content-download --project-ref tvycfhrbdtyxmyeymdgo --no-verify-jwt
```

The function verifies the user's session inside its handler. Keep your existing Supabase function secrets and any custom allowed-origin setting. No mail integration is required.

## 4. Update the website

From that same project root:

```bash
git add dist/js/admin.js dist/js/backend.js dist/js/downloads.js dist/js/download-settings.js supabase/download-settings.sql supabase/functions/content-download/index.ts supabase/functions/_shared/server.ts docs/DOWNLOAD-SETTINGS-UPDATE.md
git commit -m "Add admin control for download access code"
git push
```

Wait for your connected hosting service to finish its deployment, then refresh the website.

## 5. Verify

1. Sign in as admin and open Admin Dashboard > Download Settings.
2. Uncheck the requirement and Save. A signed-in student should download without a code prompt.
3. Check the requirement and Save. A new download should ask for the existing access code.
4. A logged-out visitor must still sign in. A student cannot change the saved setting.

The update was checked with the project's automated tests and a browser test of the admin setting using mock data. The SQL and function must still be applied to your own Supabase project using steps 2 and 3.
