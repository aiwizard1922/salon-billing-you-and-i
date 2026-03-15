# Deploy Salon Billing on Render (billing.uandisalon.in)

Step-by-step guide for **combined** deployment: one Web Service runs both the React app and the API.

---

## Before You Start

- [ ] GitHub repo: `salon-billing-you-and-i` (code pushed)
- [ ] Render account: [render.com](https://render.com)
- [ ] Domain: `uandisalon.in` (managed in Hostinger)

---

## Step 1: Create PostgreSQL Database

1. Log in to [Render Dashboard](https://dashboard.render.com)
2. **New** → **PostgreSQL**
3. Name: `salon-billing-db`
4. Region: **Singapore** (closest to India)
5. Plan: **Free** or **Starter**
6. Click **Create Database**
7. When ready, copy the **Internal Database URL** (starts with `postgresql://`)

---

## Step 2: Create Web Service

1. **New** → **Web Service**
2. Connect your GitHub repo → select `salon-billing-you-and-i`
3. Use these settings:

| Field | Value |
|-------|-------|
| **Name** | `salon-billing` |
| **Region** | Singapore |
| **Branch** | `main` |
| **Root Directory** | *(leave blank)* |
| **Runtime** | Node |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm start` |

4. Instance type: **Free** or **Starter**

---

## Step 3: Add Environment Variables

In **Environment** → **Environment Variables**, add:

| Key | Value |
|-----|-------|
| `DATABASE_URL` | *(paste Internal Database URL from Step 1)* |
| `JWT_SECRET` | *(generate: run `openssl rand -hex 32` in terminal)* |
| `NODE_ENV` | `production` |
| `BUSINESS_NAME` | Your salon name (e.g. `You and I Salon`) |
| `BUSINESS_ADDRESS` | Your address |
| `BUSINESS_PHONE` | Your phone |
| `BUSINESS_EMAIL` | Your email |

**Optional (WhatsApp):**

| Key | Value |
|-----|-------|
| `WA_PHONE_NUMBER_ID` | From Meta Developers |
| `WA_ACCESS_TOKEN` | From Meta Developers |
| `WA_BILL_TEMPLATE` | `payment_successful` or `invoice_bill` |

5. Click **Create Web Service**

---

## Step 4: Wait for First Deploy

- Render will install deps, build the React app, and start the server
- First deploy can take 3–5 minutes
- After success, you’ll see a URL like `https://salon-billing-xxxx.onrender.com`

---

## Step 5: Run Database Migrations (required)

The database starts empty. You must run migrations to create tables.

1. In your Render Web Service → click **Shell** (top right)
2. Run:
   ```bash
   cd server && node run-all-migrations.js
   ```
3. You should see `✓` for each migration and "All migrations applied successfully."
4. If you see any error, check that `DATABASE_URL` is set correctly

Then refresh the app – you should see the login page. Default login: `admin` / `admin123`.

---

## Step 6: Add Custom Domain (billing.uandisalon.in)

1. In your Render Web Service → **Settings** → **Custom Domains**
2. Click **Add Custom Domain**
3. Enter: `billing.uandisalon.in`
4. Render will show:
   - **Type:** CNAME  
   - **Name:** `billing`  
   - **Value:** `salon-billing-xxxx.onrender.com` (use your actual host)

---

## Step 6: Update DNS in Hostinger

1. Log in to [Hostinger](https://www.hostinger.com)
2. **Domains** → **uandisalon.in** → **Manage** → **DNS / Nameservers**
3. Add **CNAME** record:

   | Type | Name | Value | TTL |
   |------|------|-------|-----|
   | CNAME | billing | salon-billing-xxxx.onrender.com | 3600 |

   Replace `salon-billing-xxxx.onrender.com` with the value from Render.

4. Save
5. Wait 5–30 minutes for DNS to propagate

---

## Step 7: Verify HTTPS

- Render provisions an SSL certificate automatically
- After DNS propagates, open `https://billing.uandisalon.in` and confirm the green padlock

---

## Run Migrations (First-Time Setup)

On first deploy, run migrations via **Shell**:

1. Render Dashboard → your Web Service → **Shell** (top right)
2. Run:

```bash
cd server
node run-migration-010.js
node run-migration-011.js
node run-migration-012.js
node run-migration-013.js
```

3. Or, if you have `add-admins` migration, run that to add your admin user

---

## Change Default Password

**Important:** Change the default `admin` / `admin123`:

1. Use the `add-admins` migration to create your admin, or
2. Log in and update the password via the app (if that feature exists), or
3. Update directly in the database

---

## Troubleshooting

| Issue | What to do |
|-------|------------|
| Build fails | Check **Logs** → Build section for errors |
| "Application failed to respond" | Ensure `PORT` is used (Render sets it automatically) |
| "Database connection failed" | Verify `DATABASE_URL`, use **Internal Database URL** for same-region service |
| Login fails | Confirm migrations ran and admin exists |

---

## Summary

| Step | Action |
|------|--------|
| 1 | Create PostgreSQL on Render |
| 2 | Create Web Service from GitHub |
| 3 | Set env vars (especially `DATABASE_URL`, `JWT_SECRET`) |
| 4 | Let first deploy complete |
| 5 | Add `billing.uandisalon.in` as custom domain in Render |
| 6 | Add CNAME in Hostinger DNS |
| 7 | Run migrations in Shell |

**Live URL:** https://billing.uandisalon.in
