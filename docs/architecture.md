# RouteShield AI — System Architecture

RouteShield AI transforms community-contributed evidence into explainable, step-free pedestrian route warnings and alternatives.

## High-Level Topology

```
+-----------------------------------------------------------------------------+
|                                CLIENT TIER                                  |
|   React 18 + Vite SPA (Hosted on Vercel)                                   |
|   - In-memory short-lived JWT auth (no localStorage persistence)            |
|   - Interactive SVG map schematic & turn-by-turn text itinerary            |
|   - Accessibility-first interface (keyboard navigation, high contrast)     |
+--------------------------------------+--------------------------------------+
                                       |
                                HTTPS  | Fetch API (Bearer JWT)
                                       v
+-----------------------------------------------------------------------------+
|                                BACKEND TIER                                 |
|   Node.js + Express (Hosted on Render Web Service)                          |
|   - Helmet security headers, strict CORS, express-rate-limit                |
|   - Multer memory buffer uploads (<= 5MB, JPEG/PNG)                         |
|   - Sharp image decoding, EXIF metadata stripping, 1600px resize, SHA-256   |
|   - Deterministic Dijkstra routing with profile constraints                 |
|   - State machine: Automated community corroboration vs Moderator review    |
+--------------------+---------------------+--------------------+-------------+
                     |                     |                    |
        Parameterized|SQL                  |Signed URLs         |Multimodal
        (routeshield |schema)              |Storage API         |JSON Schema
                     v                     v                    v
      +------------------------+  +------------------+  +--------------------+
      |  Supabase PostgreSQL   |  | Supabase Storage |  |   Google Gemini    |
      |  - Private Schema      |  | - Private Bucket |  |   @google/genai    |
      |  - Session Pooler      |  |   `evidence`     |  |   Visual Inference |
      +------------------------+  +------------------+  +--------------------+
```

## Data Model & Constraints

All application data resides under the private PostgreSQL schema `routeshield`:
- **`users`**: Custom email/password accounts with bcrypt hashes. Roles: `USER`, `MODERATOR`. Registration always creates `USER`.
- **`nodes`**: Curated junction landmarks with display coordinates `map_x` (0-600) and `map_y` (0-400).
- **`edges`**: Undirected pathways with canonical ordering (`from_node < to_node`), length in meters, `step_free_status` (`YES`, `NO`, `UNKNOWN`), and `has_steps`. `has_steps=true` strictly enforces `step_free_status='NO'`.
- **`incidents`**: State machine (`UNVERIFIED`, `CONFIRMED_BLOCKED`, `CLEARED`). Enforces strict flag/timestamp invariants via CHECK constraints. Partial unique index guarantees at most one active incident per segment.
- **`reports`**: Visual evidence linked to incidents. Uniquely identified by `photo_sha256` hash. Captures analysis status (`PENDING`, `COMPLETE`, `FAILED`), raw JSON, and attempts.
- **`incident_events`**: Immutable audit log of all automated and moderator state transitions.

## Verification & State Machine Policy

1. **Unverified Creation**: The first report on an edge creates an `UNVERIFIED` incident. AI never writes a verification status directly.
2. **Community Corroboration**: An automated transition to `CONFIRMED_BLOCKED` requires:
   - 2 distinct user accounts (`reporter_id`).
   - 2 distinct normalized photographs (`photo_sha256`).
   - Both reports within a 30-minute window of observed and received timestamps.
   - Usable analysis (`evidence_quality = 'CLEAR'`), `visible_extent = 'FULL_WIDTH'`, and both passability profiles marked `BLOCKED`.
   - Zero contradictory clear evidence.
3. **Contradictions & Disputes**: Fresh block and clear reports set `disputed=true` and `requires_review=true`. A confirmed block remains blocked until an authorized moderator completes a whole-segment check.
4. **Moderator Actions**:
   - `CONFIRM_BLOCKED`: Can confirm for General Walk, Step-Free, or both.
   - `CLEAR`: Requires fresh qualifying clear evidence, expected version match, and a mandatory attestation that the whole segment was checked.
   - `DISMISS`: Permitted only for `UNVERIFIED` incidents.

## Deterministic Routing Engine

- Uses Dijkstra's algorithm with stable tie-breaking on positive edge lengths.
- `GENERAL_WALK`: Allows stairs and unknown accessibility links.
- `STEP_FREE`: Strictly allows only `step_free_status = 'YES'` and `has_steps = false`. UNKNOWN links are excluded.
- Precautionary avoidance: Avoids active `UNVERIFIED` links for `STEP_FREE` when completed AI analysis identifies a possible obstruction.
