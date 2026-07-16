-- Migration: 353_create_community_tables.sql
-- Purpose: Persist community contributions, best practices, plugins, and contributors

CREATE TABLE IF NOT EXISTS contributions (
    id              VARCHAR(64) PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL DEFAULT '',
    user_id         VARCHAR(64) NOT NULL,
    type            VARCHAR(50) NOT NULL,
    title           VARCHAR(500) NOT NULL,
    description     TEXT NOT NULL,
    repository      VARCHAR(500),
    url             VARCHAR(500),
    tags            JSONB DEFAULT '[]',
    status          VARCHAR(20) DEFAULT 'pending',  -- pending, approved, rejected
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contributions_tenant_id ON contributions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contributions_user_id ON contributions(user_id);
CREATE INDEX IF NOT EXISTS idx_contributions_type ON contributions(type);
CREATE INDEX IF NOT EXISTS idx_contributions_status ON contributions(status);

CREATE TABLE IF NOT EXISTS best_practices (
    id              VARCHAR(64) PRIMARY KEY,
    title           VARCHAR(500) NOT NULL,
    description     TEXT NOT NULL,
    category        VARCHAR(50) NOT NULL,           -- pipeline, security, testing, deployment, monitoring, cost, general
    tags            JSONB DEFAULT '[]',
    content         TEXT NOT NULL,
    author_id       VARCHAR(64) NOT NULL,
    author_name     VARCHAR(200) NOT NULL,
    status          VARCHAR(20) DEFAULT 'published', -- draft, published, archived
    votes           INTEGER DEFAULT 0,
    views           INTEGER DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_best_practices_category ON best_practices(category);
CREATE INDEX IF NOT EXISTS idx_best_practices_status ON best_practices(status);
CREATE INDEX IF NOT EXISTS idx_best_practices_author ON best_practices(author_id);
CREATE INDEX IF NOT EXISTS idx_best_practices_votes ON best_practices(votes DESC);

CREATE TABLE IF NOT EXISTS community_plugins (
    id              VARCHAR(64) PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL DEFAULT '',
    name            VARCHAR(200) NOT NULL,
    version         VARCHAR(50) NOT NULL,
    description     TEXT NOT NULL,
    author          VARCHAR(200) NOT NULL,
    category        VARCHAR(50) NOT NULL,
    repository      VARCHAR(500) NOT NULL,
    compatibility   JSONB DEFAULT '[]',
    status          VARCHAR(20) DEFAULT 'pending',   -- pending, approved, rejected
    review_comment  TEXT,
    submitted_at    TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_community_plugins_tenant_id ON community_plugins(tenant_id);
CREATE INDEX IF NOT EXISTS idx_community_plugins_category ON community_plugins(category);
CREATE INDEX IF NOT EXISTS idx_community_plugins_status ON community_plugins(status);
CREATE INDEX IF NOT EXISTS idx_community_plugins_author ON community_plugins(author);

CREATE TABLE IF NOT EXISTS contributors (
    user_id         VARCHAR(64) PRIMARY KEY,
    username        VARCHAR(200) NOT NULL,
    contributions   INTEGER DEFAULT 0,
    types           JSONB DEFAULT '[]',
    joined_at       TIMESTAMPTZ DEFAULT NOW(),
    reputation      INTEGER DEFAULT 0,
    badges          JSONB DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS idx_contributors_reputation ON contributors(reputation DESC);
