CREATE TABLE IF NOT EXISTS alert_silences (
  id          VARCHAR(255) PRIMARY KEY,
  created_by  VARCHAR(255) NOT NULL,
  matchers    JSONB NOT NULL DEFAULT '[]',
  starts_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at     TIMESTAMPTZ,
  comment     TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_silences_active
  ON alert_silences(is_active, starts_at, ends_at);

CREATE INDEX IF NOT EXISTS idx_silences_created
  ON alert_silences(created_at DESC);
