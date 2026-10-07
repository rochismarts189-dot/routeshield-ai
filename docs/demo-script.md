# RouteShield AI — Demonstration Script (4-Minute Walkthrough)

Core message: **“Someone reports an obstruction once, and everyone planning that route afterward is warned before they encounter it and can take an alternative route.”**

Preflight the live provider first. See `verification-status.md`: a provider failure must remain visible and must not be presented as successful AI analysis. The times below assume that real inference and qualifying evidence have passed.

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
   - Upload your own authorized, preflight-tested obstruction photograph (the original barrier/walkway JPEGs are illustrations; the licensed historical fallen-tree photograph is explicitly labelled demo evidence in provenance.md).
   - Set claim to `BLOCKED`. Submit report.
2. **Review First Report Outcome**:
   - Inspect Gemini multimodal observations on the newly created incident page (`/incidents/:id`).
   - Verify the state machine: **Status remains UNVERIFIED**.
   - Note that a single photo does not confirm a block. Step-free planning can provisionally avoid a usable reported obstruction; general walking receives an unverified warning.

---

## Part 3: Community Corroboration & Automatic Detour (1:30 – 2:30)
1. **Submit Distinct Photo from Account 2**:
   - Log in as Community Account 2 (`user2@demo.internal`).
   - Upload a genuinely different authorized photograph to segment `BC`.
2. **Inspect Corroboration Transition**:
   - Refresh incident page. Status updates to **`CONFIRMED_BLOCKED`** only when the actual analyses qualify; otherwise it remains UNVERIFIED. Alternatively use an authorized moderator with qualifying evidence; clearly show and name that verification step.
   - Confirmation basis displays: *"Automated community corroboration (2+ distinct accounts & photographs within 30m window)"*.
   - Check Audit Trail showing event `COMMUNITY_CORROBORATION`.
3. **Verify Profile Detours on `/plan`**:
   - Select `GENERAL_WALK`: Detours via A-B-E-F-D (**620m**, +160m detour). Explain it uses link E-F which contains stairs.
   - Select `STEP_FREE`: Avoids stairs (E-F) and avoids unknown accessibility (F-C). Detours via A-B-G-H-D (**740m**, +280m detour).
   - Point to the prominent **Before you travel / Obstruction ahead** panel.
   - Show **Normal route A-B-C-D: 460m**, affected **B-C**, **Recommended alternative A-B-G-H-D: 740m**, and **Why this alternative?**
   - Open its evidence link to demonstrate that this warning came from the first traveler's report, not a prewritten alert.
   - Review the text itinerary and map's BLOCKED/REPORTED labels.
   - Say: “The first traveler encountered it. The next traveler learns before starting.”

---

## Part 4: Clearance Submission & Moderator Full Check (2:30 – 3:30)
1. **Submit Clear Photo**:
   - Submit a fresh authorized clear-passage photograph with claim `CLEAR`.
   - Show that status updates to **`REQUIRES_REVIEW` / `DISPUTED`**, but **the existing obstruction avoidance remains active**!
   - Highlight the safety rule: A single camera angle does not prove the entire link is unobstructed.
2. **Moderator Segment Attestation & Clearance**:
   - Log in as Moderator (`moderator@routeshield.internal`).
   - Open Verification Panel on incident.
   - Select action `CLEAR`, select the fresh qualifying clear report, and enter a verification reason.
   - Check mandatory attestation: *"I attest that the whole selected pedestrian segment was checked and verified clear."*
   - Submit clearance.
3. **Restored Route**:
   - Return to Planner: Refresh the planner; the baseline route restores to **460m** direct path.

---

## Part 5: Accessibility Pass & Automated Test Verification (3:30 – 4:00)
1. **Keyboard Flow**:
   - Demonstrate full tab/keyboard accessibility through dropdowns, forms, and buttons without needing a mouse.
2. **Test Suite Verification**:
   - Show terminal test suite output (`vitest run`):
     - `routing.test.ts` (460m / 620m / 740m / NO_ROUTE with BC+GH blocked).
     - `incident-policy.test.ts` (quorum rules, 30m window, duplicate hashes, attestation).

Preflight: provision all demo accounts yourself; these example emails are not automatically seeded. Use current observation timestamps and real live Gemini inference. Images are illustrative evidence for fictional Maple Ward, never claims about actual road locations. If the selected photos do not qualify for automatic corroboration, use explicit moderator evidence review rather than force or fabricate the model result.
