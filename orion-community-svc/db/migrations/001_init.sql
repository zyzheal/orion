-- orion-community-svc Database Migration
-- Initial schema for community service (badges, incentives, mentors, best practices)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Badges Table
CREATE TABLE IF NOT EXISTS badges (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              VARCHAR(255) NOT NULL,
  description       TEXT,
  icon_url          VARCHAR(500),
  level             INTEGER NOT NULL DEFAULT 1,
  category          VARCHAR(100),
  criteria          JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Incentives Table
CREATE TABLE IF NOT EXISTS incentives (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              VARCHAR(255) NOT NULL,
  description       TEXT,
  type              VARCHAR(100) NOT NULL,
  value             DECIMAL(10,2) NOT NULL,
  currency          VARCHAR(10) DEFAULT 'USD',
  total_budget      DECIMAL(12,2),
  remaining_budget  DECIMAL(12,2),
  start_date        TIMESTAMPTZ,
  end_date          TIMESTAMPTZ,
  status            VARCHAR(50) NOT NULL DEFAULT 'active',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Incentive Awards Table (tracking who earned what)
CREATE TABLE IF NOT EXISTS incentive_awards (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  incentive_id      UUID NOT NULL,
  user_id           VARCHAR(100) NOT NULL,
  badge_id          UUID,
  amount            DECIMAL(10,2),
  reason            TEXT,
  awarded_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (incentive_id) REFERENCES incentives(id) ON DELETE CASCADE,
  FOREIGN KEY (badge_id) REFERENCES badges(id) ON DELETE SET NULL
);

-- Mentors Table
CREATE TABLE IF NOT EXISTS mentors (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           VARCHAR(100) NOT NULL UNIQUE,
  display_name      VARCHAR(255) NOT NULL,
  bio               TEXT,
  expertise         JSONB DEFAULT '[]',
  rating_avg        DECIMAL(3,2) DEFAULT 0,
  rating_count      INTEGER DEFAULT 0,
  mentee_count      INTEGER DEFAULT 0,
  availability      VARCHAR(50) DEFAULT 'available',
  hourly_rate       DECIMAL(10,2),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Best Practices Table
CREATE TABLE IF NOT EXISTS best_practices (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         VARCHAR(100),
  title             VARCHAR(500) NOT NULL,
  content           TEXT NOT NULL,
  category          VARCHAR(100),
  tags              JSONB DEFAULT '[]',
  author_id         VARCHAR(100) NOT NULL,
  upvote_count      INTEGER DEFAULT 0,
  downvote_count    INTEGER DEFAULT 0,
  view_count        INTEGER DEFAULT 0,
  status            VARCHAR(50) NOT NULL DEFAULT 'published',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User Badges (many-to-many)
CREATE TABLE IF NOT EXISTS user_badges (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           VARCHAR(100) NOT NULL,
  badge_id          UUID NOT NULL,
  earned_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (badge_id) REFERENCES badges(id) ON DELETE CASCADE
);

-- Mentor Sessions Table
CREATE TABLE IF NOT EXISTS mentor_sessions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mentor_id         UUID NOT NULL,
  mentee_id         VARCHAR(100) NOT NULL,
  topic             VARCHAR(500),
  notes             TEXT,
  scheduled_at      TIMESTAMPTZ NOT NULL,
  duration_minutes  INTEGER NOT NULL DEFAULT 60,
  status            VARCHAR(50) NOT NULL DEFAULT 'scheduled',
  rating            INTEGER,
  feedback          TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (mentor_id) REFERENCES mentors(id) ON DELETE CASCADE
);

-- Best Practice Votes Table
CREATE TABLE IF NOT EXISTS best_practice_votes (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  practice_id       UUID NOT NULL,
  user_id           VARCHAR(100) NOT NULL,
  vote_type         VARCHAR(10) NOT NULL CHECK (vote_type IN ('up', 'down')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (practice_id) REFERENCES best_practices(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_badges_level ON badges(level);
CREATE INDEX idx_badges_category ON badges(category);

CREATE INDEX idx_incentives_status ON incentives(status);
CREATE INDEX idx_incentives_dates ON incentives(start_date, end_date);

CREATE INDEX idx_incentive_awards_incentive ON incentive_awards(incentive_id);
CREATE INDEX idx_incentive_awards_user ON incentive_awards(user_id);

CREATE INDEX idx_mentors_user ON mentors(user_id);
CREATE INDEX idx_mentors_rating ON mentors(rating_avg DESC);

CREATE INDEX idx_best_practices_tenant ON best_practices(tenant_id);
CREATE INDEX idx_best_practices_category ON best_practices(category);
CREATE INDEX idx_best_practices_author ON best_practices(author_id);
CREATE INDEX idx_best_practices_status ON best_practices(status);
CREATE INDEX idx_best_practices_tags ON best_practices USING GIN(tags);

CREATE INDEX idx_user_badges_user ON user_badges(user_id);
CREATE INDEX idx_user_badges_badge ON user_badges(badge_id);

CREATE INDEX idx_mentor_sessions_mentor ON mentor_sessions(mentor_id);
CREATE INDEX idx_mentor_sessions_mentee ON mentor_sessions(mentee_id);
CREATE INDEX idx_mentor_sessions_status ON mentor_sessions(status);

CREATE INDEX idx_bp_votes_practice ON best_practice_votes(practice_id);
CREATE INDEX idx_bp_votes_user ON best_practice_votes(user_id);

-- Rollback:
-- DROP TABLE IF EXISTS best_practice_votes, mentor_sessions, user_badges, best_practices, mentors, incentive_awards, incentives, badges;
