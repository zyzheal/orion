-- Disaster-recovery module: the one relation its repository names that no
-- migration created, plus two columns on the one table that does exist that
-- cannot hold what the repository writes.
--
-- All six registered /disaster-recovery routes are mounted on every boot by
-- cmd/server/wiring-disaster-recovery.go, so all four gaps below are on live
-- routes.
--
-- 1. recovery_run has no DDL anywhere. Nothing in migrations/ creates or
--    alters it, in singular or plural spelling. POST
--    /disaster-recovery/plans/:id/run records every execution there, so the
--    run INSERT died with `pq: relation "recovery_run" does not exist` before
--    the plan's last_run update could run. This is the "the repository needed
--    a table" direction of the Round 52 F1 split: there is no plural variant
--    the migrations own, so the code was right and the DDL was missing.
--
-- 2. recovery_run had no ended_at and no error_message column. A finished run
--    therefore could not be recorded as finished: the service re-ran CreateRun
--    to persist the final status, which inserted a second row under a fresh id
--    and left the original row at status='running' forever. There was no
--    UPDATE for a run at all, and the failure reason the orchestrator computed
--    into DRResult.Error went nowhere.
--
-- 3. disaster_plans.steps is VARCHAR(255) while the repository stores a JSON
--    array of shell commands in it. Two realistic commands already overflow,
--    so POST and PUT /disaster-recovery/plans failed with `value too long for
--    type character varying(255)`. Widened to TEXT; the change is monotonic
--    and loses no data.
--
-- 4. disaster_plans.last_run is NOT NULL while models.DisasterPlan.LastRun is
--    a pointer that is nil until a plan is first run. Keeping NOT NULL would
--    make every POST /disaster-recovery/plans a not-null violation, so the
--    constraint is dropped: a plan that has never run has no last run.
--
-- disaster_plans is NOT renamed. Migration 124 creates it and 239, 570 and 572
-- all own the plural relation: 239 casts tenant_id to UUID, 570 adds
-- fk_disaster_plans_tenant, 572 adds created_by and updated_by. The repository
-- addressed disaster_plan (singular), which nothing ever created, and it was
-- renamed to match the migrations. That is the opposite direction of item 1
-- above, and the same direction as Round 52 F1: when the migrations are
-- unanimous on one spelling, the code follows them.

CREATE TABLE IF NOT EXISTS recovery_run (
    id            UUID PRIMARY KEY,
    plan_id       UUID NOT NULL,
    status        TEXT NOT NULL DEFAULT 'running',
    started_at    TIMESTAMP WITH TIME ZONE NOT NULL,
    ended_at      TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recovery_run_plan ON recovery_run(plan_id);
CREATE INDEX IF NOT EXISTS idx_recovery_run_status ON recovery_run(status);

-- A concurrent migration may create recovery_run first, in which case the
-- CREATE TABLE above is a no-op and these two columns are still absent.
-- ADD COLUMN IF NOT EXISTS keeps the pair order-independent.
ALTER TABLE recovery_run ADD COLUMN IF NOT EXISTS ended_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE recovery_run ADD COLUMN IF NOT EXISTS error_message TEXT;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'disaster_plans') THEN
        ALTER TABLE disaster_plans ALTER COLUMN steps TYPE TEXT USING steps::TEXT;
        ALTER TABLE disaster_plans ALTER COLUMN last_run DROP NOT NULL;
    END IF;
END $$;
