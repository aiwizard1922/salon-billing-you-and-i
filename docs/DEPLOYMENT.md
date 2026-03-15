# Deploy Salon Billing on Your Domain

This guide explains how to deploy the salon billing app on a **subdomain** of your existing domain (e.g. `billing.yourdomain.com`).

---

## Option 1: Railway (Recommended – Easiest)

Railway supports Node.js + PostgreSQL in one place and gives you a URL. You can point your subdomain to it.

### Step 1: Create Railway Account

1. Go to [railway.app](https://railway.app) and sign up (free tier available)
2. Create a new project

### Step 2: Add PostgreSQL

1. In your project, click **Add Service** → **Database** → **PostgreSQL**
2. Railway will create a database and set `DATABASE_URL`
3. Copy the `DATABASE_URL` for later

### Step 3: Deploy from GitHub

1. Click **Add Service** → **GitHub Repo**
2. Connect your repo and select the project
3. Set the **Root Directory** to `.` (project root)

### Step 4: Configure Build

In **Settings** → **Deploy**:

- **Build Command:** `npm run build`
- **Start Command:** `npm start`
- **Watch Paths:** `client/`, `server/`, `package.json`

### Step 5: Set Environment Variables

In **Variables**, add:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | (Usually auto-set by PostgreSQL service) |
| `JWT_SECRET` | A long random string (e.g. generate with `openssl rand -hex 32`) |
| `PORT` | `3001` (or leave default) |
| `NODE_ENV` | `production` |
| `WA_PHONE_NUMBER_ID` | WhatsApp Phone Number ID (optional) |
| `WA_ACCESS_TOKEN` | WhatsApp Access Token (optional) |
| `WA_BILL_TEMPLATE` | `payment_successful` or `invoice_bill` (optional) |
| `BUSINESS_NAME` | Your salon name |
| `BUSINESS_ADDRESS` | Your address |
| `BUSINESS_PHONE` | Your phone |
| `BUSINESS_EMAIL` | Your email |
| `BUSINESS_GSTIN` | GST number if applicable |

### Step 6: Add Custom Domain (Subdomain)

1. In your Railway service, go to **Settings** → **Networking**
2. Click **Generate Domain** (you get something like `xxx.up.railway.app`)
3. Click **Custom Domain** → add `billing.yourdomain.com`
4. Railway will show you a **CNAME** target (e.g. `xxx.up.railway.app`)

### Step 7: DNS Setup

In your domain registrar (GoDaddy, Namecheap, Cloudflare, etc.):

1. Add a **CNAME** record:
   - **Name:** `billing` (or `salon`, `app`, etc.)
   - **Target:** The CNAME value Railway gave you (e.g. `xxx.up.railway.app`)
   - **TTL:** 300 or Auto

2. Wait 5–15 minutes for DNS to propagate

---

## Option 2: Render

Similar to Railway. Free tier available.

### Step 1: Create Account

1. Go to [render.com](https://render.com) and sign up
2. Create a **Web Service** from GitHub

### Step 2: Add PostgreSQL

1. Create **PostgreSQL** from the dashboard
2. Copy **Internal Database URL** (use this as `DATABASE_URL`)

### Step 3: Web Service Settings

- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm start`

### Step 4: Custom Domain

1. **Settings** → **Custom Domains** → add `billing.yourdomain.com`
2. Render will show CNAME instructions
3. Add the CNAME in your DNS provider

---

## Option 3: VPS (DigitalOcean, Linode, etc.)

If you already have a VPS or prefer full control:

### Prerequisites

- Ubuntu 22.04 server
- Domain pointing to server IP (A record for subdomain)

### Commands (run on server)

```bash
# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Create database and user
sudo -u postgres psql -c "CREATE USER salon WITH PASSWORD 'your-secure-password';"
sudo -u postgres psql -c "CREATE DATABASE salon_billing OWNER salon;"

# Clone and build
git clone https://github.com/your-username/salon-billing-you-and-i.git
cd salon-billing-you-and-i

npm install
npm run build

# Create .env in server/
echo "DATABASE_URL=postgresql://salon:your-secure-password@localhost:5432/salon_billing
JWT_SECRET=$(openssl rand -hex 32)
NODE_ENV=production" > server/.env
```

### Run with PM2 (keeps it running)

```bash
sudo npm install -g pm2
cd server && pm2 start server.js --name salon-billing
pm2 save && pm2 startup
```

### Nginx (for HTTPS)

```nginx
server {
    listen 80;
    server_name billing.yourdomain.com;
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Then add SSL with Certbot:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d billing.yourdomain.com
```

---

## Database Migrations

On first deploy, run migrations if you have any:

```bash
cd server
# Run migration scripts if needed (check server/run-migration-*.js)
node run-migration-010.js
# etc.
```

Railway and Render can run these as **one-off** commands from the dashboard.

---

## Backup (Production)

Set up the daily backup script (see `scripts/backup-db.sh` and `docs/WHATSAPP_SETUP.md`):

```bash
# Cron example (run daily at 2 AM)
0 2 * * * /path/to/salon-billing-you-and-i/scripts/backup-db.sh
```

---

## Checklist Before Going Live

- [ ] `JWT_SECRET` is a strong random value (not the default)
- [ ] `DATABASE_URL` is correct and reachable
- [ ] Default admin password changed (or use `add-admins` migration)
- [ ] CNAME for subdomain points to your host
- [ ] HTTPS enabled (Railway/Render do this automatically)
- [ ] WhatsApp env vars set if you use invoice WhatsApp
