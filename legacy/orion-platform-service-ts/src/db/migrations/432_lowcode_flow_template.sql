-- Migration 432: Lowcode Flow Template Market
-- Creates table for reusable lowcode flow templates

CREATE TABLE IF NOT EXISTS lowcode_flow_template (
  id VARCHAR(100) PRIMARY KEY,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  name VARCHAR(200) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  tags TEXT[] DEFAULT '{}',
  nodes TEXT NOT NULL DEFAULT '[]',
  edges TEXT NOT NULL DEFAULT '[]',
  icon TEXT,
  usage_count INTEGER NOT NULL DEFAULT 0,
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  created_by VARCHAR(200) NOT NULL DEFAULT 'system',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lowcode_template_tenant ON lowcode_flow_template(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lowcode_template_category ON lowcode_flow_template(category);
CREATE INDEX IF NOT EXISTS idx_lowcode_template_is_public ON lowcode_flow_template(is_public);
CREATE INDEX IF NOT EXISTS idx_lowcode_template_usage ON lowcode_flow_template(usage_count DESC);
