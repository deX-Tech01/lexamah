# Set up the updated LexAmah

## Open in VS Code

Extract LexAmah-updated.zip and open the extracted LexAmah folder in VS Code. Right-click dist/index.html and choose Open with Live Server. The usual address is http://127.0.0.1:5500/dist/index.html.

Alternatively, from the project root run `python -m http.server 8080 --directory dist`, then open http://localhost:8080. JavaScript modules need an HTTP server; do not open the HTML directly through File Explorer.

## Install the database setup

Open your existing project in https://supabase.com/dashboard, choose SQL Editor > New query and run:

- New LexAmah database: copy all of supabase/setup.sql and run it.
- Existing LexAmah database where the previous setup.sql already ran: copy all of supabase/updates.sql and run it.

The update preserves your old Lexora tables and existing resources. It adds username profiles, lecture notes, an audio-only Storage bucket, and new document-download permissions.

Legacy recordings remain in the database, but the student recording pages show only audio files uploaded to the new lexamah-audio bucket. Edit old recording records in Admin Dashboard and replace their attachments with an audio file to make them available in the new player.

The earlier Supabase URL/public key remain configured in dist/js/backend.js. If using another project, update the defaults there or change the connection in Settings.

## Deploy the two required Edge Functions

Open Terminal > New Terminal from the project root in VS Code. Run each command separately:

```bash
npx supabase login
```

Complete the browser login, then run:

```bash
npx supabase functions deploy account-login --project-ref tvycfhrbdtyxmyeymdgo --no-verify-jwt
```

```bash
npx supabase functions deploy content-download --project-ref tvycfhrbdtyxmyeymdgo --no-verify-jwt
```

Allow npx to download the Supabase CLI if it asks. If you changed projects, replace the project reference above. Both functions use the supplied supabase/config.toml and the shared server helper.

The account-login handler authenticates username/password through Supabase Auth. The download handler checks a valid Supabase user session and the access code before issuing a document link. The legacy gateway JWT check is disabled because authentication is handled inside the functions.

Supabase normally provides SUPABASE_URL, SUPABASE_ANON_KEY/SUPABASE_PUBLISHABLE_KEYS and SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SECRET_KEYS to deployed functions automatically. These server credentials must never be copied into dist/ or browser JavaScript. If these environment keys are unavailable, check Edge Functions > Secrets in your project. The code also accepts LEXAMAH_SUPABASE_PUBLISHABLE_KEY for the public project key.

The default download access code is exactly `5Gsupport` (case-sensitive). It is checked on the server. If changing it later, set LEXAMAH_DOWNLOAD_CODE in Edge Functions > Secrets. The code is never stored as a successful browser unlock; every download asks again.

If you use another local port or deploy to another hostname, set LEXAMAH_ALLOWED_ORIGINS in Edge Functions > Secrets to a comma-separated list of origins (no paths), preserving the origins you need. The defaults allow the hosted LexAmah site and localhost/127.0.0.1 on ports 5500 and 8080.

## Signup and login

Sign Up collects full name, email, institution, level, username and password. The placeholders are examples: enter your own details. Passwords require at least eight characters. Usernames allow 3–30 letters, numbers, underscores or periods and are unique without regard to case.

Log In contains only username and password. The server resolves the corresponding email privately and then authenticates with Supabase; it does not expose an email-lookup endpoint to browser users.

If email confirmation is enabled, confirm your email before logging in. In Supabase Authentication > URL Configuration, allow the local and hosted URLs you use. Signup requests return to the current page; after confirmation, open Log In and enter your username/password.

### Existing Lexora/LexAmah accounts

If your account existed before usernames were added, open supabase/assign-username.sql, replace YOUR_EMAIL_ADDRESS with the exact existing email and update the sample username/name/institution/level. Run it in SQL Editor. This associates a username with your existing account and retains its password and admin membership. Do not create a duplicate account.

## Admin access

After creating or assigning your username, edit supabase/grant-admin.sql with your real account email and run it in SQL Editor. Log in, open Admin Dashboard and select Refresh.

The admin tabs include Materials, Lecture Notes, Lecture Recordings, Case briefs, Flashcards, Quiz sets and Quiz questions.

### Audio recordings

Select Lecture Recordings > Add lecture recordings. Enter the title, description and subject, choose an audio file and publish. Supported formats: MP3, M4A, AAC, WAV, OGG, WebM audio and FLAC, up to 50 MB. Video and document files are rejected. A file is required; external recording URLs and personal-browser recording creation are not offered.

On the student dashboard, Latest Lecture Recordings shows Play buttons. The Lecture Recordings page has the full searchable library. Pressing Play loads a signed audio URL into the player, with play/pause, seeking and volume controls. The player remains present across page navigation.

### Materials and lecture notes

Create documents under Materials or Lecture Notes. They support written content, document attachments and optional reference URLs. Document attachments accept PDF, DOCX, TXT, JPG and PNG up to 50 MB.

Students see separate Materials and Lecture notes filters. Download opens an access-code prompt. Incorrect codes are rejected. After the correct code, an uploaded document receives a short-lived signed download URL; text-only notes download as TXT. Local orientation guides also require a verified code before the app creates their text download.

The document bucket is private. The update replaces the old general student-read policy with administrator-only direct document access. The download function issues student links after code validation. Any custom policies created outside this project should be reviewed if they independently allow direct reads from lexamah-files.

Reference URLs outside Supabase remain controlled by their external host. Content already visible in the reader can still be copied; the code prompt controls the app's download action rather than protecting visible text.

### Quizzes

Create a Quiz set, then add questions with four options and the correct answer. Selecting an answer advances to the next question after a short highlight. Selecting the last answer submits the quiz and displays the review. Previous navigation remains available before submission.

## Verification

Browser syntax and mocked workflow tests cover the revised signup/login forms, quiz auto-advancement, audio validation/playback, administrator operations, server username lookup and access-code downloads. No authenticated migration or deployment of the two Supabase functions was performed by the assistant. Apply the setup above and verify a real student login, audio upload/playback, correct-code download and incorrect-code rejection before student launch. Visual browser QA was unavailable in the build environment.
