# RouteShield AI — Deployment Guide

This guide describes how to deploy RouteShield AI across **Supabase** (PostgreSQL & Storage), **Render** (Express backend), and **Vercel** (React frontend).

---

## 1. Supabase Setup (Database & Storage)

### Step 1.1: Create Project
1. Log in to [Supabase](https://supabase.com) and create a new project.
2. Note your project database connection string (use **Session Pooler** for IPv4 compatibility with cloud hosts) and your Project API URL and `service_role` secret key.

### Step 1.2: Run Migrations
In the Supabase SQL Editor:
1. Run `supabase/migrations/0001_init.sql` to create the private `routeshield` schema, tables (`users`, `nodes`, `edges`, `incidents`, `reports`, `incident_events`), constraints, and partial unique indexes.
2. Run `supabase/migrations/0002_demo_network.sql` to populate the 8 nodes (A–H) and 10 edges of the curated demonstration network.

### Step 1.3: Create Storage Bucket
1. Go to **Storage** in the Supabase Dashboard.
2. Create a new bucket named **`evidence`**.
3. Toggle **Private** (do NOT enable Public bucket). RouteShield serves evidence strictly via backend-signed, short-lived URLs.

---

## 2. Render Deployment (Express Backend)

### Step 2.1: Create Web Service
1. Log in to [Render](https://render.com) and click **New > Web Service**.
2. Connect your GitHub repository.
3. Configure the service settings:
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm ci && npm run build`
   - **Start Command**: `npm start`
   - **Health Check Path**: `/api/health`

### Step 2.2: Configure Environment Variables
Add the following environment variables in the Render Dashboard:

| Variable | Example / Description |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `5000` (or leave default, Render sets `PORT` automatically) |
| `FRONTEND_URL` | Exact URL of your deployed Vercel frontend (e.g. `https://routeshield-ai.vercel.app`) |
| `DATABASE_URL` | Your Supabase Session Pooler connection string (`postgresql://postgres.xxx:password@aws-0-region.pooler.supabase.com:6543/postgres`) |
| `DATABASE_CA_CERT_BASE64` | (Optional) Base64-encoded CA certificate for verified TLS |
| `JWT_SECRET` | Secure random string (minimum 32 characters) for HS256 tokens |
| `JWT_ISSUER` | `routeshield-api` |
| `JWT_AUDIENCE` | `routeshield-web` |
| `GEMINI_API_KEY` | Google Gemini API key from Google AI Studio |
| `GEMINI_MODEL` | `gemini-2.5-flash` (or account-supported model) |
| `SUPABASE_URL` | `https://your-project.supabase.co` |
| `SUPABASE_SECRET_KEY` | Supabase `service_role` secret key (for Storage upload & signed URLs) |
| `SUPABASE_STORAGE_BUCKET` | `evidence` |

### Step 2.3: Provision Moderator Account (One-Time)
Run the moderator provisioning script via Render Shell or locally connected to the database:
```bash
MODERATOR_EMAIL="admin@yourdomain.com" \
MODERATOR_PASSWORD="YourSecurePassword123!" \
MODERATOR_DISPLAY_NAME="RouteShield Admin" \
npm run create-moderator
```
*Always clear the moderator password from your environment after running this script.*

---

## 3. Vercel Deployment (React Frontend)

### Step 3.1: Import Project
1. Log in to [Vercel](https://vercel.com) and click **Add New > Project**.
2. Import your GitHub repository.
3. Configure project settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

### Step 3.2: Configure Environment Variables
Set the build environment variable:
- `VITE_API_BASE_URL`: `https://your-backend-service.onrender.com` (no trailing slash)

Click **Deploy**. Direct URL links and deep refreshes will work seamlessly thanks to the SPA rewrite in `frontend/vercel.json`.

---

## 4. Verification Checkpoints

Once deployed:
1. **Health**: Visit `https://your-backend-service.onrender.com/api/health` — should return `200 OK` with JSON status.
2. **Planner**: Visit your Vercel URL — verify nodes A–H appear on the map and direct route A→D calculates 460m.
3. **Upload & AI**: Log in, submit an obstruction photo to segment BC, and confirm Gemini observations display on `/incidents/:id`.
4. **Corroboration & Rerouting**: Submit second photo from another account; verify BC confirms blocked and routes detour cleanly (620m for GENERAL_WALK, 740m for STEP_FREE).
