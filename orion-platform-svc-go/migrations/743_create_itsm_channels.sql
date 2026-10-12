-- Migration 743: ITSM Channel Type — 渠道类型定义
CREATE TABLE IF NOT EXISTS itsm_channel_types (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       TEXT NOT NULL,
    name            TEXT NOT NULL,
    channel_type    TEXT NOT NULL,
    -- Types: email, web, chat, phone, api, social
    config          JSONB NOT NULL DEFAULT '{}',
    enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, name)
);
CREATE INDEX idx_itsm_channel_types_tenant ON itsm_channel_types(tenant_id);
