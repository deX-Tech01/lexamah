# LexAmah — complete website package

This is the full current website project, including the earlier account/security, upload, watermark, branding and download-code updates. You do not need to apply the older ZIPs separately.

## Use it with your EXISTING live project

1. Extract the ZIP. Inside is the LexAmah folder, containing dist, supabase, docs, scripts and package.json.
2. Keep a copy of your existing local project. Copy the contents of this LexAmah folder into your EXISTING Git project root, merging matching folders and replacing matching project files. Keep your existing .git directory and any personal images/assets folders. Do not create a fresh Supabase project.
3. In your existing Supabase project, open SQL Editor > New query. Paste ALL of supabase/COMPLETE-INSTALL-OR-UPGRADE.sql and click Run. This is the only database file to run for the complete update; it already contains the earlier migrations and the new editor setup. Do not run all the smaller SQL files afterward.
4. Open a VS Code terminal in that existing project root, where package.json and supabase are located. Deploy all included server functions:

```bash
npx supabase login
npx supabase functions deploy --project-ref tvycfhrbdtyxmyeymdgo --no-verify-jwt --use-api
```

The handlers perform account/admin checks internally. This deploys account-login, content-download, content-view, admin-users and admin-mail together. Keep your existing Supabase function secrets. Mail integration remains optional; deploying the mail handler does not send mail.

5. Push the website files:

```bash
git add .
git commit -m "Install complete admin editor and randomized quizzes"
git push
```

6. In Vercel, keep Framework Preset Other and Output Directory dist. The included vercel.json provides this static output configuration. Wait for deployment to finish, then refresh the site (Ctrl+Shift+R on Windows).
7. Log in with your EXISTING admin username and password.

The combined SQL was tested on a fresh local database and rerun over existing accounts, content rows, branding and settings. It preserves those records. The ZIP is source code, not a copy of your live database or uploaded files: existing users, uploaded documents and recordings stay in the same Supabase project. It does not recreate private files from an old, unavailable project.

If you customized the logo only in an old index.html, upload that original image in Branding Settings after installing. A logo already saved through Branding Settings is retained by the SQL.

## New admin controls

### Samples & Existing Content

Choose Quiz sets to edit quiz names, subjects, descriptions and time limits. Choose Quiz questions to edit questions, all four choices, the correct answer and explanations.

Built-in guides and flashcards can be edited here too. Supported older database content (materials, lectures, cases, quiz_sets and quiz_questions) is listed alongside bundled samples when those tables exist and are readable. For example, a Contract quiz from an older quiz_sets table appears in this list.

Hide removes a resource from new student listings without deleting its original record or past results. Show restores it. Reset to original removes the shared edit. Your normal Materials, Lecture Notes, Lecture Recordings, Quiz sets and Quiz questions tabs still manage current shared uploads.

If a quiz exists ONLY in a much older custom JavaScript file that is not present in this project and was never saved to Supabase, this ZIP cannot recover that missing content automatically. Keep that older file and copy its questions into the shared quiz editor. Personal Content Studio resources remain account-specific; their owner edits them in Content Studio.

### Text & Appearance > Interface text

Search for a word or sentence you see on the site. Filter by page/component. Edit the entry and click Publish text changes. The editor includes more than 700 interface entries, including headings, explanatory paragraphs, button labels, navigation and many messages. Text is plain text; HTML and scripts are not accepted. Use Reset to original for one entry or Discard draft before publishing.

Some sentences are split around a dynamic name, number or resource title. Edit the static parts; the dynamic account/resource data stays connected. Names, document contents, quiz wording, founder biographies and mission text are managed in their own editors. Database identifiers, URLs, authentication rules, external browser controls and platform-generated emails are not changed by editing a label.

### Text & Appearance > Colours & styles

Set light/dark colours, body/heading fonts, card/button corners, base font size, spacing, sidebar/content widths and card shadows. Preview locally, Revert preview, then Publish appearance. Advanced CSS supports further layout/visual changes without editing files, with no external URLs/imports/scripts.

If saved CSS hides a control, open your site with ?safeAppearance=1#admin. This bypasses the custom appearance only; administrator login is still required. Open Colours & styles, reset the appearance draft, and publish. Return to the normal URL to see the saved result.

Presentation edits apply to the publishing browser immediately and to other visitors when they reload/open the site. This does not force a page refresh during someone else's active quiz.

### Branding Settings and existing features

Site name, logo/browser icon, default watermark and sign-up examples remain in Branding Settings. Mission, founders, contributors and support contacts remain in About. Download Settings controls the access-code requirement and lets you change the access code. Registered-user details, disabling/deleting accounts, subjects, statistics, account-specific progress, password recovery and dismissible audio are included.

PDF watermarks apply to new/replacement uploads. Existing downloaded files and stamped PDFs are not rewritten by a settings change. Changing a site name does not change the domain or the database project.

## Quiz setup and randomized quizzes

Before starting, the student chooses the number of questions (1 up to the available total) and the time limit (1–180 minutes). The timer starts on Begin quiz and auto-submits at expiry. Results count only the chosen questions. Cancel closes setup without starting an attempt. Setup wording is editable in Text & Appearance under Quizzes / Attempt setup.

Every new attempt shuffles a COPY of that quiz's question bank. Retaking a quiz with at least two questions uses a different order from the last attempt. The same question does not repeat within an attempt. The original bank, answer choices and correct-answer indices stay aligned. A one-question quiz naturally has only one possible question order. Randomization works for built-in, older, personal and current shared quizzes. Existing attempts/results are retained.

## New project instead of an existing one

The included public connection currently points to your existing Supabase project. For a different project, change the public URL/key in dist/js/backend.js and the project reference in the deploy command/config.toml. Run the same COMPLETE-INSTALL-OR-UPGRADE.sql once. Configure Supabase Authentication site/redirect URLs for your actual website. Register and confirm an app account, then follow supabase/grant-admin.sql with that account's exact email. Never put a service-role/secret key in browser JavaScript.

## Local preview and tests

Open dist/index.html using VS Code Live Server (port 5500) or run:

```bash
python -m http.server 8080 --directory dist
```

Visit http://localhost:8080. Do not open the HTML with file://. Supabase functions must already be deployed for login/download/user-management actions. Keep your actual domain and localhost origin in LEXAMAH_ALLOWED_ORIGINS if you use a custom origin list in function secrets.

Optional developer checks require a current Node.js version (Node 24 was used):

```bash
npm run check
npm test
```

The app itself is buildless and uses bundled PDF libraries. Tests covered existing workflows, admin boundaries, shared sample edits, private account isolation, copy/CSS safety, randomized retakes and answer alignment. Browser QA used mock data to exercise a Contract quiz edit, updated correct-answer scoring, text publication and style publication. The complete SQL was checked in local PostgreSQL, with pgcrypto extension loading excluded because that local WASM engine does not bundle OpenSSL; your Supabase deployment still needs the SQL and function steps above.
