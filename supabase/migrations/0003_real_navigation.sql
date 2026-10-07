-- Optional real navigation is isolated from every Maple Ward table.
-- Empty by design: no fictional coordinates or incidents are imported.
CREATE TABLE IF NOT EXISTS routeshield.real_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL CHECK (char_length(label) BETWEEN 1 AND 120),
  latitude DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  created_by UUID NOT NULL REFERENCES routeshield.users(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'UNVERIFIED' CHECK (status IN ('UNVERIFIED', 'CONFIRMED_BLOCKED', 'CLEARED')),
  blocked_general BOOLEAN NOT NULL DEFAULT false,
  blocked_step_free BOOLEAN NOT NULL DEFAULT false,
  disputed BOOLEAN NOT NULL DEFAULT false,
  requires_review BOOLEAN NOT NULL DEFAULT false,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_evidence_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMPTZ,
  cleared_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  moderation_note TEXT CHECK (moderation_note IS NULL OR char_length(moderation_note) <= 1000),
  CONSTRAINT ck_real_incidents_unverified CHECK (
    status <> 'UNVERIFIED' OR (
      blocked_general = false AND
      blocked_step_free = false AND
      confirmed_at IS NULL AND
      cleared_at IS NULL
    )
  ),
  CONSTRAINT ck_real_incidents_confirmed CHECK (
    status <> 'CONFIRMED_BLOCKED' OR (
      (blocked_general = true OR blocked_step_free = true) AND
      confirmed_at IS NOT NULL AND
      cleared_at IS NULL AND
      dismissed_at IS NULL
    )
  ),
  CONSTRAINT ck_real_incidents_cleared CHECK (
    status <> 'CLEARED' OR (
      blocked_general = false AND
      blocked_step_free = false AND
      cleared_at IS NOT NULL AND
      dismissed_at IS NULL
    )
  ),
  CONSTRAINT ck_real_incidents_dismissal CHECK (
    dismissed_at IS NULL OR (
      status = 'UNVERIFIED' AND
      confirmed_at IS NULL AND
      cleared_at IS NULL
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_real_incidents_location
  ON routeshield.real_incidents (latitude, longitude) WHERE status <> 'CLEARED' AND dismissed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_real_incidents_status_updated_at
  ON routeshield.real_incidents (status, updated_at DESC);



-- Reports table
CREATE TABLE IF NOT EXISTS routeshield.real_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES routeshield.real_incidents(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES routeshield.users(id) ON DELETE RESTRICT,
  claim TEXT NOT NULL CHECK (claim IN ('BLOCKED', 'CLEAR', 'UNCERTAIN')),
  description TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 500),
  photo_key TEXT NOT NULL UNIQUE,
  photo_sha256 TEXT NOT NULL UNIQUE CHECK (photo_sha256 ~ '^[a-f0-9]{64}$'),
  content_type TEXT NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png')),
  byte_count INTEGER NOT NULL CHECK (byte_count > 0 AND byte_count <= 5242880),
  latitude DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90.0 AND 90.0),
  longitude DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180.0 AND 180.0),
  location_mode TEXT NOT NULL DEFAULT 'PIN_SELECTION' CHECK (location_mode = 'PIN_SELECTION'),
  observed_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  analysis_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (analysis_status IN ('PENDING', 'COMPLETE', 'FAILED')),
  analysis_model TEXT,
  analysis_json JSONB,
  analysis_error_code TEXT,
  analysis_attempts SMALLINT NOT NULL DEFAULT 0 CHECK (analysis_attempts BETWEEN 0 AND 3),
  excluded_from_quorum BOOLEAN NOT NULL DEFAULT false,
  exclusion_note TEXT CHECK (exclusion_note IS NULL OR char_length(exclusion_note) <= 1000),
  CONSTRAINT ck_real_reports_analysis_complete CHECK (
    analysis_status <> 'COMPLETE' OR (
      analysis_model IS NOT NULL AND
      analysis_json IS NOT NULL AND
      analysis_error_code IS NULL
    )
  ),
  CONSTRAINT ck_real_reports_analysis_pending CHECK (
    analysis_status <> 'PENDING' OR (
      analysis_json IS NULL AND
      analysis_error_code IS NULL
    )
  ),
  CONSTRAINT ck_real_reports_analysis_failed CHECK (
    analysis_status <> 'FAILED' OR (
      analysis_error_code IS NOT NULL AND
      analysis_json IS NULL
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_real_reports_incident_received
  ON routeshield.real_reports (incident_id, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_real_reports_reporter_received
  ON routeshield.real_reports (reporter_id, received_at DESC);

-- Incident Events table (Audit Trail)
CREATE TABLE IF NOT EXISTS routeshield.real_incident_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  incident_id UUID NOT NULL REFERENCES routeshield.real_incidents(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES routeshield.users(id) ON DELETE SET NULL,
  from_status TEXT CHECK (from_status IS NULL OR from_status IN ('UNVERIFIED', 'CONFIRMED_BLOCKED', 'CLEARED')),
  to_status TEXT NOT NULL CHECK (to_status IN ('UNVERIFIED', 'CONFIRMED_BLOCKED', 'CLEARED')),
  reason_code TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_real_incident_events_incident_created
  ON routeshield.real_incident_events (incident_id, created_at, id);


ALTER TABLE routeshield.real_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE routeshield.real_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE routeshield.real_incident_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA routeshield FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA routeshield FROM PUBLIC;
DO $$ DECLARE role_name TEXT; BEGIN
FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA routeshield FROM %I', role_name);
EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA routeshield FROM %I', role_name);
END IF; END LOOP; END $$;
