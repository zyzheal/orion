-- Rollback Migration 111_community_advanced
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: contributor_badges
DROP TABLE IF EXISTS contributor_badges CASCADE;

-- Dropping table: community_incentives
DROP TABLE IF EXISTS community_incentives CASCADE;

-- Dropping table: mentorship_pairs
DROP TABLE IF EXISTS mentorship_pairs CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_contributor_badge;
DROP INDEX IF EXISTS CREATE INDEX idx_contributor_badge;
DROP INDEX IF EXISTS CREATE INDEX idx_contributor_badge;
DROP INDEX IF EXISTS CREATE INDEX idx_contributor_badge;
DROP INDEX IF EXISTS CREATE INDEX idx_community_incentive;
DROP INDEX IF EXISTS CREATE INDEX idx_community_incentive;
DROP INDEX IF EXISTS CREATE INDEX idx_community_incentive;
DROP INDEX IF EXISTS CREATE INDEX idx_community_incentive;
DROP INDEX IF EXISTS CREATE INDEX idx_mentor;
DROP INDEX IF EXISTS CREATE INDEX idx_mentor;
DROP INDEX IF EXISTS CREATE INDEX idx_mentor;
DROP INDEX IF EXISTS CREATE INDEX idx_mentor;
DROP INDEX IF EXISTS CREATE INDEX idx_mentor;
