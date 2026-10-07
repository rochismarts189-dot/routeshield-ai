# Google Maps setup for optional real walking routes

## Current status

The optional `/navigate` page and authenticated `/api/navigation/plan` endpoint are implemented alongside the existing Maple Ward demo. Google supplies real walking routes and alternatives; deterministic geometry code checks actual real-location community incidents. Real reports, incidents and audit events live in separate `routeshield.real_*` tables. **No fictional coordinates or incidents are imported into real navigation.** Migrate with `npm run migrate` from `backend` before deployment.

Gemini image analysis was successfully verified with an actual licensed obstruction photograph using `gemini-3.5-flash-lite`. This is the backend's default and bounded transient-error fallback model; keep the Render `GEMINI_MODEL` setting consistent. Both attempts remain real inference and use the same existing lifetime budget. The previous `gemini-3.8-flash` requests timed out.

Google Cloud project `routeshield-ai` is selected. The account owner approved the two APIs and restricted-key setup. Enabling Maps JavaScript redirected to billing activation; Maps credentials and live routing are **pending billing completion and actual verification**, not declared working from source tests alone.

Public frontend: https://routeshield-ai-one.vercel.app

Backend: https://routeshield-backend.onrender.com

## Enable these Google APIs

| API | Required now? | Purpose |
| --- | --- | --- |
| **Maps JavaScript API** | Yes for the optional map UI | Display the Google map and provider-returned route polylines. |
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

This key will be visible in browser requests when the real map loads. Its protection is website/API restrictions; a `VITE_` variable is not a secret vault. It must not grant Routes, Gemini or server database access. See [Google's key-security guidance](https://developers.google.com/maps/api-security-best-practices).

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

Render: **Environment → Edit → Add environment variable → Save, rebuild, and deploy**. Vercel: add the browser key for **Production**, then **Deployments → latest production deployment → Redeploy** after setting the browser key. Vite embeds browser variables at build time. This project's Vercel Git connection is not configured, so code changes need the existing source-upload deployment process until Git access is connected. The map loads only on `/navigate`. Without either Google setting, the existing Maple Ward mode remains available.

## Opt-in real provider check

After billing/key approval, privately configure in `backend/.env` (or Render's environment):

```dotenv
GOOGLE_MAPS_SERVER_API_KEY=
GOOGLE_MAPS_CHECK_ORIGIN=
GOOGLE_MAPS_CHECK_DESTINATION=
```

Use two unambiguous public landmarks in Visakhapatnam, with city/country included. Avoid sending private home addresses for this check. From `backend`, run `npm run maps:check`. It makes **one potentially billed real walking-route request** with alternatives enabled, validates the returned distance/duration/polyline and prints no key or submitted addresses. Missing configuration exits without a provider request. No database writes or fake paths occur. It cannot test browser referrer restrictions or certify the whole application.

## Implemented real navigation and its limits

- Optional `/navigate` page, with Maps loaded only there; `/plan`, `/report` and all Maple Ward flows remain intact.
- Backend authenticated, Zod-validated, account-rate-limited Google Routes calls to a fixed provider URL. Requests use `WALK`, address waypoints, real returned alternatives, high-quality polylines, instructions and warnings.
- Report intake accepts a clicked pin or manually entered coordinates and a genuine image. Location is a user claim, not inferred by Gemini. Upload normalization, private evidence storage, duplicate checks, bounded inference attempts, evidence qualification, distinct-account corroboration and moderator reopening are retained.
- Reports near the same named location are reconciled within 15 m. Proximity cannot establish road identity. Unknown, conflicting and failed analyses are kept visible; they do not fabricate a block.
- Routes are matched within 20 m of active **real-location** incidents. Unverified reports generate warnings. Confirmed general-walking blocks reject candidate paths. An actual Google alternative is recommended only when it avoids the confirmed reported locations. If all returned candidates are affected, the app shows **No verified alternative**, retaining the original route and explanation.
- Google does not expose arbitrary obstruction segment/polygon exclusions through the documented [route modifiers](https://developers.google.com/maps/documentation/routes/reference/rest/v2/RouteModifiers). [Alternative-route limits](https://developers.google.com/maps/documentation/routes/alternative-routes) apply; no invented waypoints/detours are used.
- Google walking access is unverified, including sidewalks, stairs and parallel/grade-separated paths. The app shows provider warnings and does not equate `WALK` with Maple Ward's `STEP_FREE`. [Walking-mode requirements](https://developers.google.com/maps/documentation/routes/reference/rest/v2/RouteTravelMode).
- Geometry and policy tests use isolated fixtures, not claimed live provider responses. Billing, restricted key behavior, browser loading and actual Google routing must pass production checks before declaring the optional mode verified.

Render outbound CIDRs observed for this service: `74.220.48.0/24`, `74.220.56.0/24`. Reconfirm in **Connect → Outbound** if the service region changes. Keep the server key private even though these ranges are shared with other services.
