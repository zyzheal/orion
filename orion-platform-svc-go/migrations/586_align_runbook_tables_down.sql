-- Reversal of 586_align_runbook_tables.sql.

DROP INDEX IF EXISTS idx_runbook_execution_steps_execution;
DROP INDEX IF EXISTS idx_runbook_executions_started;
DROP INDEX IF EXISTS idx_runbook_executions_runbook;
DROP INDEX IF EXISTS idx_runbook_executions_tenant;

DROP TABLE IF EXISTS runbook_execution_steps;
DROP TABLE IF EXISTS runbook_executions;

ALTER TABLE runbooks DROP COLUMN IF EXISTS approved;
ALTER TABLE runbooks DROP COLUMN IF EXISTS owner;
ALTER TABLE runbooks DROP COLUMN IF EXISTS tags;
ALTER TABLE runbooks DROP COLUMN IF EXISTS steps;
ALTER TABLE runbooks DROP COLUMN IF EXISTS severity;
ALTER TABLE runbooks DROP COLUMN IF EXISTS category;
ALTER TABLE runbooks DROP COLUMN IF EXISTS description;
ALTER TABLE runbooks DROP COLUMN IF EXISTS title;

ALTER TABLE runbooks ALTER COLUMN value SET NOT NULL;
ALTER TABLE runbooks ALTER COLUMN name SET NOT NULL;
