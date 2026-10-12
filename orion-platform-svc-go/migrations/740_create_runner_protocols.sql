-- Migration 740: Runner Protocol Extension — SSH/K8s-Exec/gRPC
-- P0-D1: 当前仅 HTTP 一种 → 补 4 种

CREATE TABLE IF NOT EXISTS runner_protocols (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       TEXT NOT NULL,
    name            TEXT NOT NULL,
    protocol_type   TEXT NOT NULL,
    -- Types: http, ssh, k8s_exec, grpc
    endpoint        TEXT NOT NULL,
    config          JSONB NOT NULL DEFAULT '{}',
    credential_ref  TEXT,
    enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, name)
);

CREATE INDEX idx_runner_protocols_tenant ON runner_protocols(tenant_id, enabled);
CREATE INDEX idx_runner_protocols_type ON runner_protocols(tenant_id, protocol_type);

-- Add protocol_id to existing runner_agents if table exists
ALTER TABLE runner_agents
    ADD COLUMN IF NOT EXISTS protocol_id UUID REFERENCES runner_protocols(id) ON DELETE SET NULL;
