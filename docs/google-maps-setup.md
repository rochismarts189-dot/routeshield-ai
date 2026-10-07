# Google Maps setup for optional real walking routes

## Current status

The current application remains the working Maple Ward demonstration. This setup adds credential templates and an **opt-in server credential check**; it does not claim that Google navigation, real-location reporting or obstruction-aware real routes are implemented. The current report schema accepts only curated segment IDs and derives its coordinates from fictional segment endpoints. Those incidents must never be overlaid on a real city map as real observations.

No Maps credentials were found in the local configuration. Google Cloud project selection, enabled APIs and billing have not been verified. No billing account was linked and no API keys were created by this change. Existing Gemini, database, authentication, incident policy, CORS and deterministic routing are preserved.

Current public frontend: https://routeshield-ai-one.vercel.app

Current backend: https://routeshield-backend.onrender.com

## Enable these Google APIs

| API | Required now? | Purpose |
| --- | --- | --- |
| **Maps JavaScript API** | Yes for the proposed map UI | Display the Google map and provider-returned route polylines. |
| **Routes API** | Yes for real routes | Backend `computeRoutes`, explicitly using `WALK`, requesting alternatives. |
| Geocoding API | Optional | Separate address lookup/reverse geocoding if added later. Not needed for the first version because Routes accepts address waypoints. |
| Places API (New) | Optional | Address/place autocomplete if added later. Not needed for typed-address submission. |

Do not enable Directions API (Legacy), Distance Matrix API (Legacy), Roads API, Geolocation API or mobile Navigation SDKs for this web MVP. A map ID is not required for a basic map/polyline; add one only if a later implementation uses features that require it, such as advanced markers.

