-- 111: Community Advanced
-- 贡献者徽章、社区激励、导师配对

-- contributor_badges 表（贡献者徽章）
CREATE TABLE IF NOT EXISTS contributor_badges (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  badge_name        VARCHAR(200) NOT NULL,
  badge_type        VARCHAR(50) NOT NULL,                        -- achievement, milestone, specialty, event, honorary
  description       TEXT,
  icon_url          VARCHAR(500),
  criteria          JSONB NOT NULL DEFAULT '{}',
  rarity            VARCHAR(20) NOT NULL DEFAULT 'common',       -- common, uncommon, rare, epic, legendary
  category          VARCHAR(100),
  enabled           BOOLEAN NOT NULL DEFAULT true,
  created_by        VARCHAR(100) NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_contributor_badges_tenant ON contributor_badges(tenant_id);
CREATE INDEX idx_contributor_badges_type ON contributor_badges(badge_type);
CREATE INDEX idx_contributor_badges_rarity ON contributor_badges(rarity);
CREATE INDEX idx_contributor_badges_enabled ON contributor_badges(enabled) WHERE enabled = true;

-- community_incentives 表（社区激励）
CREATE TABLE IF NOT EXISTS community_incentives (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  incentive_name    VARCHAR(200) NOT NULL,
  incentive_type    VARCHAR(50) NOT NULL,                        -- bounty, reward, recognition, swag, credit
  description       TEXT,
  value             FLOAT,
  currency          VARCHAR(10) DEFAULT 'points',
  eligibility       JSONB NOT NULL DEFAULT '{}',
  max_redemptions   INT,
  current_redemptions INT NOT NULL DEFAULT 0,
  start_date        TIMESTAMPTZ,
  end_date          TIMESTAMPTZ,
  status            VARCHAR(30) NOT NULL DEFAULT 'active',       -- draft, active, paused, expired
  created_by        VARCHAR(100) NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_community_incentives_tenant ON community_incentives(tenant_id);
CREATE INDEX idx_community_incentives_type ON community_incentives(incentive_type);
CREATE INDEX idx_community_incentives_status ON community_incentives(status);
CREATE INDEX idx_community_incentives_dates ON community_incentives(start_date, end_date);

-- mentorship_pairs 表（导师配对）
CREATE TABLE IF NOT EXISTS mentorship_pairs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  mentor_id         VARCHAR(100) NOT NULL,
  mentee_id         VARCHAR(100) NOT NULL,
  topic             VARCHAR(200) NOT NULL,
  description       TEXT,
  status            VARCHAR(30) NOT NULL DEFAULT 'pending',      -- pending, active, completed, cancelled
  start_date        TIMESTAMPTZ,
  end_date          TIMESTAMPTZ,
  sessions_count    INT NOT NULL DEFAULT 0,
  goals             JSONB NOT NULL DEFAULT '[]',
  feedback          JSONB NOT NULL DEFAULT '{}',
  created_by        VARCHAR(100) NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_mentorship_pairs_tenant ON mentorship_pairs(tenant_id);
CREATE INDEX idx_mentorship_pairs_mentor ON mentorship_pairs(mentor_id);
CREATE INDEX idx_mentorship_pairs_mentee ON mentorship_pairs(mentee_id);
CREATE INDEX idx_mentorship_pairs_status ON mentorship_pairs(status);
CREATE INDEX idx_mentorship_pairs_topic ON mentorship_pairs(topic);

-- RLS
ALTER TABLE contributor_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_incentives ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentorship_pairs ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_contributor_badges ON contributor_badges
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));
CREATE POLICY tenant_isolation_community_incentives ON community_incentives
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));
CREATE POLICY tenant_isolation_mentorship_pairs ON mentorship_pairs
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));
