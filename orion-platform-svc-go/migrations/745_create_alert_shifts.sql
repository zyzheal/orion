-- Migration 745: Alert Shifts — 排班表持久化
CREATE TABLE IF NOT EXISTS alert_shifts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       TEXT NOT NULL,
    name            TEXT NOT NULL,
    team            TEXT,
    pattern         TEXT NOT NULL DEFAULT 'round_robin',
    start_time      TIME,
    end_time        TIME,
    weekdays        INTEGER[] NOT NULL DEFAULT '{1,2,3,4,5}',
    enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_alert_shifts_tenant ON alert_shifts(tenant_id, enabled);

CREATE TABLE IF NOT EXISTS alert_shift_assignments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_id        UUID NOT NULL REFERENCES alert_shifts(id) ON DELETE CASCADE,
    user_id         TEXT NOT NULL,
    role            TEXT NOT NULL DEFAULT 'primary',
    start_time      TIMESTAMPTZ NOT NULL,
    end_time        TIMESTAMPTZ NOT NULL,
    assigned        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_alert_shift_assignments_shift ON alert_shift_assignments(shift_id);
CREATE INDEX idx_alert_shift_assignments_user ON alert_shift_assignments(user_id);
