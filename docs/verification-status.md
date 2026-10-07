# Verification status — 7 October 2026

## Deployed core application: passed

- Public frontend: https://routeshield-ai-one.vercel.app
- Express backend: https://routeshield-backend.onrender.com
- Render HTTPS health and readiness returned 200; Supabase database is connected, Maple Ward contains 8 nodes / 10 edges, and the evidence bucket is private. TLS certificate verification remains enabled.
- Actual Vercel browser login, photo chooser/upload, Gemini result display, authenticated moderator confirmation, incident evidence links, route warnings and profile switching passed.
- **Real production image analysis passed**, in one provider attempt, with **`gemini-3.5-flash-lite`**. The actual licensed historical photograph produced validated FALLEN_OBJECT / HIGH / FULL_WIDTH / CLEAR evidence with BLOCKED for both profiles. Observations are stored and shown alongside the photograph and actual model name.
- A single report remained UNVERIFIED until explicit moderator review. The moderator selected the analyzed report, reviewed its observations and confirmed blockage for both profiles; the event is recorded in the audit trail. This test does not claim automatic community corroboration.
- The deployed A→D planner compares the normal **460 m A-B-C-D** route with **620 m A-B-E-F-D** for General Walk and **740 m A-B-G-H-D** for Step-Free, shows the B-C obstruction before travel, labels the map BLOCKED and explains the alternative.
- Production JWT login succeeded; missing/invalid tokens and wrong passwords were rejected. A USER account was denied moderator actions. Exact Vercel-origin CORS/preflight passed; an unapproved origin was denied. Invalid image bytes and routing inputs were rejected.
- Persisted report/incident reconciliation, temporary signed image access, denied unsigned public image access and duplicate-photo rejection passed. Failed prior provider attempts remain honestly recorded; they have not been replaced with invented successes.

The production photo is a historical Bill Boaden / Geograph 2507522 photograph under CC BY-SA 2.0. The report explicitly labels the Maple Ward segment assignment and observation time as simulated. See [fixture provenance](../demo/fixtures/provenance.md). It is not a current real-world closure report.

## Automated verification

- Strict backend and frontend TypeScript production builds passed; compiler checks were not disabled.
- **Backend: 37 tests across 8 files passed.** Includes authentication, validation, TLS/CORS, evidence normalization, Gemini JSON/semantic validation, bounded retries, incident policy, corroboration, moderator attestation, deterministic routing and optional real/demo isolation.
- **Frontend: 16 tests across 2 files passed.** Includes the obstruction-first UI, report results, profile behavior, optional provider/configuration failures and stale response handling.
- All required deterministic routing scenarios pass: baseline 460 m; B-C blocked General Walk 620 m; B-C blocked Step-Free 740 m; B-C + G-H blocked Step-Free NO_ROUTE; B-C cleared 460 m. NO_ROUTE, community quorum and reopening are covered by automated integration/policy tests; this production browser run did not manufacture extra physical observations to demonstrate them.

## Configuration correction

Render still explicitly selected `gemini-3.8-flash`, whose photo requests failed with provider unavailability/timeouts. The Render environment was changed to the live-tested `gemini-3.5-flash-lite`, and its redeployment succeeded. The API key remains backend-only. Readiness checks configuration, database and storage; it intentionally does not attest to live inference. The persisted report and browser verification above establish the actual inference result.

## Google Maps deferred

Google Cloud billing/card setup could not be completed. No Google Maps key is required for the hackathon core flow. The optional module is preserved and hidden from main navigation when its browser key is absent. Google live routing and key/API setup have **not** been verified. Maple Ward is the reliable independent demonstration.
