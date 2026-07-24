-- Migration 380: Inline Scripts PostgreSQL persistence
-- 内联脚本持久化表

CREATE TABLE IF NOT EXISTS inline_scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  script_content TEXT NOT NULL,
  language VARCHAR(50) NOT NULL DEFAULT 'shell',
  description TEXT,
  created_by VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inline_script_tenant ON inline_scripts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inline_script_name ON inline_scripts(name);
