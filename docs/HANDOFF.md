# Project Handoff

## Current Goal
- Keep admin and client experiences separated and stable.
- Keep UI compact by default across current and future pages.
- New: allow managing a dedicated Promotions page from admin.

## Canonical URLs
- Client home: `https://footnote-wizard-2.vercel.app/`
- Admin home (login screen): `https://footnote-wizard-2.vercel.app/admin`

## Current Admin Behavior
- `/admin` opens the admin login screen (manager code required).
- Successful login opens the admin management interface.
- "Logout" returns to the admin home/login screen (`/admin`).

## Site visit counter
- `GET/POST /api/visits` stores a running total in Vercel KV key `site_visits_total`.
- Home page (`/`) POSTs once per visit (with a short debounce for React Strict Mode); shows **"כניסות נרשמו לאתר"** at the top when the count loads.
- **Owner device:** Admin toolbar button **"סמן מכשיר זה: אל תספור את הכניסות שלי"** sets `localStorage` (`fw_owner_skip_visit_count`); on that browser Home only **GET**s the count (no POST bump). Other visitors unchanged.
- Local `npm run dev` uses in-memory counter via `vite.config.ts` middleware (resets on server restart).

## Leads System Status
- Leads are saved through `/api/leads` and stored in Vercel KV.
- Admin leads tab loads real leads from `/api/leads`.
- CSV export in admin is based on real leads.

## Manual Payment Orders Status
- Added `/api/orders` (Vercel KV-backed) with actions:
  - `create` order
  - `status` check by `orderId + customerEmail`
  - `mark-paid` (admin manual approval)
  - `GET /api/orders?adminCode=...` for admin list
- Purchase flow now creates an order first, opens Bit request link, and blocks download until status is `paid`.
- Admin now has an "Orders" tab (`/admin/orders`) to review and approve pending payments.
- Download unlock is server-gated (no more checkbox-based unlock).

## Product copy alignment
- Script/product detail pages and catalog cards use **justified** Hebrew body copy (`text-justify`) for short/long descriptions; `whitespace-pre-line` preserves line breaks from admin textareas.

## Promotions Page (NEW)
- Added client page route: `/promotions` with navbar item **"מבצעים"**.
- Promotions are managed in Admin via a new tab **"מבצעים"** (`/admin/promotions`).
- Each promotion supports the same core fields as scripts plus `bundleScriptLinks` (multiple links, one per line).
- Promotion detail uses the same detail screen and now renders a section of bundle links when `bundleScriptLinks` exists.
- Admin has a toggle for live visibility of promotions page: `siteSettings.promotionsPageVisible`.
- When hidden, `/promotions` and direct promotion detail URLs redirect to Home and nav item is hidden.

## Script guide links
- Each script may include optional `guideUrl` (e.g. Google Drive link to a PDF guide).
- Admin script editor has field **"קישור מדריך (גוגל דרייב / PDF)"**; when set, the script detail page shows **"פתח מדריך (גוגל דרייב)"** directly **under the hero image** (left column).

## UI Sizing Policy
- Compact UI is the default.
- Shared layout was tightened (`max-w-6xl`, reduced paddings/header height).
- Major pages were compacted (Home, Other Products, Torah Covers, Script Detail, Product Detail).

## Recent Important Commits
- `dc61a30` add promotions page with admin bundle management and visibility toggle
- `ba21a2f` fix modal positioning - use Portal so modals render in viewport
- `3f39b1f` compact layout across current and future pages
- `1d89106` compact and centered other-products page
- `917c181` compact homepage hero sizing
- `d19eac0` restore admin login screen/logout behavior

## Latest Verification (2026-02-26)
- Production URLs respond correctly:
  - `https://footnote-wizard-2.vercel.app/`
  - `https://footnote-wizard-2.vercel.app/admin` (login screen visible)
- Leads API verified in production:
  - `GET /api/leads` returns real data
  - `POST /api/leads` succeeded (smoke test lead created)
  - Follow-up `GET /api/leads` returned the new lead:
    - `id: lead-1772126764422-eigcwjp`
    - `name: Cursor Smoke Test`
    - `email: cursor-smoke-test@example.com`
- Local validation:
  - `npm run build` completed successfully (`vite build`, 0 errors)

## Next-Step Checklist
- [x] Verify production deploy is complete in Vercel (site/API reachable and serving latest behavior).
- [x] Run quick local validation build (`npm run build`).
- [ ] Hard refresh (`Ctrl+F5`) and validate `/admin` full flow end-to-end (login -> management -> logout -> back to `/admin` login).
- [ ] Hard refresh (`Ctrl+F5`) and validate compact layout on key client pages at 100% zoom.
- [ ] Submit a lead from the trial modal in UI and confirm it appears in Admin Leads tab.

## AI Assistant (Gemini)
- The AI assistant calls `/api/ask-assistant` (serverless function) which uses `GEMINI_API_KEY` or `VITE_GEMINI_API_KEY` from Vercel env.
- The API key must be set in Vercel for production. Local dev uses `.env` (VITE_GEMINI_API_KEY or GEMINI_API_KEY).

## Hebrew mark editor (local tool)
- Folder `hebrew-mark-editor/`: Python + tkinter + fonttools GUI to adjust Hebrew mark positions via GPOS Mark-to-Base (`editor.py`, `pip install -r hebrew-mark-editor/requirements.txt`).
- Same folder: `taginim_app.py` — PyQt5 + fonttools + freetype + Pillow to draw and embed classical תגין on Hebrew letters (TrueType `glyf` only); run `run_taginim.bat` or `python taginim_app.py`; settings per font in `<font>.taginim.json`; three-tag list is שעטנז״גץ plus final **nun** (U+05DF) and final **tsadi** (U+05E5); when embedding **shin** (U+05E9), export also targets precomposed shin-dot glyphs U+FB2C/U+FB2D if present in cmap (InDesign often uses those); per-letter checkbox **«להטמיע תגין…»** controls which letters are written into the exported `_taginim` font (default off for new letters; JSON without `embed_in_font` still defaults to on for backward compatibility); **Save** writes next to the source TTF when the folder is writable; if the font was opened from a Windows font install directory (e.g. `AppData\Local\Microsoft\Windows\Fonts`), export goes to Downloads/Desktop/Documents instead (permission denied otherwise); global **single-letter style** copy in `~/.taginim_editor/tagin_style_preset.json` (save from current letter / apply to current letter); global Shaatnez batch preset in `~/.taginim_editor/shaatnez_preset.json`; **מנפה** mode (`square_fan`): three tags = side stems are **flat triangles** (apex `tcx`, straight diagonals, no curves), square caps horizontal; middle straight; 1–2 tags = straight stems + square caps (`_square_fan_stem_half_w`).

## Notes for Next Agent
- Read this file first before making changes.
- Keep commit messages concise and consistent with repository style.
- Unless user says otherwise, validate quickly (build/lint), then commit and push.
- For production hardening, set `ADMIN_PORTAL_CODE` in Vercel env (instead of relying on default fallback).
