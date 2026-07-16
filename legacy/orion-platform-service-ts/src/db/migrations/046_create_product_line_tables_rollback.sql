-- Rollback Migration 046_create_product_line_tables
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: product_lines
DROP TABLE IF EXISTS product_lines CASCADE;

-- Dropping table: release_trains
DROP TABLE IF EXISTS release_trains CASCADE;

-- Dropping table: hotfix_channels
DROP TABLE IF EXISTS hotfix_channels CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_product_line;
DROP INDEX IF EXISTS CREATE INDEX idx_product_line;
DROP INDEX IF EXISTS CREATE INDEX idx_product_line;
DROP INDEX IF EXISTS CREATE INDEX idx_product_line;
DROP INDEX IF EXISTS CREATE INDEX idx_relea;
DROP INDEX IF EXISTS CREATE INDEX idx_relea;
DROP INDEX IF EXISTS CREATE INDEX idx_relea;
DROP INDEX IF EXISTS CREATE INDEX idx_hotfix_channel;
DROP INDEX IF EXISTS CREATE INDEX idx_hotfix_channel;
