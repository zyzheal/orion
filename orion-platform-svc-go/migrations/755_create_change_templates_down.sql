-- Migration 755 down: Drop change_templates

BEGIN;

DROP INDEX IF EXISTS idx_change_templates_team;
DROP INDEX IF EXISTS idx_change_templates_active;
DROP INDEX IF EXISTS idx_change_templates_tenant;

DROP TABLE IF EXISTS change_templates;

COMMIT;
