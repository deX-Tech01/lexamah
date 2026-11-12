# Photo controls, support, statistics and password recovery

## Files to update

Add dist/js/analytics.js and dist/js/recovery.js. Replace dist/js/app.js, admin.js, backend.js and about.js. Replace dist/css/styles.css. Keep data.js, index.html, subjects.js and your existing Supabase configuration. Preserve your custom project URL/public key if you changed backend.js.

Copy the supplied supabase/functions/content-download/index.ts over the existing file. Keep your existing _shared/server.ts, including the prefer-header CORS fix.

## Database and download function

Run supabase/launch-tools.sql in Supabase SQL Editor. This adds the usage/download tracking tables and restricted RPC functions. Existing records are preserved. Full new installations receive this SQL through setup.sql.

From the existing LexAmah project root in VS Code, deploy the updated download function:

```bash
npx supabase functions deploy content-download --project-ref tvycfhrbdtyxmyeymdgo --no-verify-jwt
```

Use your actual project reference if different. No change to account-login is required for this update.

## Position pictures and set support details

Open Admin Dashboard > About LexAmah. Each founder has a preview, horizontal/vertical position sliders and two display choices. Fill frame crops to fill the card; use the sliders to keep the face in view. Show whole picture preserves the entire image. The preview and published images use the same 4:3 frame ratio.

Set Contact/support email and phone in this editor. Publish changes. They appear on the Contact & Support page and at the bottom of About LexAmah, with email/call links. Phone accepts a leading + and digits, spaces, parentheses or hyphens.

## Statistics

Admin Dashboard now shows:

- Active browsers over seven days (persistent browser identifiers).
- Registered LexAmah accounts (the current lexamah_profiles count).
- Active signed-in accounts over seven days.
- Successfully authorized download requests since tracking was installed.

Visitor identifiers are not a reliable count of distinct people: one person may use multiple browsers or devices, and a shared device may have multiple users. Signed-in activity uses verified Supabase account IDs. Repeated page loads in one browser/day do not inflate the unique browser count.

Historical visits and downloads are not available retroactively. The download counter records successful code-gated authorizations, including local guides and external-link authorizations, not proof of completed browser file transfers. Failed codes and unavailable resources are not counted. Tracking failures do not prevent reading or downloads. Only administrators can retrieve the aggregated dashboard metrics; browsers cannot directly read the event tables or write download events.

The app records a random persistent browser ID, activity date/time and an authenticated user ID when available. Download events record user ID and resource references. It does not collect IP addresses through this feature. Explain these usage records in your privacy information.

## Password recovery setup

In Supabase Dashboard > Authentication > URL Configuration, allow the exact URLs used by the app. For local development, for example:

- http://127.0.0.1:3000/**
- http://localhost:3000/**
- http://127.0.0.1:5500/**
- http://localhost:5500/**

Add your final live website URL too. Preserve redirects still needed by other apps in the project. The app sends a reset request with its current origin/path followed by #reset, so the destination must be allowed in Supabase. With the default Supabase confirmation template, use the standard recovery link / ConfirmationURL. Custom templates must preserve the token-based recovery redirect. This integration uses the implicit token callback, not a PKCE code exchange.

On Log In, select Forgot password?, enter the registration email and submit. Open the email link, enter and confirm a new password, then log in using the existing username and new password. The app verifies the recovery session with Supabase before offering the password change, clears callback tokens from the address bar and logs out after saving the new password. Invalid or expired links show a fresh-link option.

When testing localhost, keep the preview server running. Use the live website when sending recovery emails to real students. Recovery email delivery and rate limits are controlled by your Supabase project's Auth/SMTP settings. No password is stored in the browser or printed to logs by these modules.

## Verification

Code and mocked tests passed for photo position normalization, preview markup, support links, recovery requests/session checks/password updates, administrator metrics and download-event calls. No authenticated database migration, live function redeployment or actual reset email was performed by the assistant. Test a real email recovery, a live download and an ordinary user's denied access to metrics after installing. Visual browser QA was unavailable.
