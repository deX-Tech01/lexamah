# Automatic upload watermarks

This is a partial update for the existing LexAmah project. It preserves your accounts, uploaded content, index.html, favicon/logo, Supabase configuration and audio-player close button.

## Copy the files

Replace:
- dist/js/admin.js
- dist/js/backend.js

Add:
- dist/js/watermark.js
- dist/vendor/pdf-lib/pdf-lib.min.js
- dist/vendor/pdf-lib/LICENSE.md

Copy these into the matching folders inside your existing LexAmah-updated/LexAmah project. Both replaced JavaScript files must be copied together with the new module and vendor folder.

## Publish

From the existing project folder in VS Code Git Bash:

```bash
cd ~/Downloads/LexAmah-updated/LexAmah
git add dist/js/admin.js dist/js/backend.js dist/js/watermark.js dist/vendor/pdf-lib
git commit -m "Watermark uploaded materials and lecture notes"
git push
```

Wait for Vercel to show Ready. Refresh the live website with Ctrl + Shift + R. No Supabase SQL, Edge Function deployment, email setup or native app rebuild is needed. Existing native app wrappers load the updated live website.

## Use it

Open Admin Dashboard > Materials or Lecture Notes > Add/Edit. Upload a PDF, JPG or PNG. The form displays Automatic watermark text, initially LexAmah; change it if desired (up to 60 plain English letters, numbers or punctuation). There is no opt-out toggle: every new/replacement attachment in these two sections is stamped.

When publishing, a light diagonal watermark is drawn on every PDF page, then that transformed PDF is uploaded. The form shows processing/upload progress. JPG/PNG files are put onto one PDF page and stamped; they are saved as PDF. Portrait, landscape, rotation and cropped-page geometry are retained. PDFs keep their uploaded filenames exactly. Images keep their base filename and use the .pdf extension after conversion. The original file on your computer is not modified. The watermark is part of the file, so it appears in both the document reader and downloaded copies.

To preserve Word layout, export DOCX or TXT documents to PDF before upload. These formats are not silently converted or uploaded without a watermark. Cases and audio uploads keep their existing formats/behavior. New uploads are limited to 50 MB, and the transformed output must also fit that limit. Corrupt/empty files and password-protected PDFs are rejected with a message; processing failures do not upload an unwatermarked original. Unlock a legitimate PDF copy before uploading it. As with any PDF modification, watermarking can invalidate an existing digital signature.

Existing attachments are not automatically rewritten. To watermark a pre-existing material, Edit it and upload the original document again as the replacement attachment. Merely editing its title/description does not reprocess its attachment. Written body text and external reference URLs are not uploaded document pages and are not stamped. Avoid reuploading an already stamped copy unless another stamp is intended. The watermark is visible branding; it is not copy protection or DRM.

## Verification

All existing automated tests and new watermark tests passed. Tests verified all-page stamping, portrait/landscape/rotation/crop preservation, image-to-PDF conversion, filename/MIME reporting, unsupported/corrupt/empty-file rejection, and that only transformed bytes reach the upload request. Extracted text confirmed both original text and LexAmah on each page. Portrait and rotated sample pages were rendered and visually inspected. Browser visual QA and a live authenticated Supabase upload were not performed here; try one small PDF on the live admin dashboard before a large batch.

Implementation: locally bundled pdf-lib 1.17.1 (MIT); its license is included. No third-party document-upload service is used.
