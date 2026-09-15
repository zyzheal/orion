-- Reversal of 666_create_disaster_recovery_missing_tables.sql.
--
-- If a concurrent migration created recovery_run first, this drops that table
-- rather than only the two columns 666 added. Down migrations in this repo are
-- best effort and 666 is the newest migration to touch the relation, so the
-- drop matches the CREATE that 666 would have made.

DROP INDEX IF EXISTS idx_recovery_run_status;
DROP INDEX IF EXISTS idx_recovery_run_plan;
DROP TABLE IF EXISTS recovery_run;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'disaster_plans') THEN
        ALTER TABLE disaster_plans ALTER COLUMN last_run SET NOT NULL;
        ALTER TABLE disaster_plans ALTER COLUMN steps TYPE VARCHAR(255) USING steps::VARCHAR(255);
    END IF;
END $$;
