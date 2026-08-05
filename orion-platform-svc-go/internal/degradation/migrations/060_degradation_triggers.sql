-- 060_degradation_triggers.sql
-- Adds degradation trigger and action persistence tables.
-- P1-27: Wire automatic degradation trigger to real DB persistence.

CREATE TABLE IF NOT EXISTS degradation_triggers (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     TEXT    NOT NULL,
    policy_id     TEXT    NOT NULL,
    status        TEXT    NOT NULL DEFAULT 'active',  -- active | resolved
    reason        TEXT    NOT NULL,
    error_rate    DOUBLE PRECISION,
    latency_ms    BIGINT,
    triggered_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at   TIMESTAMPTZ,
    resolved_by   TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS degradation_actions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trigger_id  UUID NOT NULL REFERENCES degradation_triggers(id),
    tenant_id   TEXT NOT NULL,
    action      TEXT NOT NULL,  -- rate_limit | circuit_break | fallback | degrade_response
    detail      TEXT,
    status      TEXT NOT NULL DEFAULT 'applied',  -- applied | reverted
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dt_tenant_policy ON degradation_triggers(tenant_id, policy_id);
CREATE INDEX IF NOT EXISTS idx_dt_status ON degradation_triggers(status);
CREATE INDEX IF NOT EXISTS idx_da_trigger ON degradation_actions(trigger_id);

-- Backfill existing degradations table if it doesn't have resolved fields.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='degradations' AND column_name='policy_id') THEN
        ALTER TABLE degradations ADD COLUMN policy_id TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='degradations' AND column_name='action') THEN
        ALTER TABLE degradations ADD COLUMN action TEXT DEFAULT 'degrade_response';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='degradations' AND column_name='status') THEN
        ALTER TABLE degradations ADD COLUMN status TEXT DEFAULT 'pending';
    END IF;
END $$;
