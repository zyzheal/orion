-- Migration: 350_create_builder_images.sql
-- Purpose: Persist builder image registry (previously in-memory only)

CREATE TABLE IF NOT EXISTS builder_images (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(100) NOT NULL UNIQUE,
    display_name    VARCHAR(200) NOT NULL,
    image           VARCHAR(500) NOT NULL,
    type            VARCHAR(50) NOT NULL,         -- node, python, go, java, dotnet, rust, custom
    version         VARCHAR(50) NOT NULL DEFAULT 'latest',
    description     TEXT DEFAULT '',
    pull_policy     VARCHAR(50) DEFAULT 'IfNotPresent',
    status          VARCHAR(20) DEFAULT 'active',  -- active, deprecated, disabled
    is_preset       BOOLEAN DEFAULT FALSE,
    env             JSONB,
    labels          JSONB,
    created_by      VARCHAR(100),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_builder_img_type ON builder_images(type);
CREATE INDEX IF NOT EXISTS idx_builder_img_status ON builder_images(status);
CREATE INDEX IF NOT EXISTS idx_builder_img_preset ON builder_images(is_preset);
