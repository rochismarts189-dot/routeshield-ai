# RouteShield AI — Demonstration Script (4-Minute Walkthrough)

This script follows the exact demonstration flow specified in the project requirements.

---

## Part 1: Baseline Route & Demonstration Network (0:00 – 0:45)
1. **Explain Purpose & Fictional Scope**:
   - Point out top disclaimer: *"Fictional demonstration network — not live navigation."*
   - Note the core premise: Temporary obstructions make familiar pedestrian routes unusable for people relying on step-free access.
2. **Show Baseline Route A → D**:
   - Select Origin: `A: Transit Stop`, Destination: `D: Clinic Entrance`.
   - Toggle both profiles:
     - `GENERAL_WALK`: Direct path along A-B-C-D (460m).
     - `STEP_FREE`: Direct path along A-B-C-D (460m).
   - Review SVG map schematic showing clean green highlighted line.

---

## Part 2: Submit First Obstruction Photo to BC (0:45 – 1:30)
1. **Submit Visual Evidence**:
   - Log in as Community Account 1 (`user1@demo.internal`).
   - Navigate to `/report`. Select Segment `BC: Market Corner to Library Junction`.
   - Upload authorized obstruction photo fixture `demo/fixtures/obstruction_barrier_1.jpg`.
   - Set claim to `BLOCKED`. Submit report.
2. **Review First Report Outcome**:
   - Inspect Gemini multimodal observations on the newly created incident page (`/incidents/:id`).
   - Verify the state machine: **Status remains UNVERIFIED**.
   - Note that AI visual inference identifies the obstruction, but the system does *not* automatically close the path from a single photograph.

---

## Part 3: Community Corroboration & Automatic Detour (1:30 – 2:30)
1. **Submit Distinct Photo from Account 2**:
   - Log in as Community Account 2 (`user2@demo.internal`).
   - Upload second distinct photo `demo/fixtures/obstruction_barrier_2.jpg` to segment `BC`.
2. **Inspect Corroboration Transition**:
   - Refresh incident page. Status automatically updates to **`CONFIRMED_BLOCKED`**.
   - Confirmation basis displays: *"Automated community corroboration (2+ distinct accounts & photographs within 30m window)"*.
   - Check Audit Trail showing event `COMMUNITY_CORROBORATION`.
3. **Verify Profile Detours on `/plan`**:
   - Select `GENERAL_WALK`: Detours via A-B-E-F-D (**620m**, +160m detour). Explain it uses link E-F which contains stairs.
   - Select `STEP_FREE`: Avoids stairs (E-F) and avoids unknown accessibility (F-C). Detours via A-B-G-H-D (**740m**, +280m detour).
   - Display turn-by-turn text itinerary explaining the detour rationale.

---

## Part 4: Clearance Submission & Moderator Full Check (2:30 – 3:30)
1. **Submit Clear Photo**:
   - Submit clear photo `demo/fixtures/clear_walkway.jpg` with claim `CLEAR`.
   - Show that status updates to **`REQUIRES_REVIEW` / `DISPUTED`**, but **the route remains safely detoured**!
   - Highlight the safety rule: A single camera angle does not prove the entire link is unobstructed.
2. **Moderator Segment Attestation & Clearance**:
   - Log in as Moderator (`moderator@routeshield.internal`).
   - Open Verification Panel on incident.
   - Select action `CLEAR`.
   - Check mandatory attestation: *"I attest that the whole selected pedestrian segment was checked and verified clear."*
   - Submit clearance.
3. **Restored Route**:
   - Return to Planner: Baseline route immediately restores to **460m** direct path.

---

## Part 5: Accessibility Pass & Automated Test Verification (3:30 – 4:00)
1. **Keyboard Flow**:
   - Demonstrate full tab/keyboard accessibility through dropdowns, forms, and buttons without needing a mouse.
2. **Test Suite Verification**:
   - Show terminal test suite output (`vitest run`):
     - `routing.test.ts` (460m / 620m / 740m / NO_ROUTE with BC+GH blocked).
     - `incident-policy.test.ts` (quorum rules, 30m window, duplicate hashes, attestation).
