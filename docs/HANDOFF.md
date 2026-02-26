# Project Handoff

## Current Goal
- Keep admin and client experiences separated and stable.
- Keep UI compact by default across current and future pages.

## Canonical URLs
- Client home: `https://footnote-wizard-2.vercel.app/`
- Admin home (login screen): `https://footnote-wizard-2.vercel.app/admin`

## Current Admin Behavior
- `/admin` opens the admin login screen (manager code required).
- Successful login opens the admin management interface.
- "Logout" returns to the admin home/login screen (`/admin`).

## Leads System Status
- Leads are saved through `/api/leads` and stored in Vercel KV.
- Admin leads tab loads real leads from `/api/leads`.
- CSV export in admin is based on real leads.

## UI Sizing Policy
- Compact UI is the default.
- Shared layout was tightened (`max-w-6xl`, reduced paddings/header height).
- Major pages were compacted (Home, Other Products, Torah Covers, Script Detail, Product Detail).

## Recent Important Commits
- `3f39b1f` compact layout across current and future pages
- `1d89106` compact and centered other-products page
- `917c181` compact homepage hero sizing
- `d19eac0` restore admin login screen/logout behavior

## Next-Step Checklist
- Verify production deploy is complete in Vercel.
- Hard refresh (`Ctrl+F5`) and validate:
  - `/admin` always stays in admin flow
  - Client pages render compactly at 100% zoom
  - Leads submitted from trial modal appear in admin leads

## Notes for Next Agent
- Read this file first before making changes.
- Keep commit messages concise and consistent with repository style.
- Unless user says otherwise, validate quickly (build/lint), then commit and push.
