# AGENTS.md

## Cursor Cloud specific instructions

**Product:** Footnote Wizard — a Hebrew RTL e-commerce SPA for selling Adobe InDesign automation scripts.

**Tech stack:** React 18 + TypeScript + Vite 5 + Tailwind CSS 3.4 + Framer Motion. Package manager: npm (lockfile: `package-lock.json`).

### Running the app

- `npm run dev` — starts Vite dev server on port 3000 (host `0.0.0.0`).
- `npm run build` — production build via Vite (outputs to `dist/`).
- `npm run preview` — preview the production build.

### Key notes

- **No ESLint or test framework** is configured. The only lint-like check available is `npm run build` which runs TypeScript type-checking through Vite.
- **No backend or database** — pure client-side SPA. Admin data and leads persist in `localStorage`.
- The AI assistant chat uses Google Gemini API (`VITE_GEMINI_API_KEY` in `.env`). The app degrades gracefully if the key is missing or invalid.
- The `/api/update-scripts.ts` file is a Vercel serverless function using `@vercel/kv` — it only runs on Vercel, not locally.
- Client-side routing uses hash-based navigation (e.g., `/#/scripts`, `/#/admin`).
- Admin portal password is `1967`.
