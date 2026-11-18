# Faster startup and login

Apply this speed-only update after the PDF reader, Share Tips and Admin Team update. Merge the included `dist` folder into the existing project at its root, replace the matching files, and push your GitHub changes so Vercel redeploys. This speed update does not change the database or Supabase Edge Functions. If you have not applied the earlier update, use the full project ZIP and follow `START-HERE.md`.

The sign-in form opens without waiting for public appearance and branding settings. After Supabase checks the password and account access, the dashboard opens and progress syncs in the background. The dashboard loads short material and recording previews. The full library sections load when opened. Readers and admin tools load on demand. The mobile app uses the website, so reload it after deploying to Vercel.

In a local browser test with the same simulated server delays, the previous version displayed the dashboard in 4.2 seconds after submitting login; this version displayed it in 0.5 seconds. Live timing depends on the device, connection and Supabase.
