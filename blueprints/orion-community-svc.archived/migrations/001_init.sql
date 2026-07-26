-- Migration 001: Community Service Core Tables
-- Creates all core tables for community contributions, plugins, reviews, and feedback
-- Version: 1.0.0

-- ==================== Contributions ====================
CREATE TABLE IF NOT EXISTS contributions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id         VARCHAR(255) NOT NULL,
  author_name       VARCHAR(255) NOT NULL,
  type              VARCHAR(50) NOT NULL,
  title             VARCHAR(500) NOT NULL,
  description       TEXT,
  repository_url    VARCHAR(1000),
  documentation_url VARCHAR(1000),
  version           VARCHAR(50) NOT NULL DEFAULT '0.0.1',
  status            VARCHAR(50) NOT NULL DEFAULT 'draft',
  tags              JSONB NOT NULL DEFAULT '[]',
  downloads_count   INTEGER NOT NULL DEFAULT 0,
  stars_count       INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_contributions_author ON contributions(author_id);
CREATE INDEX idx_contributions_type ON contributions(type);
CREATE INDEX idx_contributions_status ON contributions(status);
CREATE INDEX idx_contributions_created_at ON contributions(created_at);

-- ==================== Plugins ====================
CREATE TABLE IF NOT EXISTS plugins (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contribution_id   UUID,
  name              VARCHAR(255) NOT NULL,
  description       TEXT,
  author_id         VARCHAR(255) NOT NULL,
  author_name       VARCHAR(255) NOT NULL,
  version           VARCHAR(50) NOT NULL DEFAULT '0.0.1',
  manifest          JSONB NOT NULL DEFAULT '{}',
  download_url      VARCHAR(1000),
  checksum_sha256   VARCHAR(64),
  status            VARCHAR(50) NOT NULL DEFAULT 'pending_review',
  category          VARCHAR(100),
  tags              JSONB NOT NULL DEFAULT '[]',
  downloads_count   INTEGER NOT NULL DEFAULT 0,
  rating_avg        DECIMAL(3, 2) NOT NULL DEFAULT 0.00,
  rating_count      INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_plugins_author ON plugins(author_id);
CREATE INDEX idx_plugins_contribution ON plugins(contribution_id);
CREATE INDEX idx_plugins_status ON plugins(status);
CREATE INDEX idx_plugins_category ON plugins(category);
CREATE INDEX idx_plugins_name ON plugins(name);

-- ==================== Reviews ====================
CREATE TABLE IF NOT EXISTS reviews (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id       VARCHAR(255) NOT NULL,
  target_type     VARCHAR(50) NOT NULL,
  reviewer_id     VARCHAR(255) NOT NULL,
  reviewer_name   VARCHAR(255) NOT NULL,
  rating          INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title           VARCHAR(500),
  content         TEXT,
  status          VARCHAR(50) NOT NULL DEFAULT 'published',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reviews_target ON reviews(target_id, target_type);
CREATE INDEX idx_reviews_reviewer ON reviews(reviewer_id);
CREATE INDEX idx_reviews_rating ON reviews(rating);
CREATE INDEX idx_reviews_status ON reviews(status);

-- ==================== Feedback ====================
CREATE TABLE IF NOT EXISTS feedback (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id       VARCHAR(255) NOT NULL,
  target_type     VARCHAR(50) NOT NULL,
  user_id         VARCHAR(255) NOT NULL,
  user_name       VARCHAR(255) NOT NULL,
  type            VARCHAR(100) NOT NULL DEFAULT 'general',
  content         TEXT NOT NULL,
  severity        VARCHAR(20) NOT NULL DEFAULT 'info',
  status          VARCHAR(50) NOT NULL DEFAULT 'open',
  resolution      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_feedback_target ON feedback(target_id, target_type);
CREATE INDEX idx_feedback_user ON feedback(user_id);
CREATE INDEX idx_feedback_severity ON feedback(severity);
CREATE INDEX idx_feedback_status ON feedback(status);

-- ==================== Migration Info ====================
CREATE TABLE IF NOT EXISTS community_schema_migrations (
  version             VARCHAR(20) PRIMARY KEY,
  applied_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  description         TEXT
);

INSERT INTO community_schema_migrations (version, description)
VALUES ('001', 'Initial community service tables: contributions, plugins, reviews, feedback');
