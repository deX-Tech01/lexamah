# Password recovery fix

Replace dist/js/recovery.js in your existing project and push to GitHub/Vercel.
No SQL or Edge Function deployment is required.

In your Supabase project, open Authentication > URL Configuration:
- Site URL: https://lexuniport.vercel.app
- Add Redirect URL: https://lexuniport.vercel.app/?recovery=1
- Retain your other valid redirect URLs. If you use a different production domain, use that domain instead.

In Authentication > Email Templates > Reset Password, the reset link should use:

```html
<a href="{{ .ConfirmationURL }}">Reset password</a>
```

A link directly to #reset or containing only type=recovery does not verify the account.
Save the settings, redeploy the updated file, then request a NEW reset email and open the newest link. Do not reuse an already opened or expired link.

The fix uses a redirect without a router fragment, reads standard and legacy #reset#access_token fragments, removes tokens from the address bar, and distinguishes invalid/expired links. Supabase verifies the access token before allowing a password change. No authentication is bypassed.

Validation: module syntax, recovery URL regression tests and existing recovery/password-update tests passed with mocked authentication responses. A real email reset must be tested after the above Supabase settings are applied.
