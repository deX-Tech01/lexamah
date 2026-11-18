# PDF reader, Share Tips and Admin Team

## Update an existing LexAmah project

1. Open **SQL Editor → New query** in the existing Supabase project used by your website. Paste the entire contents of **`supabase/share-tips-assistants-update.sql`** and click **Run** once. It preserves existing accounts, uploads, posts and settings. If installing from the full project instead, **`supabase/COMPLETE-INSTALL-OR-UPGRADE.sql`** already includes this migration.
2. Extract the update ZIP and copy its `dist`, `supabase` and `docs` folders into your existing Git project folder. Merge the folders and replace the matching files. Keep your existing `.git` folder and other app files.
3. In Git Bash or VS Code's terminal, from that same project folder, run:

   ```bash
   git add dist supabase docs
   git commit -m "Update PDF reader, Share Tips and admin team"
   git push
   ```

4. Wait for Vercel to finish deploying, then refresh the website. No Supabase Edge Function redeployment is needed for this update.

## Use the new features

- **Read notes:** Opens the PDF in a full-screen reader. Scroll through all pages, pinch with two fingers to zoom and drag to pan. Previous/Next, +/−, Fit width and Fit page also work on desktop. The existing download button and access-code settings are separate.
- **Admin Dashboard → Share Tips:** Set the section name, check **Show this section to students**, and select **Save settings**. It starts off. Signed-in students can view and share text tips under their registered usernames, like once per post, and comment. Open a post under **Manage posts** to delete it or moderate comments. Turning the section off hides it and blocks student access without deleting its content. The feed serves ten previews per page and fetches comments only when a post is opened. Student tips do not use file storage.
- **Admin Dashboard → Admin Team:** Enter the username of an existing active, confirmed account, then select **Add assistant**. The assistant can reopen the site to see **Content Desk**, where they can publish and manage their own uploaded materials, notes, recordings, cases and flashcards. They cannot change staff, accounts, site settings, quizzes or other people's uploads. Select **Dismiss assistant** to remove their permissions. Their student account and published resources stay.
- The two concurrent staff sessions are shared between the main admin and assistants. Only one assistant can occupy a slot at once, leaving room for the main admin. If both staff slots are in use, another staff member can still use the student pages while waiting for a slot.

The first deployment still needs the SQL step to offer the two new database-backed features. The reader works with your existing document viewing function.
