# LexAmah

An organized vanilla HTML/CSS/JavaScript law-study workspace.

## Current features

- Separate signup and username/password login pages.
- Signup fields: full name, email, institution, level, username and password.
- Materials and lecture notes with code-protected download buttons.
- Audio-only Lecture Recordings uploaded through Admin Dashboard.
- Dashboard Play buttons and a persistent audio player.
- Timed quizzes that move to the next question when an answer is selected; the final answer submits the quiz.
- Flashcards, study timer, notes, progress, backups and shared admin content management.

## Start in VS Code

Open this folder and serve `dist/index.html` with Live Server. No build or npm installation is needed for the frontend.

```bash
python -m http.server 8080 --directory dist
```

Then open http://localhost:8080.

## Activate Supabase

Follow `docs/SETUP.md`. The latest database SQL and two Edge Functions must be deployed for username login and protected downloads to work. Your earlier project URL and public key are already configured.

## Source structure

| Location | Purpose |
| --- | --- |
| dist/index.html | Application shell and persistent audio player |
| dist/css/styles.css | Responsive layout and appearance |
| dist/js/app.js | Views, routing, registration and quizzes |
| dist/js/backend.js | Supabase adapter |
| dist/js/admin.js | Shared content management |
| dist/js/audio.js | Recording playback |
| dist/js/downloads.js | Access-code download flow |
| dist/js/store.js | Browser state and backups |
| dist/js/data.js | Orientation guides and questions |
| supabase/setup.sql | Complete database setup |
| supabase/updates.sql | Upgrade an existing LexAmah database |
| supabase/functions/account-login | Server-side username authentication |
| supabase/functions/content-download | Server-side code check and signed downloads |

`npm run check` validates browser module syntax. `npm test` runs the mocked workflow tests (Node.js 24 for the TypeScript Edge Function tests).
