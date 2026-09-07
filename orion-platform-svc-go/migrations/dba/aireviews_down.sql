-- Down migration: remove dba_ai_reviews.
DROP INDEX IF EXISTS idx_dba_ai_reviews_verdict;
DROP INDEX IF EXISTS idx_dba_ai_reviews_tenant;
DROP TABLE IF EXISTS dba_ai_reviews;
