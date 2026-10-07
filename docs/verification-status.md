# Verification status — 7 October 2026

## Verified in this update

- Strict backend and frontend TypeScript production builds; no compiler checks disabled.
- Backend: 37 automated tests, including all original authentication, TLS, evidence, reopening and deterministic routing checks, plus Google request validation, real polyline decoding, warning-only reports, returned-alternative selection, no-alternative behavior, real/demo data isolation and real incident verification.
- Frontend: 16 tests, including the original obstruction-first demo plus optional-mode configuration failure, provider failure, no invented alternatives and stale Google response prevention.
- Maple Ward routing expectations remain: 460 m baseline; B-C blocked general 620 m; B-C blocked step-free 740 m; B-C + G-H step-free NO_ROUTE; clearing restores 460 m.
- Supabase migrations 0001–0003 applied successfully over verified TLS. Maple Ward remains 8 nodes / 10 edges. New real incident/report/event tables start empty; no fictional geographic data is imported.
- **Actual image inference succeeded** with `gemini-3.5-flash-lite`: the normalized licensed historical obstruction photograph returned schema-validated FALLEN_OBJECT / HIGH / FULL_WIDTH analysis and concrete observations. This is a live SDK check, not a mocked response.
- A bounded transient-error model fallback uses the same lifetime attempt budget and records the actual model that responds. No AI results, routes, confirmation or clearance are invented.

## Production checks still required before claiming completion

The preceding production deployment passed HTTPS health/readiness, database/private bucket checks, Vercel→Render CORS, bcrypt/JWT authentication, image persistence, incident reconciliation, duplicate rejection and signed evidence access. Its `gemini-3.8-flash` requests failed with provider 503/504/timeouts; the historic photograph remained unverified, with the correct 460 m route and reported-obstruction warning.

This update must be deployed and its **production** image upload/inference/incident/route flow verified separately. A successful direct model check and automated fixtures are not substitutes for that deployed flow.

Google Cloud project `routeshield-ai` is selected and the account owner approved enabling Maps JavaScript + Routes and creating restricted keys. Google's Enable action redirected to billing/card verification. Account-owner billing completion is pending. **Maps APIs/keys, real browser map loading and live Google routing are not yet claimed verified.** See [Google Maps setup](google-maps-setup.md).

The historical fixtures are permitted only for explicitly labelled fictional Maple Ward tests; do not submit them as current real-location obstruction reports. Reopening remains evidence-gated and requires an authorized whole-segment attestation.
