-- ChatOps Recommendations persistence
-- Migrates EventSubscriber activeRecommendations Map() to PostgreSQL

CREATE TABLE IF NOT EXISTS chatops_recommendations (
  id VARCHAR(128) PRIMARY KEY,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  type VARCHAR(32) NOT NULL,
  severity VARCHAR(16) NOT NULL DEFAULT 'info',
  title VARCHAR(512) NOT NULL,
  description TEXT,
  actions JSONB NOT NULL DEFAULT '[]',
  source VARCHAR(64),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chatops_recommendations_type ON chatops_recommendations(type);
CREATE INDEX IF NOT EXISTS idx_chatops_recommendations_severity ON chatops_recommendations(severity);
CREATE INDEX IF NOT EXISTS idx_chatops_recommendations_tenant_id ON chatops_recommendations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_chatops_recommendations_created_at ON chatops_recommendations(created_at DESC);
