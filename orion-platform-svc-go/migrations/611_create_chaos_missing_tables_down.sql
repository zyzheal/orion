-- Reverse 611_create_chaos_missing_tables.sql.
-- Order: child tables first; then drop added columns on chaos_experiments last.
DROP TABLE IF EXISTS chaos_recoveries;
DROP TABLE IF EXISTS chaos_injections;
DROP TABLE IF EXISTS chaos_experiment_runs;

ALTER TABLE chaos_experiments DROP COLUMN IF EXISTS auto_rollback;
ALTER TABLE chaos_experiments DROP COLUMN IF EXISTS steady_state_hypothesis;
ALTER TABLE chaos_experiments DROP COLUMN IF EXISTS faults;
ALTER TABLE chaos_experiments DROP COLUMN IF EXISTS scope;
