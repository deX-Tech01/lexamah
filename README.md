# LexAmah — complete admin-editable website

Start with [START-HERE.md](START-HERE.md). It explains the single combined Supabase SQL file, all-functions deployment and updating your existing Git/Vercel project.

The full project includes the earlier website updates plus shared sample/legacy content editing, a searchable interface text editor, appearance previews/publishing and randomized quiz retakes.

Structure:

- dist/: deployable static website and bundled PDF tools
- supabase/COMPLETE-INSTALL-OR-UPGRADE.sql: one database install/upgrade script
- supabase/functions/: all server handlers
- docs/: earlier feature guides and reference instructions (use START-HERE.md for this complete release)
- tests/: workflow and security-boundary checks
- scripts/: project checks and deployment helper

Public presentation can be edited by the admin. Internal identifiers, account ownership and authorization remain controlled by the application and Supabase policies.
