# Branding Settings update

Admin Dashboard > Branding Settings now controls:

- Site name: app labels, About headings, sign-up introduction, navigation, footer, dialog heading and browser title.
- Logo: upload PNG, JPG or WebP (up to 2 MB), preview it, then save. It fits the whole image in the frame and is prepared as a square PNG. It also becomes the browser icon.
- Default watermark text: pre-filled for every new/replacement material or lecture-note upload; each upload can still override it.
- Sign-up input examples: full name, email, phone number, institution, level, username and password hint. Blank means no hint. These are placeholders, never saved as a user's personal information.

## 1. Copy these files into your existing project

Extract this ZIP. Copy files into the matching paths in your project root (where dist and supabase are). Merge folders; do not delete or replace whole folders.

Replace:
- dist/js/app.js
- dist/js/admin.js
- dist/js/backend.js
- dist/js/about.js
- dist/js/analytics.js
- dist/js/users.js
- dist/js/store.js
- dist/js/watermark.js
- dist/js/watermark-controls.js

Add:
- dist/js/brand-state.js
- dist/js/branding.js
- dist/js/branding-admin.js
- supabase/branding-update.sql
- docs/BRANDING-UPDATE.md (these instructions)

The ZIP also includes dist/js/downloads.js, dist/js/download-settings.js, supabase/download-code-update.sql, supabase/functions/content-download/index.ts, supabase/functions/_shared/server.ts and docs/DOWNLOAD-CODE-UPDATE.md from the previous download access-code update. They are included because the updated admin/backend files use that feature. Copy these matching files too if they are not already current.

Your index.html, CSS, logo files, uploaded materials, accounts and stored progress are not replaced by this ZIP. Existing public branding stays LexAmah until you save a different name. Your current local logo remains the fallback until a shared logo is uploaded from Branding Settings.

## 2. Run the branding SQL

In your existing Supabase project, open SQL Editor > New query.
Open supabase/branding-update.sql in VS Code, copy the whole file into the editor and click Run.

Run only branding-update.sql for this feature. It assumes your earlier security/user-management setup is installed. Do not rerun setup.sql. Rerunning branding-update.sql preserves saved branding, hints, accounts and uploads.

This adds one public settings row and a public logo-only Storage bucket. The database allows only a verified administrator session to change settings or upload/change/delete logos. Materials and lecture-note buckets remain private.

If you have NOT installed the previous download-code update yet, also run supabase/download-code-update.sql once, then deploy that existing download function from the project terminal:

```bash
npx supabase login
npx supabase functions deploy content-download --project-ref tvycfhrbdtyxmyeymdgo --no-verify-jwt
```

If your previous download code-change feature is already working, no Edge Function deployment is required for branding itself.

## 3. Push the website update

From the VS Code terminal in your existing Git project root:

```bash
git add dist/js/app.js dist/js/admin.js dist/js/backend.js dist/js/about.js dist/js/analytics.js dist/js/users.js dist/js/store.js dist/js/watermark.js dist/js/watermark-controls.js dist/js/brand-state.js dist/js/branding.js dist/js/branding-admin.js dist/js/downloads.js dist/js/download-settings.js supabase/branding-update.sql supabase/download-code-update.sql supabase/functions/content-download/index.ts supabase/functions/_shared/server.ts docs/BRANDING-UPDATE.md docs/DOWNLOAD-CODE-UPDATE.md
git commit -m "Add admin branding and signup example settings"
git push
```

Wait for Vercel deployment to finish, then refresh the site. This ZIP does not automatically apply SQL or update your Vercel project.

## 4. Use the controls

Sign in as admin > Admin Dashboard > Branding Settings. Change the name, choose a logo, set the default watermark and edit the sign-up examples. Click Save branding settings.

Changes apply immediately in that browser. Other visitors receive them when opening/refreshing the site, returning to its tab, or during the next visible-tab refresh (about a minute). A slow public refresh cannot overwrite a more recent admin save. Ordinary users can see the public branding but cannot change it.

To restore the original local logo, check Use the original site logo instead and save. To change the watermark on an already uploaded document, replace its attachment; existing stamped PDFs cannot be rewritten just by changing a default.

The site name does not change your domain, GitHub repository, Supabase names, account logins, existing file names, stored course notes or custom mission text. You can edit custom mission text in the About editor. Browser-rendered metadata changes with branding; static page source/link previews and existing installed native app names/icons may still need a separate hosting/app update. Browser icon caches can take time to refresh.

Watermark text supports 1–60 plain English letters, numbers and punctuation, matching the current PDF watermark tool. Site names and sign-up examples support other characters too. Editing a password hint does not change password requirements. Never use real private contact details in public examples unless you intend them to be visible.

## Verify after installing

1. Save a different site name and logo. Check the sidebar, footer, About page and browser tab.
2. Log out and open Sign Up. Check the phone/email examples; fields must still be empty.
3. Open a new material upload as admin. The watermark text should equal your saved default.
4. Test from a second account. Public branding should load, and there must be no admin access.

Validation: all project syntax/workflow tests and new branding tests passed. The SQL was executed in a local PostgreSQL engine to check public reads, admin-only writes, logo policies, validation and rerun preservation. Browser checks used mock accounts/data and covered saving, raster logo preparation, page labels, guest sign-up hints and the new-upload watermark default. Apply and verify the SQL on your own Supabase project using the steps above.
