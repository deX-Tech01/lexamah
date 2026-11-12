# Add the About LexAmah page

Copy only the files included in this update into the matching locations in your existing LexAmah project:

- Add dist/js/about.js.
- Replace dist/js/app.js, dist/js/admin.js and dist/js/backend.js.
- Replace dist/css/styles.css.
- Run supabase/about.sql in Supabase SQL Editor.

Keep your existing data.js, index.html, subjects.js and Edge Functions. Preserve your own Supabase URL/public key if you changed the defaults in backend.js.

Refresh the website and open Admin Dashboard > About LexAmah. Enter the mission, add founder names and bios, upload their portraits or paste HTTPS picture URLs, and list contributors one per line. Select Publish changes. Visitors can open About LexAmah from the main navigation.

The update does not invent founder identities or biographies. Profile images are public JPG/PNG/WebP uploads up to 5 MB. Replaced images remain in Storage until you delete them from lexamah-portraits.

Run the launch checks in docs/SETUP.md of the complete project. In particular, test a regular student's account and permissions, downloads, audio and quizzes; configure your final origin/redirect URLs; add privacy/support information and password recovery before a wider launch.

Code and mocked tests pass. Live SQL installation and founder-photo uploads still require your authenticated Supabase project. Visual browser QA was unavailable.
