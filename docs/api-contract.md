# RouteShield AI — API Contract

All endpoints are mounted under `/api`. All JSON payloads and parameters are validated using Zod schemas.

## Error Format

All error responses return HTTP status >= 400 with a consistent payload:
```json
{
  "error": {
    "code": "ERROR_CODE_STRING",
    "message": "Human readable error description",
    "details": {}
  }
}
```

---

## 1. Public Endpoints

### `GET /api/health`
Liveness and demo disclaimer endpoint.
- **Response 200**:
  ```json
  {
    "status": "ok",
    "service": "RouteShield AI API",
    "network": "Fictional demonstration network — not live navigation",
    "timestamp": "2026-10-07T12:00:00.000Z"
  }
  ```

### `GET /api/network`
Returns the complete list of curated nodes and undirected edges.
- **Response 200**:
  ```json
  {
    "nodes": [
      { "id": "A", "name": "Transit Stop", "map_x": 40, "map_y": 180, "latitude": 12.0, "longitude": 77.0 }
    ],
    "edges": [
      { "id": "AB", "from_node": "A", "to_node": "B", "name": "Transit Stop to Market Corner", "length_m": 140, "step_free_status": "YES", "has_steps": false }
    ]
  }
  ```

### `POST /api/routes/plan`
Calculates deterministic baseline and detour routes under profile constraints.
- **Request Body**:
  ```json
  {
    "originId": "A",
    "destinationId": "D",
    "profile": "STEP_FREE"
  }
  ```
- **Response 200 (OK)**:
  ```json
  {
    "status": "OK",
    "profile": "STEP_FREE",
    "originId": "A",
    "originName": "Transit Stop",
    "destinationId": "D",
    "destinationName": "Clinic Entrance",
    "route": {
      "nodeIds": ["A", "B", "G", "H", "D"],
      "edgeIds": ["AB", "BG", "GH", "HD"],
      "distanceMeters": 740,
      "baselineDistanceMeters": 460,
      "distanceDifferenceMeters": 280,
      "itinerary": []
    },
    "warnings": [],
    "explanation": "Detour route of 740m (+280m compared to 460m baseline)..."
  }
  ```

### `GET /api/incidents`
Lists all community incidents with query filters (`?status=...&edgeId=...`).
- **Response 200**:
  ```json
  {
    "incidents": [
      {
        "id": "uuid",
        "edgeId": "BC",
        "edgeName": "Market Corner to Library Junction",
        "status": "CONFIRMED_BLOCKED",
        "blockedGeneral": true,
        "blockedStepFree": true,
        "disputed": false,
        "requiresReview": false,
        "version": 2,
        "reportsCount": 2,
        "distinctAccountsCount": 2,
        "updatedAt": "2026-10-07T12:00:00Z"
      }
    ]
  }
  ```

### `GET /api/incidents/:id`
Returns full incident details, evidence cards with signed photo URLs, and event history.
- **Response 200**:
  ```json
  {
    "incident": {
      "id": "uuid",
      "edgeId": "BC",
      "status": "CONFIRMED_BLOCKED",
      "confirmationBasis": "Automated community corroboration (2+ distinct accounts & photographs)",
      "reports": [],
      "events": []
    }
  }
  ```

---

## 2. Authentication

### `POST /api/auth/register`
Creates a standard user account (role is strictly `USER`).
- **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "displayName": "Alex Traveler",
    "password": "Password12345!"
  }
  ```
- **Response 201**: `{ "user": {...}, "token": "jwt..." }`

### `POST /api/auth/login`
Authenticates credentials and returns a short-lived bearer JWT.
- **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "Password12345!"
  }
  ```
- **Response 200**: `{ "user": {...}, "token": "jwt..." }`

### `GET /api/auth/me`
Returns current user session. Requires `Authorization: Bearer <token>`.

---

## 3. Reports & AI Inference

### `POST /api/reports`
Authenticated multipart upload (`photo` file, `edgeId`, `claim`, `description`, `observedAt`).
- Validates 5MB limit, normalizes pixels, computes SHA-256 hash.
- Invokes Gemini multimodal AI with strict JSON schema.
- Transactionally persists report and evaluates corroboration quorum.
- **Response 201**:
  ```json
  {
    "reportId": "uuid",
    "incidentId": "uuid",
    "analysisStatus": "COMPLETE",
    "incidentStatus": "UNVERIFIED",
    "analysis": {
      "obstruction_type": "CONSTRUCTION_BARRIER",
      "severity": "HIGH",
      "visible_extent": "FULL_WIDTH",
      "passability": { "general_walk": "BLOCKED", "step_free": "BLOCKED" },
      "confidence": 0.94,
      "observations": ["Full width scaffolding blocking sidewalk"]
    }
  }
  ```

### `POST /api/reports/:id/retry-analysis`
Retries failed Gemini analysis (max 3 attempts). Accessible by report owner or moderator.

### `POST /api/reports/:id/exclude`
Moderator action to exclude report from quorum calculations with reason.

---

## 4. Moderation

### `POST /api/incidents/:id/verify`
Moderator action with optimistic concurrency check (`expectedVersion`).
- **Request Body**:
  ```json
  {
    "action": "CLEAR",
    "expectedVersion": 2,
    "attestation": true,
    "reason": "On-site check confirmed full pathway opened."
  }
  ```
- **Response 200**: Updated incident record.
- **Response 409**: Conflict on stale version match.
