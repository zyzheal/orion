-- Migration 001: Skill Service Schema
-- Skill package management tables for orion-skill-svc
-- Version: 1.0.0

-- SKILLS TABLE: Main skill package definitions
CREATE TABLE IF NOT EXISTS skills (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(255) NOT NULL UNIQUE,
  description     TEXT NOT NULL,
  category        VARCHAR(100) NOT NULL,
  author          VARCHAR(255) NOT NULL,
  repository_url  TEXT,
  documentation_url TEXT,
  icon_url        TEXT,
  tags            TEXT[] NOT NULL DEFAULT '{}',
  is_public       BOOLEAN NOT NULL DEFAULT true,
  is_verified     BOOLEAN NOT NULL DEFAULT false,
  status          VARCHAR(20) NOT NULL DEFAULT 'active',  -- active | deprecated | archived
  total_installs  INTEGER NOT NULL DEFAULT 0,
  average_rating  NUMERIC(3, 2) NOT NULL DEFAULT 0.00,
  rating_count    INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for skills table
CREATE INDEX idx_skills_category ON skills(category);
CREATE INDEX idx_skills_author ON skills(author);
CREATE INDEX idx_skills_status ON skills(status);
CREATE INDEX idx_skills_is_public ON skills(is_public);
CREATE INDEX idx_skills_is_verified ON skills(is_verified);
CREATE INDEX idx_skills_tags ON skills USING GIN(tags);
CREATE INDEX idx_skills_total_installs ON skills(total_installs DESC);
CREATE INDEX idx_skills_average_rating ON skills(average_rating DESC);
CREATE INDEX idx_skills_name_search ON skills USING gin(to_tsvector('english', name));
CREATE INDEX idx_skills_description_search ON skills USING gin(to_tsvector('english', description));

-- SKILL VERSIONS TABLE: Version history for each skill
CREATE TABLE IF NOT EXISTS skill_versions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id      UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  version       VARCHAR(50) NOT NULL,
  changelog     TEXT,
  manifest      JSONB NOT NULL DEFAULT '{}',
  download_url  TEXT,
  checksum      VARCHAR(128),
  is_latest     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (skill_id, version)
);

-- Indexes for skill_versions table
CREATE INDEX idx_skill_versions_skill_id ON skill_versions(skill_id);
CREATE INDEX idx_skill_versions_latest ON skill_versions(skill_id, is_latest) WHERE is_latest = true;

-- SKILL RATINGS TABLE: User ratings and reviews
CREATE TABLE IF NOT EXISTS skill_ratings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id      UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL,
  score         INTEGER NOT NULL CHECK (score >= 1 AND score <= 5),
  comment       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (skill_id, user_id)
);

-- Indexes for skill_ratings table
CREATE INDEX idx_skill_ratings_skill_id ON skill_ratings(skill_id);
CREATE INDEX idx_skill_ratings_user_id ON skill_ratings(user_id);

-- SKILL INSTALLS TABLE: Installation tracking
CREATE TABLE IF NOT EXISTS skill_installs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id      UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  version       VARCHAR(50),
  installed_by  UUID,
  installed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for skill_installs table
CREATE INDEX idx_skill_installs_skill_id ON skill_installs(skill_id);
CREATE INDEX idx_skill_installs_installed_by ON skill_installs(installed_by);
CREATE INDEX idx_skill_installs_installed_at ON skill_installs(installed_at DESC);

-- Enable row-level security (optional, for multi-tenant)
-- ALTER TABLE skills ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE skill_versions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE skill_ratings ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE skill_installs ENABLE ROW LEVEL SECURITY;