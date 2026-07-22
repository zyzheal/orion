-- Migration 232: Deployment History Enhancement
-- Add updated_at column to deployments table for full Repository pattern support

ALTER TABLE deployments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Rollback:
-- ALTER TABLE deployments DROP COLUMN IF EXISTS updated_at;
