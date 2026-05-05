-- 104: Community
-- 社区贡献者、社区插件、社区讨论

-- community_contributors 表（社区贡献者）
CREATE TABLE IF NOT EXISTS community_contributors (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id           VARCHAR(100) NOT NULL,
  display_name      VARCHAR(200) NOT NULL,
  avatar_url        VARCHAR(500),
  bio               TEXT,
  expertise_areas   JSONB NOT NULL DEFAULT '[]',
  contribution_count INT NOT NULL DEFAULT 0,
  reputation_score  INT NOT NULL DEFAULT 0,
  level             VARCHAR(20) NOT NULL DEFAULT 'newcomer',   -- newcomer, contributor, core, maintainer, legend
  social_links      JSONB NOT NULL DEFAULT '{}',
  joined_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_community_contributors_tenant ON community_contributors(tenant_id);
CREATE INDEX idx_community_contributors_user ON community_contributors(user_id);
CREATE INDEX idx_community_contributors_level ON community_contributors(level);
CREATE INDEX idx_community_contributors_reputation ON community_contributors(reputation_score DESC);

-- community_plugins 表（社区插件）
CREATE TABLE IF NOT EXISTS community_plugins (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plugin_name       VARCHAR(200) NOT NULL,
  plugin_version    VARCHAR(50) NOT NULL DEFAULT '1.0.0',
  description       TEXT,
  category          VARCHAR(100) NOT NULL,                     -- ci-cd, monitoring, security, ai, deploy
  author_id         VARCHAR(100) NOT NULL,
  repository_url    VARCHAR(500),
  download_url      VARCHAR(500),
  install_count     INT NOT NULL DEFAULT 0,
  rating            FLOAT DEFAULT 0,
  rating_count      INT NOT NULL DEFAULT 0,
  status            VARCHAR(30) NOT NULL DEFAULT 'published',  -- draft, published, archived, deprecated
  tags              JSONB NOT NULL DEFAULT '[]',
  compatibility     JSONB NOT NULL DEFAULT '{}',
  published_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_community_plugins_tenant ON community_plugins(tenant_id);
CREATE INDEX idx_community_plugins_category ON community_plugins(category);
CREATE INDEX idx_community_plugins_status ON community_plugins(status);
CREATE INDEX idx_community_plugins_author ON community_plugins(author_id);
CREATE INDEX idx_community_plugins_rating ON community_plugins(rating DESC);

-- community_discussions 表（社区讨论）
CREATE TABLE IF NOT EXISTS community_discussions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title             VARCHAR(500) NOT NULL,
  body              TEXT NOT NULL,
  discussion_type   VARCHAR(50) NOT NULL DEFAULT 'question',   -- question, idea, discussion, tutorial, announcement
  author_id         VARCHAR(100) NOT NULL,
  status            VARCHAR(30) NOT NULL DEFAULT 'open',       -- open, resolved, locked, archived
  view_count        INT NOT NULL DEFAULT 0,
  reply_count       INT NOT NULL DEFAULT 0,
  like_count        INT NOT NULL DEFAULT 0,
  tags              JSONB NOT NULL DEFAULT '[]',
  resolved_by       VARCHAR(100),
  resolved_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_community_discussions_tenant ON community_discussions(tenant_id);
CREATE INDEX idx_community_discussions_type ON community_discussions(discussion_type);
CREATE INDEX idx_community_discussions_status ON community_discussions(status);
CREATE INDEX idx_community_discussions_author ON community_discussions(author_id);
CREATE INDEX idx_community_discussions_created ON community_discussions(created_at DESC);

-- RLS
ALTER TABLE community_contributors ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_plugins ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_discussions ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_community_contributors ON community_contributors
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));
CREATE POLICY tenant_isolation_community_plugins ON community_plugins
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));
CREATE POLICY tenant_isolation_community_discussions ON community_discussions
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));
