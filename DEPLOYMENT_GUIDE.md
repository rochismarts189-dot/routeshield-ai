# RouteShield AI deployment

Deploy **Render first**, then **Vercel**. Render is the API origin; Vercel is the main public demo origin. Supabase provides PostgreSQL and private evidence storage. Do not route both through a third host.

## 1. Supabase

Use the existing RouteShield project (confirmed dashboard reference: `iicfsfygenrmznzefxpb`) or the project chosen by its owner. Do not use unrelated connected projects.

1. From **Connect**, copy the **Session pooler** PostgreSQL URL, port **5432**. Port 6543 is transaction pooling, not session pooling. Use the exact host/user shown by Supabase; URL-encode the database password.
2. Configure `backend/.env` using `.env.example`. Add the database URL, Supabase project URL and backend-only secret/service-role key, Gemini key and random JWT secret (at least 32 bytes). Do not commit this file.
3. Run locally from `backend`: `npm ci`, then `npm run migrate`. Alternatively run both SQL files, in order, in the Supabase SQL Editor. They are idempotent and seed 8 nodes / 10 edges. Run the current `0001_init.sql` again on an existing install to apply its role revocations/RLS.
4. Keep `routeshield` outside the exposed Data API schemas. The app uses Express JWTs, not Supabase Auth; there are no client table policies. The server PostgreSQL connection must be an owner/BYPASSRLS role (the Supabase `postgres` connection) or an explicitly configured server role with appropriate policies. Never give `anon` or `authenticated` schema access.
5. Create a **private** Storage bucket named `evidence`, allowed MIME types JPEG/PNG, maximum 5MB. Do not add public read policies. The backend verifies the bucket is private and generates ten-minute image links for evidence review.
6. TLS certificate validation stays enabled. If Node cannot trust the connection certificate, download the project's CA certificate from Supabase and put its base64 PEM in `DATABASE_CA_CERT_BASE64`. Do not disable verification or use `sslmode=no-verify`.

## 2. Render backend first

Create a Node **Web Service** from the GitHub repository, or use the root `render.yaml` blueprint:

- Root directory: `backend`
- Build: `npm ci --include=dev && npm run build`
- Start: `npm start`
- Health path: `/api/health`
- Node: 22 (22.13 or newer)

Render environment:

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `TRUST_PROXY_HOPS` | `1` |
| `FRONTEND_URL` | Exact planned Vercel HTTPS origin; replace with the actual origin after deploying Vercel |
| `DATABASE_URL` | Supabase session pooler URL, port 5432 |
| `DATABASE_CA_CERT_BASE64` | Project CA when required for verified TLS |
| `JWT_SECRET` | At least 32 random bytes; blueprint can generate it |
| `GEMINI_API_KEY` | Real Google AI Studio key |
| `GEMINI_MODEL` | `gemini-2.5-flash`, or an available image + structured-output model for your account |
| `SUPABASE_URL` | Project API URL |
| `SUPABASE_SECRET_KEY` | Backend-only secret/service-role key |
| `SUPABASE_STORAGE_BUCKET` | `evidence` |

Leave `PORT` to Render. Missing production settings cause startup to fail explicitly. If the Vercel origin is not known yet, temporarily set `FRONTEND_URL=https://deployment-pending.invalid`; server-to-server health checks still work. Replace it with the actual Vercel origin before browser verification.

Obtain the **actual** public Render origin from the dashboard. Verify `/api/health` and `/api/ready` both return 200 JSON. Readiness checks infrastructure and key presence; it does not perform a billed Gemini inference.

Provision a moderator from a local backend checkout connected to this database: add temporary `MODERATOR_EMAIL`, a unique strong `MODERATOR_PASSWORD` and `MODERATOR_DISPLAY_NAME` to the ignored `.env`, run `npm run create-moderator`, then remove these temporary variables. Public registration cannot create moderators. Use a new email if it already belongs to a regular user; the script does not silently grant that user moderator privileges.

## 3. Vercel frontend

Import the same GitHub repository:

- Root directory: `frontend`
- Framework: Vite
- Install: `npm ci`
- Build: `npm run build`
- Output: `dist`
- Node: 22
- Environment variable `VITE_API_BASE_URL`: **the verified Render HTTPS origin**, without `/api`

Set this variable for Production (and Preview only when intentionally allowing that preview's exact origin). Vite embeds it during build: changing it requires redeployment. There are no frontend Gemini or Supabase secret keys.

Deploy. Record the actual stable Vercel URL. Update Render's `FRONTEND_URL` to that exact origin (no path/trailing slash), and wait for its configuration restart. Bearer JWT authentication does not require cross-origin cookies. Only the configured origin is allowed in production; do not use wildcard CORS.

If Vercel deployment protection blocks the hackathon audience, adjust the demo project's protection setting as the account owner. Verify the final URL in a signed-out browser. Direct refresh on `/plan`, `/report` and `/incidents` should work through `frontend/vercel.json`.

## 4. Production verification

1. Check Render `/api/health` and `/api/ready`.
2. From Vercel, load the network and plan A→D: 460m with no active incidents.
3. Register/login and submit a **real authorized photo** for BC. The incident must show persisted evidence and **COMPLETE** Gemini analysis; FAILED must never be called a successful AI demo.
4. A single qualifying obstruction remains UNVERIFIED. Step-free routing may use precautionary avoidance; general walking shows a warning.
5. Submit a different fresh photo from another account. If both photos actually qualify, corroboration confirms BC: 620m general walk, 740m step-free. Two accounts are a quorum heuristic, not proof of two independent people.
6. Add fresh clear evidence. A confirmed incident stays blocked/disputed until a moderator selects that qualifying report and attests the entire segment was checked. Clearing restores 460m.
7. Confirm GH as step-free blocked too: BC + GH produces NO_ROUTE for step-free; there is no invented shortcut.
8. Inspect logs/audit trail, retry failure, duplicate-photo errors and keyboard/text itinerary. Verify an unapproved Origin is rejected and `/api/auth/me` rejects invalid/expired JWTs.

A live smoke check is available from `backend`:

```bash
# Configure privately in backend/.env before running:
# SMOKE_API_URL = actual Render origin
# SMOKE_FRONTEND_ORIGIN = actual Vercel origin
# SMOKE_EMAIL / SMOKE_PASSWORD = a dedicated demo account
# SMOKE_PHOTO_PATH = path to a new authorized JPEG/PNG fixture
npm run smoke
```

It logs checks, never credentials/tokens, and exits nonzero on failed live analysis. It writes one report to BC, so use a dedicated demo environment and a new photo. It does not fabricate corroboration or clear evidence.

Free Render services may sleep: open the backend before the presentation and allow cold-start time. Keep a clearly labelled recording fallback. Record the 3–5 minute demo only after the production flow has succeeded.
