# Safe deploy: production database & Git

This doc explains **how your production database is chosen** and how to **avoid pushing or overwriting live customer data** by mistake.

---

## Stakeholder release notes (this deploy)

Use these bullets in release notes or with your team:

- **Membership + services on one bill:** When someone buys a new membership on the same invoice as services or products, they pay **only the membership (plus tax)**. Today’s service/product amounts are **applied to the new membership wallet** (balance and usage update automatically).
- **Memberships list:** Balances and “uses” reflect **remaining balance** after those same-day deductions; the page **refreshes** when you return to the tab so numbers stay current.
- **Dashboard & reports:** Updates to daily views, IST-based dates, and report layout (details depend on your merged branch).
- **Invoices & catalog:** Searchable pickers and clearer invoice list behaviour where implemented.
- **Email / PDF (if enabled):** Optional paid-invoice email and PDF attachment use env vars from the host dashboard—**not** from Git.

---

## How the app picks the database (important)

- The Node server reads **`process.env.DATABASE_URL`** (see `server/database.js`).
- That value comes from **`server/.env` on your machine** (local dev) or from **environment variables on Render / Railway / your VPS** (production).
- **Git does not deploy your laptop’s `.env`.** The file `server/.env` is **gitignored** (see `.gitignore`). Pushing `main` only pushes **code**; production still uses whatever **`DATABASE_URL`** you set in the hosting UI.

So: **merging to `main` does not copy local Postgres data into prod.** Production only talks to the DB whose URL is configured **on the server**.

---

## Before you merge to `main` or deploy

1. **Confirm production env on the host (Render → Environment, etc.)**  
   - `DATABASE_URL` = **Internal** Postgres URL from **that** project’s database (not your home IP, not `localhost` from your laptop).  
   - `NODE_ENV` = `production`  
   - `JWT_SECRET` = strong random string (not the repo default).

2. **Never `git add -f server/.env`**  
   If `.env` ever appears in `git status` as *staged*, undo it before committing.

3. **Sanity check what you’re about to commit**  
   ```bash
   git diff --stat
   git ls-files | grep '\.env$' || true
   ```  
   You should **not** see `server/.env` in tracked files (only `*.env.example` if you explicitly track templates).

4. **Migrations / one-off scripts**  
   Anything you run locally with `DATABASE_URL` in `server/.env` hits **that** database. If you temporarily paste the **production** URL into local `.env` to debug, **every migration and script targets production** until you change it back. Prefer: run migrations from the host **Shell** with prod env, or use a dedicated ops machine.

5. **After deploy**  
   Open **`/api/health`** on the production URL. It should report DB connected. If you use Render, follow `docs/RENDER_DEPLOY.md` for migrations.

---

## If production warns about localhost

If the server logs a warning that **`DATABASE_URL` looks like localhost while `NODE_ENV=production`**, your production app is misconfigured: fix **`DATABASE_URL`** in the hosting dashboard to the **hosted** PostgreSQL URL.

---

## Related docs

- `docs/RENDER_DEPLOY.md` — Render + `DATABASE_URL` setup  
- `docs/DEPLOYMENT.md` — General checklist before going live  
