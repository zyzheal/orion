-- Auto-generated rollback for version 574. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

-- DROP EXTENSION is refused if another installed extension depends on pg_trgm,
-- which is the desired behaviour here: it fails loudly instead of cascading
-- away a dependent.
DROP EXTENSION IF EXISTS "pg_trgm";
