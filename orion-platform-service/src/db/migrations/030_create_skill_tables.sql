-- Migration 030: Skill Package Management
-- 创建技能包管理相关表：技能包、版本、评分

-- 技能包主表
CREATE TABLE IF NOT EXISTS skill_packages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(255) NOT NULL,
  version       VARCHAR(20) NOT NULL,
  description   TEXT NOT NULL,
  category      VARCHAR(50) NOT NULL,              -- data-processing | ai-ml | testing | deployment | monitoring | security | ci-cd | utility | custom
  tags          TEXT[] NOT NULL DEFAULT '{}',
  author        VARCHAR(255) NOT NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'draft',  -- draft | review | published | uninstalled
  schema        JSONB NOT NULL DEFAULT '{}',
  install_count INT NOT NULL DEFAULT 0,
  rating        DECIMAL(3, 2) NOT NULL DEFAULT 0.00,
  rating_count  INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_skill_packages_status ON skill_packages(status);
CREATE INDEX idx_skill_packages_category ON skill_packages(category);
CREATE INDEX idx_skill_packages_tags ON skill_packages USING GIN(tags);
CREATE INDEX idx_skill_packages_name ON skill_packages(name);

-- 技能版本历史表
CREATE TABLE IF NOT EXISTS skill_versions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id      UUID NOT NULL REFERENCES skill_packages(id) ON DELETE CASCADE,
  version       VARCHAR(20) NOT NULL,
  changelog     TEXT,
  schema        JSONB NOT NULL DEFAULT '{}',
  is_latest     BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_skill_versions_skill_id ON skill_versions(skill_id);
CREATE INDEX idx_skill_versions_latest ON skill_versions(skill_id, is_latest) WHERE is_latest = true;

-- 技能评分表
CREATE TABLE IF NOT EXISTS skill_reviews (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id      UUID NOT NULL REFERENCES skill_packages(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL,
  rating        INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (skill_id, user_id)
);

CREATE INDEX idx_skill_reviews_skill_id ON skill_reviews(skill_id);
