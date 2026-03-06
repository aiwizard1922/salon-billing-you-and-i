# GemGlow Studio

Jewelry e-commerce – React, Node.js, PostgreSQL, Razorpay.

## Local setup (PostgreSQL)

### 1. Install PostgreSQL
```bash
brew install postgresql@16
brew services start postgresql@16
```

### 2. Create database
```bash
createdb gemglow
```

### 3. Configure
```bash
cp .env.example .env
```
Edit `.env`:
```
DATABASE_URL=postgresql://localhost:5432/gemglow
```
(If you set a postgres password, use: `postgresql://user:password@localhost:5432/gemglow`)

### 4. Run
```bash
npm install
npm run dev
```

- App: http://localhost:5173
- API: http://localhost:5000

Sample products are added automatically on first run.

## Make yourself admin

After signing up, run in `psql gemglow`:
```sql
UPDATE users SET role = 'admin' WHERE email = 'your@email.com';
```