Google supports [address waypoints](https://developers.google.com/maps/documentation/routes/reference/rest/v2/Waypoint). The standard production setup requires project billing and API credentials: [Maps JavaScript setup](https://developers.google.com/maps/documentation/javascript/get-api-key), [Routes setup](https://developers.google.com/maps/documentation/routes/get-api-key).

## Manual Google Cloud actions — account owner

1. Open https://console.cloud.google.com/ and use the project selector at the top. Select the project that should own RouteShield Maps usage, or create a dedicated project. Do not modify the working Gemini key's restrictions.
2. Open **Billing** from the navigation menu. If the selected project has no billing account, choose **Link a billing account** and select your approved account. If no account exists, the account owner must complete billing/payment/terms steps. Stop here if you do not authorize billed Maps usage.
3. Open **APIs & Services → Library**. Search **Maps JavaScript API**, open it and click **Enable**. Repeat for **Routes API**. If the API page says **Manage**, it is already enabled in this selected project.
4. Open **APIs & Services → Credentials → Create credentials → API key**. Create two separate keys as described below. Keep key values out of chat, GitHub, screenshots and README files.
5. Configure project budget alerts and review each API's **Quotas & System Limits** before making test calls. Budget alerts notify; they are not a hard spending cap. Set supported request quotas to limits you approve. Do not assume an old monthly credit makes every request free.

## Key 1 — RouteShield Browser Maps

In the key's edit page:

- Name: `RouteShield Browser Maps`.
- **Application restrictions → Websites**. Add the exact frontend referrer:
  - `https://routeshield-ai-one.vercel.app/*`
  - For local development only: `http://localhost:5173/*` and `http://127.0.0.1:5173/*`.
- **API restrictions → Restrict key → Maps JavaScript API** only.
- Click **Save**. Add another exact approved frontend domain only if it is actually used. Do not allow all `*.vercel.app` websites.

This key will be visible in browser requests when the map is implemented. Its protection is website/API restrictions; a `VITE_` variable is not a secret vault. It must not grant Routes, Gemini or server database access. See [Google's key-security guidance](https://developers.google.com/maps/api-security-best-practices).

## Key 2 — RouteShield Server Routes

In the key's edit page:

- Name: `RouteShield Server Routes`.
- **Application restrictions → IP addresses**. Add **all actual outbound IP/CIDR ranges for this Render service**.
- Find those ranges at https://dashboard.render.com/web/srv-db346kh42hec738h97qg → **Connect → Outbound**. Do not use the frontend domain, Render hostname or inbound DNS address as the outbound restriction. Render's published ranges are shared within its region; the key value must remain private. [Render instructions](https://render.com/docs/outbound-ip-addresses).
- **API restrictions → Restrict key → Routes API** only.
- Click **Save**.

Local server checks require an IP restriction that permits the local machine's public outbound address. Use a separately approved development key for that purpose, or run the check on Render where its shell is available. Do not remove production IP restrictions just to pass a local check. Do not reuse the browser key or the working Gemini key.

## Credential placement

| Variable | Production destination | Local destination | Meaning |
| --- | --- | --- | --- |
| `GOOGLE_MAPS_SERVER_API_KEY` | Render → routeshield-backend → Environment | `backend/.env` | Private server key restricted to Routes and approved outbound IPs. |
| `VITE_GOOGLE_MAPS_BROWSER_API_KEY` | Vercel → routeshield-ai → Settings → Environment Variables → Production | `frontend/.env` | Restricted browser display key. Do not label it a hidden secret. |
| `VITE_API_BASE_URL` | Vercel, keep `https://routeshield-backend.onrender.com` | Existing local proxy setup | Existing API origin, no `/api` suffix. |
| `FRONTEND_URL` | Render, keep `https://routeshield-ai-one.vercel.app` | Existing local origin | Existing exact CORS origin. |
| `GEMINI_API_KEY` | Render only, preserve current value | `backend/.env` only | Existing evidence analysis; separate from both Maps keys. |

Do not replace the `.env` files wholesale; append settings while preserving existing database/storage/JWT/Gemini values. Both `.env` files are already ignored. Only blank `.env.example` values are committed.

Render: **Environment → Edit → Add environment variable → Save, rebuild, and deploy**. Vercel: add the browser key for **Production**, then **Deployments → latest production deployment → Redeploy** after the frontend map integration exists. Vite embeds browser variables at build time. This project's Vercel Git connection is not configured, so code changes need the existing source-upload deployment process until Git access is connected. Adding keys alone does not add a map screen.

## Opt-in real provider check

After billing/key approval, privately configure in `backend/.env` (or Render's environment):

```dotenv
GOOGLE_MAPS_SERVER_API_KEY=
GOOGLE_MAPS_CHECK_ORIGIN=
GOOGLE_MAPS_CHECK_DESTINATION=
```

Use two unambiguous public landmarks in Visakhapatnam, with city/country included. Avoid sending private home addresses for this check. From `backend`, run `npm run maps:check`. It makes **one potentially billed real walking-route request** with alternatives enabled, validates the returned distance/duration/polyline and prints no key or submitted addresses. Missing configuration exits without a provider request. No database writes or fake paths occur. It cannot test browser referrer restrictions or certify the whole application.

## What must be implemented before activating Real Navigation

1. Keep a separate optional page; lazy-load Maps only there. Maple Ward remains the default and is not replaced.
2. Add genuine real-location report intake and explicit demo/real separation. Preserve existing evidence, reconciliation, verification and reopening policy. A clicked/reported location still requires validation and must not be inferred from an isolated photo.
3. Add an authenticated, validated and rate-limited Express endpoint that sends addresses to Routes using the server key. Never let clients proxy arbitrary Google URLs. Request `WALK`, provider warnings, default/alternative labels, distances and high-quality polylines; validate responses.
4. Decode returned routes and check them against active **real-location** incidents. Do not claim that proximity alone reliably identifies a particular sidewalk, parallel street or grade-separated path. Location ambiguity must be shown for review.
5. Select only an actual returned alternative that passes the obstruction check. The documented [route modifiers](https://developers.google.com/maps/documentation/routes/reference/rest/v2/RouteModifiers) do not expose arbitrary incident polygon/segment exclusions. Google may return no alternative: show **No verified alternative available** rather than inventing a waypoint/detour. [Alternative-route limitations](https://developers.google.com/maps/documentation/routes/alternative-routes).
6. Display Google attribution and required walking warnings. Google `WALK` is not `STEP_FREE` or wheelchair certification; keep Maple Ward's verified profile logic separate. [Walking-mode requirements](https://developers.google.com/maps/documentation/routes/reference/rest/v2/RouteTravelMode).
7. Verify real provider calls, map loading under referrer restrictions, true geolocated obstruction matching, candidate rejection, no-alternative behavior and every existing routing/auth/evidence test before enabling the optional mode publicly.

Setup is awaiting the account owner's billing/API/key actions. The existing application remains available. The prior real Gemini check also remains blocked by provider 503/504/timeouts; Maps configuration does not solve or replace that failed inference.
