-- Migration: 388_create_community_advanced_tables.sql
-- Purpose: Persist community advanced features (badges, incentive programs, mentorship pairs)

CREATE TABLE IF NOT EXISTS community_badges (
  id VARCHAR(200) PRIMARY KEY,
  user_id VARCHAR(200) NOT NULL,
  type VARCHAR(100) NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS community_incentive_programs (
  id VARCHAR(200) PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  config JSONB DEFAULT '{}',
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS community_mentorship_pairs (
  id VARCHAR(200) PRIMARY KEY,
  mentor_id VARCHAR(200) NOT NULL,
  mentee_id VARCHAR(200) NOT NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  goals TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_community_badges_user ON community_badges(user_id);
CREATE INDEX idx_community_badges_tenant ON community_badges(tenant_id);
CREATE INDEX idx_community_incentive_tenant ON community_incentive_programs(tenant_id);
CREATE INDEX idx_community_mentorship_tenant ON community_mentorship_pairs(tenant_id);
CREATE INDEX idx_community_mentorship_mentor ON community_mentorship_pairs(mentor_id);
