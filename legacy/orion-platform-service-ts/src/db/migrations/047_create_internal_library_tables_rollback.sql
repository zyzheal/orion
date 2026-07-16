-- Rollback Migration 047_create_internal_library_tables
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: internal_libraries
DROP TABLE IF EXISTS internal_libraries CASCADE;

-- Dropping table: library_versions
DROP TABLE IF EXISTS library_versions CASCADE;

-- Dropping table: library_dependents
DROP TABLE IF EXISTS library_dependents CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_internal_librarie;
DROP INDEX IF EXISTS CREATE INDEX idx_internal_librarie;
DROP INDEX IF EXISTS CREATE INDEX idx_internal_librarie;
DROP INDEX IF EXISTS CREATE INDEX idx_internal_librarie;
DROP INDEX IF EXISTS CREATE INDEX idx_internal_librarie;
DROP INDEX IF EXISTS CREATE INDEX idx_library_ver;
DROP INDEX IF EXISTS CREATE INDEX idx_library_ver;
DROP INDEX IF EXISTS CREATE INDEX idx_library_ver;
DROP INDEX IF EXISTS CREATE INDEX idx_library_dependent;
DROP INDEX IF EXISTS CREATE INDEX idx_library_dependent;
DROP INDEX IF EXISTS CREATE INDEX idx_library_dependent;
