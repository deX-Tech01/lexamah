# Choose quiz question count and time limit

Before every quiz, users can choose 1 up to the available number of questions, and a time limit of 1–180 whole minutes. All available questions and the existing quiz time limit are the defaults. The countdown begins only when Begin quiz is pressed.

The chosen subset is random, contains no duplicates and remains fixed during that attempt. Retakes use a different order when possible. A single-question attempt can pick a different question if the bank contains more than one. Answer choices and correct answers remain aligned. Results and saved attempts use only the chosen question count. Time expiry automatically submits the selected subset; unanswered questions count as incorrect.

## Install on the latest full LexAmah project

Copy the matching files from this ZIP into your EXISTING project root, merging folders:

- Replace dist/js/app.js.
- Replace dist/js/copy-catalog.js.
- Replace dist/js/quiz-order.js (included dependency; behaviour retained).
- Add dist/js/quiz-setup.js.
- Optional: copy docs/QUIZ-SETUP-UPDATE.md.

Do not replace index.html, your favicon, logo assets, backend connection or other folders. No SQL or Edge Function deployment is required for this quiz update. It assumes you already use the full project containing Text & Appearance and Branding Settings.

From the existing Git project root:

```bash
git add dist/js/app.js dist/js/copy-catalog.js dist/js/quiz-order.js dist/js/quiz-setup.js docs/QUIZ-SETUP-UPDATE.md
git commit -m "Add quiz question count and time selection"
git push
```

Wait for Vercel deployment, then refresh with Ctrl+Shift+R. Click Start quiz, enter the question count and minutes, then Begin quiz. Setup labels are editable in Admin Dashboard > Text & Appearance > Quizzes / Attempt setup.

If you use the accompanying updated FULL project instead, follow its START-HERE.md for initial installation. If your previous full version is already installed and working, you only need the four JavaScript files listed above.

Validation: all project checks passed. Workflow tests verify custom timers, selected counts, out-of-range input rejection, automatic expiry submission and prevention of duplicate results. Browser QA using a mock signed-in student verified a two-question, three-minute attempt and a result out of two.
