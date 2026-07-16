-- Migration 061: Create weekly_reports table
-- Stores auto-generated weekly reports for audit and history

CREATE TABLE IF NOT EXISTS weekly_reports (
  id VARCHAR(64) PRIMARY KEY,
  team_id VARCHAR(64) NOT NULL DEFAULT 'default',
  week_start TIMESTAMPTZ NOT NULL,
  week_end TIMESTAMPTZ NOT NULL,
  report_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_weekly_reports_week ON weekly_reports (week_start);
CREATE INDEX IF NOT EXISTS idx_weekly_reports_team ON weekly_reports (team_id);
