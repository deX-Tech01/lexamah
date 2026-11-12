# Watermark controls in the admin upload form

This partial update includes the earlier automatic-watermark feature plus its new controls. Preserve index.html, data.js, your favicon/logo, accounts, existing uploaded files and all other project files.

## Copy into the existing project

Replace matching files:
- dist/js/admin.js
- dist/js/backend.js
- dist/js/watermark.js (add it if the previous watermark update was not installed)
- dist/css/styles.css

Add:
- dist/js/watermark-controls.js
- dist/vendor/pdf-lib/ (the complete folder, including the license; replace matching copies if already installed)

No SQL migration, Supabase function deployment, email service or app rebuild is required. This update assumes the previous account-security/document-reader update is installed, including dist/vendor/pdfjs for actual document previews.

## Use the dashboard

Open Admin Dashboard > Materials or Lecture Notes > Add/Edit. Select a new or replacement PDF/JPG/PNG document. Under Automatic watermark:

- Choose Text or Logo / image. Text defaults to LexAmah; you can enter up to 60 plain English letters/numbers/punctuation. Logos accept PNG/JPG up to 2 MB; transparent PNG is recommended. Choose the logo file for each upload where you want to use one.
- Choose a placement preset (centre, top/bottom centre or any corner).
- Adjust Horizontal position and Vertical position from 0–100% for a custom position, measured from the top left.
- Adjust Size from 5–90% of the visible page width. This is a percentage, not a font-point size. Oversized marks are fitted inside the page while preserving their proportions.
- Adjust Opacity from 1–100%, and Rotation from -90 to +90 degrees. Use 0 for a horizontal watermark/logo.
- The illustrative sample updates as you change controls. It is a placement guide, not your uploaded page.
- Press Preview first page of selected file for a rendered first-page preview using the actual generated document. If you change settings afterward, update the preview. Previewing uploads nothing.
- Publish/Save to embed those settings on every page and upload the resulting PDF.

Settings apply to the current upload form. They are not a global setting that rewrites old documents. Existing attachments are unchanged until you replace them by uploading their original file again. Do not use an already watermarked copy unless an additional stamp is intended. The watermark becomes part of the reading and downloaded file. Watermarking is not DRM.

PDFs retain text and page geometry. JPG/PNG input documents become PDFs. Export Word/text documents as PDF first to preserve their layout. The previous 50 MB document limit and encrypted/corrupt-file checks remain. File-processing errors do not fall back to uploading an unwatermarked original. A PDF modification may invalidate an existing digital signature.

## Publish to Vercel

Run in your existing full website project:

```bash
cd ~/Downloads/LexAmah-updated/LexAmah
git add dist/js/admin.js dist/js/backend.js dist/js/watermark.js dist/js/watermark-controls.js dist/css/styles.css dist/vendor/pdf-lib
git commit -m "Add watermark text logo placement size and opacity controls"
git push
```

Wait for Vercel to finish, then refresh with Ctrl + Shift + R. Test a small document first.

## Verification

JavaScript syntax checks and all automated application tests passed. Additional tests verified text/logo selection, custom text, logo embedding on each page, size/opacity validation, and positioning at all page corners for 0/90/180/270-degree page rotations. Generated custom PDFs were checked for watermark text on every page and the requested 65% opacity. A sample was rendered and visually inspected. The form's actual browser interactions and an authenticated live Supabase upload still need a check on your deployed website; no real uploaded material was changed here.
