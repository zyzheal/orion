-- 655_create_ticketing_missing_tables.sql
-- ticketing 模块 9 张表无 CREATE TABLE。
-- 注: 部分表用 RETURNING id 但 INSERT 列不含 id, 由 DEFAULT gen_random_uuid() 自动生成。
-- ticketing_service_state 用 (tenant_id) 单列主键 (ON CONFLICT upsert 模式)。
-- ticketing_dispatch_weights 用 (tenant_id, engineer_id) 复合主键 (ON CONFLICT upsert 模式)。
-- 回滚见 655_create_ticketing_missing_tables_down.sql。

CREATE TABLE IF NOT EXISTS ticketing_assignment_rules (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID NOT NULL,
    name       TEXT NOT NULL,
    conditions JSONB DEFAULT '{}',
    action     TEXT NOT NULL DEFAULT '',
    target_id  UUID,
    enabled    BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ticketing_assignment_rules_tenant ON ticketing_assignment_rules(tenant_id);

CREATE TABLE IF NOT EXISTS ticketing_automation_rules (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID NOT NULL,
    name       TEXT NOT NULL,
    trigger    TEXT NOT NULL DEFAULT '',
    condition  TEXT NOT NULL DEFAULT '',
    action     TEXT NOT NULL DEFAULT '',
    enabled    BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ticketing_automation_rules_tenant ON ticketing_automation_rules(tenant_id);

CREATE TABLE IF NOT EXISTS ticketing_dispatch_engineers (
    id            UUID PRIMARY KEY,
    tenant_id     UUID NOT NULL,
    user_id       UUID,
    name          TEXT NOT NULL DEFAULT '',
    skills        JSONB DEFAULT '[]',
    max_tickets   INTEGER NOT NULL DEFAULT 0,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    current_load  INTEGER NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ticketing_dispatch_engineers_tenant ON ticketing_dispatch_engineers(tenant_id);

CREATE TABLE IF NOT EXISTS ticketing_dispatch_rules (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID NOT NULL,
    name       TEXT NOT NULL,
    conditions JSONB DEFAULT '{}',
    strategy   TEXT NOT NULL DEFAULT 'round-robin',
    weight     INTEGER NOT NULL DEFAULT 1,
    enabled    BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ticketing_dispatch_rules_tenant ON ticketing_dispatch_rules(tenant_id);

CREATE TABLE IF NOT EXISTS ticketing_dispatch_weights (
    id           UUID PRIMARY KEY,
    tenant_id    UUID NOT NULL,
    engineer_id  UUID NOT NULL,
    weight       INTEGER NOT NULL DEFAULT 1,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ticketing_dispatch_weights_tenant ON ticketing_dispatch_weights(tenant_id);

CREATE TABLE IF NOT EXISTS ticketing_service_state (
    tenant_id  UUID PRIMARY KEY,
    active     BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ticketing_sla_breaches (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id   UUID NOT NULL,
    policy_id   UUID,
    type        TEXT NOT NULL DEFAULT 'response',
    breached_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ticketing_sla_breaches_ticket ON ticketing_sla_breaches(ticket_id);

CREATE TABLE IF NOT EXISTS ticketing_sla_policies (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL,
    name            TEXT NOT NULL,
    priority        TEXT NOT NULL DEFAULT '',
    response_hours  INTEGER NOT NULL DEFAULT 0,
    resolve_hours   INTEGER NOT NULL DEFAULT 0,
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ticketing_sla_policies_tenant ON ticketing_sla_policies(tenant_id);

CREATE TABLE IF NOT EXISTS ticketing_sla_targets (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      UUID NOT NULL,
    priority       TEXT NOT NULL,
    response_hours INTEGER NOT NULL DEFAULT 0,
    resolve_hours  INTEGER NOT NULL DEFAULT 0,
    enabled        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ticketing_sla_targets_tenant ON ticketing_sla_targets(tenant_id);

CREATE TABLE IF NOT EXISTS ticketing_suspensions (
    id          UUID PRIMARY KEY,
    tenant_id   UUID NOT NULL,
    engineer_id UUID,
    reason      TEXT NOT NULL DEFAULT '',
    type        TEXT NOT NULL DEFAULT '',
    start_at    TIMESTAMPTZ,
    end_at      TIMESTAMPTZ,
    status      TEXT NOT NULL DEFAULT 'active',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ticketing_suspensions_tenant ON ticketing_suspensions(tenant_id);

CREATE TABLE IF NOT EXISTS ticket_transfer_history (
    id          UUID PRIMARY KEY,
    tenant_id   UUID NOT NULL,
    ticket_id   UUID NOT NULL,
    from_user_id UUID,
    to_user_id  UUID,
    reason      TEXT NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ticket_transfer_history_tenant ON ticket_transfer_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ticket_transfer_history_ticket ON ticket_transfer_history(ticket_id);
