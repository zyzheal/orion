-- FinOps v2 module tables.
--
-- The repository referenced eight tables that no migration ever created:
--   finops_costs, finops_budgets, finops_chargebacks, finops_recommendations,
--   finops_reports, finops_roi, finops_collection_schedules, finops_alert_triggers
-- Every one of the module's ~28 endpoints therefore failed with
--   pq: relation "finops_costs" does not exist
-- before any business logic could run. The repository also carried a private
-- initTables() that would have created them, but initTables() had zero callers,
-- so the DDL never ran.
--
-- The names are namespaced finops_v2_* deliberately:
--   * internal/finops (v1) owns the table `finops_budgets` and writes a
--     different column set into it (alerts, environment, description, UUID id),
--     which cannot share one table with the v2 schema (SERIAL id, category,
--     alert_threshold, status).
--   * migrations 042/131 create cost_entries / budgets / recommendations /
--     roi_entries / collection_schedules with UUID ids and UUID tenant_id,
--     which is incompatible with the platform-wide VARCHAR(128) tenant id and
--     with the models here (ID int, TenantID string).
--
-- 042's `finops_reports` is left in place but unused by this module; nothing
-- could ever have written into it, because inserting a VARCHAR tenant id into
-- its UUID tenant_id column fails before the row exists.
--
-- finops_v2_alert_triggers gets tenant_id even though the previous inline DDL
-- did not: an alert trigger names a budget, and budgets are tenant-scoped, so
-- an un-scoped trigger table would leak budget names across tenants.

CREATE TABLE IF NOT EXISTS finops_v2_costs (
    id           SERIAL PRIMARY KEY,
    tenant_id    VARCHAR(128) NOT NULL,
    entity_id    VARCHAR(256) NOT NULL,
    entity_type  VARCHAR(64)  NOT NULL,
    cost         DECIMAL(16,2) NOT NULL,
    currency     VARCHAR(8) DEFAULT 'USD',
    category     VARCHAR(128),
    provider     VARCHAR(64),
    period_start VARCHAR(64) NOT NULL,
    period_end   VARCHAR(64) NOT NULL,
    details      TEXT,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_finops_v2_costs_tenant ON finops_v2_costs (tenant_id);
CREATE INDEX IF NOT EXISTS idx_finops_v2_costs_entity ON finops_v2_costs (tenant_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_finops_v2_costs_provider ON finops_v2_costs (tenant_id, provider);
CREATE INDEX IF NOT EXISTS idx_finops_v2_costs_created ON finops_v2_costs (tenant_id, created_at);

CREATE TABLE IF NOT EXISTS finops_v2_budgets (
    id              SERIAL PRIMARY KEY,
    tenant_id       VARCHAR(128) NOT NULL,
    name            VARCHAR(256) NOT NULL,
    entity_id       VARCHAR(256) NOT NULL,
    entity_type     VARCHAR(64)  NOT NULL,
    amount          DECIMAL(16,2) NOT NULL,
    period          VARCHAR(64),
    currency        VARCHAR(8) DEFAULT 'USD',
    category        VARCHAR(128),
    alert_threshold DECIMAL(16,2),
    status          VARCHAR(32) DEFAULT 'active',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    -- Carries the composite FK from finops_v2_alert_triggers (tenant_id,
    -- budget_id). id is already the primary key, so this adds no real
    -- uniqueness — PostgreSQL will not build a composite FK against a column
    -- list that is not a unique constraint.
    CONSTRAINT uq_finops_v2_budgets_tenant_id UNIQUE (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_finops_v2_budgets_tenant ON finops_v2_budgets (tenant_id);
CREATE INDEX IF NOT EXISTS idx_finops_v2_budgets_status ON finops_v2_budgets (tenant_id, status);

CREATE TABLE IF NOT EXISTS finops_v2_chargebacks (
    id            SERIAL PRIMARY KEY,
    tenant_id     VARCHAR(128) NOT NULL,
    entity_id     VARCHAR(256) NOT NULL,
    entity_type   VARCHAR(64)  NOT NULL,
    allocated_cost DECIMAL(16,2) NOT NULL,
    percentage    DECIMAL(5,2) NOT NULL,
    period        VARCHAR(64),
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_finops_v2_chargebacks_tenant ON finops_v2_chargebacks (tenant_id);

CREATE TABLE IF NOT EXISTS finops_v2_recommendations (
    id                SERIAL PRIMARY KEY,
    tenant_id         VARCHAR(128) NOT NULL,
    type              VARCHAR(64)  NOT NULL,
    title             VARCHAR(256),
    description       TEXT,
    estimated_savings DECIMAL(16,2),
    confidence        DECIMAL(5,2),
    entity_id         VARCHAR(256),
    entity_type       VARCHAR(64),
    status            VARCHAR(32) DEFAULT 'open',
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_finops_v2_recommendations_tenant ON finops_v2_recommendations (tenant_id);
CREATE INDEX IF NOT EXISTS idx_finops_v2_recommendations_type ON finops_v2_recommendations (tenant_id, type);
CREATE INDEX IF NOT EXISTS idx_finops_v2_recommendations_status ON finops_v2_recommendations (tenant_id, status);

CREATE TABLE IF NOT EXISTS finops_v2_reports (
    id           SERIAL PRIMARY KEY,
    tenant_id    VARCHAR(128) NOT NULL,
    name         VARCHAR(256) NOT NULL,
    type         VARCHAR(64)  NOT NULL,
    period       VARCHAR(64),
    generated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_finops_v2_reports_tenant ON finops_v2_reports (tenant_id);

CREATE TABLE IF NOT EXISTS finops_v2_roi (
    id                 SERIAL PRIMARY KEY,
    tenant_id          VARCHAR(128) NOT NULL,
    period             VARCHAR(64)  NOT NULL,
    total_spend        DECIMAL(16,2),
    total_savings      DECIMAL(16,2),
    roi                DECIMAL(10,4),
    implemented_actions INT DEFAULT 0,
    created_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_finops_v2_roi_tenant ON finops_v2_roi (tenant_id);

-- One collection schedule per provider, platform-wide. Provider-level
-- infrastructure config, not tenant data, so no tenant_id column.
CREATE TABLE IF NOT EXISTS finops_v2_collection_schedules (
    id              SERIAL PRIMARY KEY,
    provider        VARCHAR(64) UNIQUE NOT NULL,
    cron_expression VARCHAR(128) NOT NULL,
    enabled         BOOLEAN DEFAULT TRUE,
    last_run        TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS finops_v2_alert_triggers (
    id           SERIAL PRIMARY KEY,
    tenant_id    VARCHAR(128) NOT NULL,
    budget_id    INT NOT NULL,
    threshold    DECIMAL(16,2) NOT NULL,
    triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Both columns, not just budget_id: a bare FK would let tenant-2 record a
    -- trigger against tenant-1's budget id, leaving an orphan row that the
    -- repository's JOIN filter then hides forever. This fails at insert time.
    CONSTRAINT fk_finops_v2_alert_triggers_budget
        FOREIGN KEY (tenant_id, budget_id)
        REFERENCES finops_v2_budgets (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_finops_v2_alert_triggers_tenant ON finops_v2_alert_triggers (tenant_id);
CREATE INDEX IF NOT EXISTS idx_finops_v2_alert_triggers_budget ON finops_v2_alert_triggers (budget_id);
