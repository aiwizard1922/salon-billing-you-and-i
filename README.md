# Salon Billing Software

Standalone salon billing app with **React** frontend, **Node.js** backend, **PostgreSQL** database, and **WhatsApp** automation.

---

## Project Structure

```
salon-billing/
├── client/          # React (Vite) frontend
├── server/          # Node.js (Express) API
├── README.md
```

---

## Prerequisites

- Node.js 18+
- PostgreSQL
- WhatsApp Business API credentials (optional – app works without it)

---

## Setup

### 1. PostgreSQL Database

```bash
createdb salon_db
psql salon_db < server/db/schema.sql
```

**Existing database?** Add login support with:
```bash
psql salon_db < server/db/migrations/add-admins.sql
```

**Staff, Memberships, Client insights:**
```bash
psql salon_db < server/db/migrations/001-staff-memberships-clients.sql
```

### 2. Backend

```bash
cd server
npm install
```

Create `server/.env`:

```
PORT=3001
DATABASE_URL=postgresql://user:password@localhost:5432/salon_db

# Business (for Indian GST Tax Invoice)
BUSINESS_NAME=Your Salon Name
BUSINESS_ADDRESS=Your address, City, State - Pincode
BUSINESS_GSTIN=99XXXXXXX9X1Z5
BUSINESS_STATE=Your State

# WhatsApp (optional - get from Meta Developer Console)
WA_PHONE_NUMBER_ID=your_phone_number_id
WA_ACCESS_TOKEN=your_access_token
```

Start the API:

```bash
npm start
```

### 3. Frontend

```bash
cd client
npm install
npm run dev
```

Open http://localhost:5173

You'll see the **login page**. Sign in with:
- **Username:** `admin`
- **Password:** `admin123`

(Change this password in production; the default admin is created automatically on first API start.)

---

## Features

| Feature | Description |
|---------|-------------|
| **Customers** | Add and manage customers with gender (phone required for WhatsApp) |
| **Invoices** | Create invoices with services, tax, print, mark paid |
| **Appointments** | Book appointments (sends WhatsApp confirmation) |
| **Staff** | Manage staff (name, role, join date, contact details) |
| **Memberships** | Create plans (e.g. Gold, Monthly), assign to customers, track active/expired |
| **Clients** | Client insights: visits this month, new vs returning, gender breakdown (men/women) |
| **Login** | Username/password auth – redirects to dashboard on success |
| **WhatsApp** | Appointment confirmation, payment receipt, and **bulk marketing** messages |
| **Marketing** | Send bulk promotions, ads, offers to customers via WhatsApp (uses {{name}} for personalization) |
| **Reports** | Daily sales chart, monthly sales & profit charts (profit estimated from configurable margin %) |

---

## WhatsApp Setup

1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Create an app → Add **WhatsApp** product
3. Get **Phone Number ID** and **Access Token**
4. Add to `server/.env`:
   - `WA_PHONE_NUMBER_ID`
   - `WA_ACCESS_TOKEN`

The app runs without WhatsApp – messages are logged but not sent until configured.

---

## Scripts

| Command | Location | Description |
|---------|----------|-------------|
| `npm run dev` | client | Start React dev server (port 5173) |
| `npm run build` | client | Build for production |
| `npm start` | server | Start API (port 3001) |

---

## Tech Stack

- **Frontend:** React 19, Vite, Tailwind CSS v4, React Router
- **Backend:** Node.js, Express
- **Database:** PostgreSQL
- **WhatsApp:** Meta Cloud API
