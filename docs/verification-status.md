# Verification status — 7 October 2026

## Passed

- Backend TypeScript production build on Node 22.22.0; strict checking retained.
- Backend: 29 automated tests, including authentication boundaries, evidence policy, Gemini response validation, verified TLS configuration, exact CORS and HTTP integration.
- Deterministic routing expectations: 460m baseline; B-C blocked general 620m; B-C blocked step-free 740m; B-C plus G-H blocked step-free NO_ROUTE; clearing restores 460m.
- Frontend production build and 12 tests, including warning/alternative presentation, unverified distinction, precautionary avoidance, NO_ROUTE, cleared/dismissed incidents and stale-route prevention.
- Real Supabase connection with its official CA and certificate verification enabled; migrations applied; 8 nodes / 10 edges; evidence bucket verified private.
- Render HTTPS health/readiness and production network endpoints.
- Public Vercel deployment and browser rendering; Vercel-origin request to Render returns the network with exact matching CORS.
- Production registration, bcrypt login, JWT identity check, invalid-token rejection and rejection of registration role escalation.
- Image upload persisted in private storage and an incident created for the submitted segment. Failed AI analysis is stored as FAILED and is not substituted with an invented result.

## Live AI check remains blocked

The configured `gemini-2.5-flash` model returned HTTP 404 for this account. Replacement model `gemini-3.8-flash` is configured; Google's official documentation supports image input and structured outputs. Actual image requests returned HTTP 503 / UNAVAILABLE (“high demand”), including a normalized real licensed obstruction photograph. Other available model checks also returned 503.

Consequently, **successful live image analysis and the complete production obstruction → confirmed incident → alternative route demonstration have not passed yet**. Automated policy and route tests are not a substitute for that check. Do not claim the application is completely verified until an actual provider response passes validation, persists and supports the required verification action.

The licensed historical photograph's provenance is in `demo/fixtures/provenance.md`; it is not a current Maple Ward observation. Reopening still requires actual qualifying clear evidence and authorized whole-segment attestation. Do not relax policy to make the demo pass.
