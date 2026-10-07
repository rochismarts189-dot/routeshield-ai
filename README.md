# RouteShield AI

> **Someone reports an obstruction once. The next traveler is warned before starting and can take an alternative.**

[![CI](https://github.com/rochismarts189-dot/routeshield-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/rochismarts189-dot/routeshield-ai/actions/workflows/ci.yml)
[![Theme: AI for Accessibility & Inclusion](https://img.shields.io/badge/theme-AI%20for%20Accessibility%20%26%20Inclusion-blue.svg)]()
[![Stack: React + Node/Express + Supabase + Gemini](https://img.shields.io/badge/stack-React%20%7C%20Node%20%7C%20Supabase%20%7C%20Gemini-emerald.svg)]()

---

## Public application

- Frontend / hackathon URL: https://routeshield-ai-one.vercel.app
- Express backend: https://routeshield-backend.onrender.com
- Readiness: https://routeshield-backend.onrender.com/api/ready

The frontend is deployed from the committed frontend source using Vercel's source-upload API; this Vercel account could not import the GitHub repository. GitHub remains the source of truth. Future source changes require redeployment until repository access is connected.

## Core demo story

**Photo evidence → real Gemini analysis → incident verification → warning before travel → deterministic alternative.**

The planner compares the normal route and recommended route from the existing backend. Affected segments link directly to photo evidence, Gemini observations and verification history. Unverified reports remain unverified; they may generate a warning or precautionary step-free avoidance according to the existing policy. Confirmation is required for the confirmed-blocked demo.

Check [the demo script](docs/demo-script.md) and [verification status](docs/verification-status.md) before presenting. A healthy API or configured AI key alone does not prove successful live inference.

[Optional Google Maps setup](docs/google-maps-setup.md) contains the required APIs, separate key restrictions, credential placement and the opt-in `npm run maps:check` command. This prepares credentials; real navigation and real-location incident matching are not yet implemented.

## The Problem

Temporary obstructions (construction barriers, scaffolding, parked vehicles, fallen debris) can make a familiar pedestrian route completely unusable for individuals relying on step-free access.

A photograph or informal report alone does not provide location-linked, current, corroborated information or an actionable alternative route. Furthermore, computer vision cannot infer curb ramp gradients, exact path width, whole-route safety, or authentic GPS coordinates from an isolated photo.

**RouteShield AI** connects community-submitted visual evidence to an explicit state machine, rigorous community corroboration, and deterministic, profile-specific pedestrian route planning.

---

## Important Disclaimers & Scope

1. **Fictional Demonstration Network — Not Live Navigation**:
   The application runs on a curated, illustrative 8-node demonstration pedestrian network (A–H). Locations, distances, and accessibility attributes are illustrative fixtures designed for reproducible hackathon evaluation.
2. **Planning Preference, Not Safety Certification**:
   The `STEP_FREE` routing profile is an algorithmic planning preference that strictly excludes stairs and unverified segments. It is **not** a guarantee or certification of wheelchair safety or ADA compliance.
3. **Role of Gemini Multimodal AI**:
   Gemini AI is strictly employed by the backend to analyze visible photographic evidence according to a strict JSON Schema (detecting obstruction type, severity, visible extent, and apparent passability). **Gemini never invents paths, computes distances, selects nodes, or authorizes incident clearances directly.** All routing is deterministic (Dijkstra algorithm) and all state transitions follow explicit backend policies.

---

## Core Capabilities & Features

- **Multimodal Visual Evidence**: Direct photo upload normalized via Sharp (EXIF stripped, resized, SHA-256 hashed). Analyzed by `@google/genai` multimodal vision.
- **Strict Verification State Machine**:
  - `UNVERIFIED`: Initial state. A single photo never confirms or clears an obstruction.
  - `CONFIRMED_BLOCKED`: Achieved automatically through **community corroboration** (2+ distinct accounts, 2+ distinct photos within 30 minutes, full-width block, clear evidence quality) or moderator action.
  - `CLEARED`: Requires fresh qualifying clear evidence and **mandatory moderator attestation** confirming the entire physical segment was inspected.
  - `DISPUTED` / `REQUIRES_REVIEW`: Triggered when contradictory clear and blocked evidence are reported concurrently.
- **Deterministic Routing**:
  - **Dijkstra Routing Engine**: Stable tie-breaking, bidirectional graph.
  - **Baseline vs. Detour Comparison**: Direct distance compared against detour path (+X meters) with explicit explanation of changes.
  - **Turn-by-Turn Text Itinerary**: Full keyboard and screen-reader accessible step list.
- **Accessibility-First Design**:
  - Visible focus rings, high-contrast dark theme, semantic HTML5, screen-reader labels.
  - Interactive SVG map schematic is paired with full dropdown and turn-by-turn text alternatives.
  - Zero disability diagnosis or health tracking required.

---

## Project Structure

```
routeshield-ai/
├── frontend/                     # React 18 + Vite SPA
│   ├── src/
│   │   ├── app/router.tsx        # React Router routes
│   │   ├── pages/                # Planner, Report, Incidents, Incident, Auth
│   │   ├── components/           # NetworkMap, RouteItinerary, EvidenceCard, etc.
│   │   ├── context/AuthContext.tsx # In-memory JWT auth
│   │   ├── lib/api.ts            # Fetch API client
│   │   └── types/index.ts        # TypeScript schemas
│   ├── vercel.json               # SPA rewrite for direct routing
│   └── .env.example
├── backend/                      # Node.js + Express Backend Service
│   ├── src/
│   │   ├── app.ts / server.ts    # Express service entry
│   │   ├── config/               # db.ts (pg pool), storage.ts, env.ts
│   │   ├── routes/               # auth, network, reports, incidents, routes
│   │   ├── services/             # gemini.ts, routing.ts, incidents.ts, evidence.ts
│   │   ├── repositories/         # users, network, incidents, reports, events
│   │   └── schemas/              # Zod schemas for auth, report, route, analysis
│   ├── scripts/create-moderator.ts # One-time operator moderator provisioning
│   ├── tests/                    # Vitest unit test suites
│   │   ├── routing.test.ts       # 460m, 620m, 740m, NO_ROUTE test cases
│   │   └── incident-policy.test.ts # Corroboration and quorum policy rules
│   └── .env.example
├── supabase/
│   └── migrations/
│       ├── 0001_init.sql         # routeshield private schema, tables, constraints
│       └── 0002_demo_network.sql # Demo nodes A–H and links seed
├── docs/
│   ├── architecture.md           # System topology and data model
│   ├── api-contract.md           # Full REST API specifications
│   └── demo-script.md            # 4-minute hackathon presentation script
├── demo/
│   └── fixtures/                 # Existing illustrations & provenance limitations
├── DEPLOYMENT_GUIDE.md           # Supabase, Render, and Vercel setup instructions
└── README.md
```

---

## Local Development Setup

### Prerequisites
- Node.js >= 22.13
- npm >= 9

### 1. Database Setup
Execute the two SQL migration files in your PostgreSQL or Supabase instance:
```bash
# In your Supabase SQL editor or psql:
# 1. Run supabase/migrations/0001_init.sql
# 2. Run supabase/migrations/0002_demo_network.sql
```

### 2. Backend Setup
```bash
cd backend
cp .env.example .env
# Edit .env with your PostgreSQL credentials, JWT secret, and Gemini API key
npm ci
npm run migrate     # Applies the SQL files and verifies 8 nodes / 10 edges
npm test            # Unit tests plus isolated PostgreSQL/HTTP integration tests
npm run dev         # Starts backend on http://localhost:5001
```

### 3. Frontend Setup
```bash
cd frontend
cp .env.example .env
npm ci
npm run dev         # Starts frontend on http://localhost:5173
```

---

## Expected Demonstration Route Results

| Route | Profile | Path | Distance | Notes |
|---|---|---|---|---|
| **A → D (Baseline)** | `GENERAL_WALK` | A-B-C-D | **460m** | Direct scheduled route |
| **A → D (Baseline)** | `STEP_FREE` | A-B-C-D | **460m** | All links are step-free |
| **A → D (BC Blocked)** | `GENERAL_WALK` | A-B-E-F-D | **620m** | Detours via E-F (contains stairs) |
| **A → D (BC Blocked)** | `STEP_FREE` | A-B-G-H-D | **740m** | Detours via G-H (avoids stairs & unknown links) |
| **A → D (BC + GH Blocked)** | `STEP_FREE` | None | **NO_ROUTE** | Safely reports no step-free route |
| **A → D (BC Cleared)** | `STEP_FREE` | A-B-C-D | **460m** | Baseline route restored |

---

## Deployment

Refer to [`DEPLOYMENT_GUIDE.md`](DEPLOYMENT_GUIDE.md) for full instructions on deploying to **Supabase**, **Render**, and **Vercel**.

## Verification and deployment status

Run `npm test && npm run build` in **both** frontend and backend. Tests use isolated fixtures, an in-memory PostgreSQL engine, and explicit test-only provider/storage doubles. No fake AI results or embedded database are used by the deployed app. Unit tests are not evidence of a successful live Gemini request.

Production startup requires real backend configuration. `/api/health` is liveness; `/api/ready` checks the seeded database, private storage bucket and configured AI key. Use `npm run smoke` in backend with the environment described in the deployment guide for a live persisted photo/AI/route check.

The two deployment origins are separate: Render hosts the API, Vercel hosts the public demo. `VITE_API_BASE_URL` must contain Render’s actual origin at build time. `FRONTEND_URL` must contain Vercel’s exact origin. No secrets belong in a `VITE_*` variable. Sessions are held in memory, so refreshing the page requires signing in again.

Local port 5001 avoids macOS AirPlay’s use of port 5000. Missing database/storage settings produce explicit errors; there is no local persistence fallback. Generated database files are ignored.


### Optional real navigation

`/navigate` adds Google walking routes and checks real-location community reports. It is independent of the Maple Ward demonstration. Configure the restricted browser key on Vercel and restricted Routes key on Render following [Google Maps setup](docs/google-maps-setup.md), apply migration `0003_real_navigation.sql`, and use public landmarks for verification. Real Google walking routes have **unverified step-free access**; the controlled `STEP_FREE` demo remains `/plan`. If Google provides no unaffected candidate, RouteShield says so and never invents a detour. Billing and live provider verification are separate from successful builds/tests.
