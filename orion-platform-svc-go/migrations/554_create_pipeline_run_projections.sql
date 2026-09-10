-- Migration: Create pipeline_run_projections table for CQRS read model
-- Materialized view denormalized from domain_events for fast pipeline run queries.
--
-- Mirrors PostgresReadModelProjector.EnsureSchema (readmodel/read_model.go).
-- Without this table the projector's GetRunByID / ListRunsByPipeline return
-- "relation does not exist" instead of an empty result, because the CQRS
-- read side is wired in cmd/server/wiring-domain-cqrs.go but the table was
-- never created (EnsureSchema is a runtime helper, not called at boot).
--
-- Columns use TEXT (not UUID) because run_id is the pipeline run's external
-- identifier, not the domain_events.id UUID.

CREATE TABLE IF NOT EXISTS pipeline_run_projections (
    run_id            TEXT        NOT NULL PRIMARY KEY,
    pipeline_id       TEXT        NOT NULL,
    pipeline_name     TEXT        NOT NULL DEFAULT '',
    tenant_id         TEXT        NOT NULL,
    status            TEXT        NOT NULL DEFAULT 'pending',
    branch            TEXT        NOT NULL DEFAULT '',
    trigger_source    TEXT        NOT NULL DEFAULT '',
    started_at        TIMESTAMPTZ,
    completed_at      TIMESTAMPTZ,
    total_duration_ms BIGINT      NOT NULL DEFAULT 0,
    error_message     TEXT        NOT NULL DEFAULT '',
    version           INTEGER     NOT NULL DEFAULT 0,
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_run_projections_tenant
    ON pipeline_run_projections (tenant_id, pipeline_id, status);

CREATE INDEX IF NOT EXISTS idx_pipeline_run_projections_updated_at
    ON pipeline_run_projections (updated_at DESC);
