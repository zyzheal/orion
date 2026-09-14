-- DR (disaster recovery) module tables.
--
-- The repository referenced four tables that no migration ever created:
--   dr_plans, dr_failover_tests, dr_backup_configs, dr_policies
-- Every one of the module's 25 registered endpoints therefore failed with
--   pq: relation "dr_plans" does not exist
-- before any business logic could run. `grep -r dr_plans` over the whole repo
-- returned exactly one hit: the repository file itself. There is no module-local
-- migrations/ directory and no initTables() fallback, so the DDL never ran.
--
-- The columns are taken from the db tags in
-- internal/infrastructure/dr/models/models.go, which the repository scans into
-- directly. Newer migrations (575-588) also skip migration 572's UUID-FK audit
-- pair for new tables, so dr_plans keeps its own VARCHAR created_by column
-- instead of a UUID REFERENCES users(id) one: the service writes tenant IDs and
-- "system" into that column, which would fail a UUID cast.
--
-- dr_failover_tests.scheduled_at exists because ScheduleDrillRequest.ScheduledAt
-- is accepted by POST /drills. Before this migration the value was read into the
-- request struct and never stored, so the endpoint reported a scheduled drill
-- whose only timestamp was the record creation time.
--
-- last_tested, last_backup_at, completed_at, actual_rto, actual_rpo, findings,
-- description and project_id are nullable because the repository inserts rows
-- without them and writes them later through a separate UPDATE statement.

CREATE TABLE IF NOT EXISTS dr_plans (
    id                VARCHAR(36)  PRIMARY KEY,
    tenant_id         VARCHAR(128) NOT NULL,
    name              VARCHAR(256) NOT NULL,
    plan_type         VARCHAR(64)  NOT NULL,
    rpo               INTEGER      NOT NULL,
    rto               INTEGER      NOT NULL,
    status            VARCHAR(32)  NOT NULL,
    priority          VARCHAR(32)  NOT NULL DEFAULT 'medium',
    failover_strategy VARCHAR(64)  NOT NULL DEFAULT 'manual',
    backup_regions    JSON         NOT NULL DEFAULT '[]',
    services          JSON         NOT NULL DEFAULT '[]',
    last_tested       TIMESTAMPTZ,
    config            JSON         NOT NULL DEFAULT '{}',
    created_by        VARCHAR(128) NOT NULL,
    created_at        TIMESTAMPTZ  NOT NULL,
    updated_at        TIMESTAMPTZ  NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dr_plans_tenant ON dr_plans (tenant_id);
CREATE INDEX IF NOT EXISTS idx_dr_plans_tenant_status ON dr_plans (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_dr_plans_tenant_type ON dr_plans (tenant_id, plan_type);
CREATE INDEX IF NOT EXISTS idx_dr_plans_tenant_created ON dr_plans (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS dr_failover_tests (
    id                VARCHAR(36)  PRIMARY KEY,
    tenant_id         VARCHAR(128) NOT NULL,
    plan_id           VARCHAR(36)  NOT NULL,
    test_name         VARCHAR(256) NOT NULL,
    test_type         VARCHAR(64)  NOT NULL,
    started_at        TIMESTAMPTZ  NOT NULL,
    completed_at      TIMESTAMPTZ,
    scheduled_at      TIMESTAMPTZ,
    actual_rto        INTEGER,
    actual_rpo        INTEGER,
    result            VARCHAR(32)  NOT NULL,
    affected_services JSON         NOT NULL DEFAULT '[]',
    findings          TEXT,
    created_by        VARCHAR(128) NOT NULL,
    created_at        TIMESTAMPTZ  NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dr_failover_tests_tenant ON dr_failover_tests (tenant_id);
CREATE INDEX IF NOT EXISTS idx_dr_failover_tests_plan ON dr_failover_tests (tenant_id, plan_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dr_failover_tests_result ON dr_failover_tests (tenant_id, result);
CREATE INDEX IF NOT EXISTS idx_dr_failover_tests_type ON dr_failover_tests (tenant_id, test_type);

CREATE TABLE IF NOT EXISTS dr_backup_configs (
    id                VARCHAR(36)  PRIMARY KEY,
    tenant_id         VARCHAR(128) NOT NULL,
    source_type       VARCHAR(64)  NOT NULL,
    source_id         VARCHAR(128) NOT NULL,
    backup_schedule   VARCHAR(64)  NOT NULL DEFAULT '',
    retention_days    INTEGER      NOT NULL DEFAULT 30,
    storage_location  VARCHAR(256) NOT NULL,
    encryption        BOOLEAN      NOT NULL DEFAULT TRUE,
    compression       VARCHAR(32)  NOT NULL DEFAULT 'gzip',
    last_backup_at    TIMESTAMPTZ,
    last_backup_size  BIGINT       NOT NULL DEFAULT 0,
    enabled           BOOLEAN      NOT NULL DEFAULT TRUE,
    created_by        VARCHAR(128) NOT NULL,
    created_at        TIMESTAMPTZ  NOT NULL,
    updated_at        TIMESTAMPTZ  NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dr_backup_configs_tenant ON dr_backup_configs (tenant_id);
CREATE INDEX IF NOT EXISTS idx_dr_backup_configs_source ON dr_backup_configs (tenant_id, source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_dr_backup_configs_enabled ON dr_backup_configs (tenant_id, enabled);
CREATE INDEX IF NOT EXISTS idx_dr_backup_configs_created ON dr_backup_configs (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS dr_policies (
    id           VARCHAR(36)  PRIMARY KEY,
    tenant_id    VARCHAR(128) NOT NULL,
    name         VARCHAR(256) NOT NULL,
    description  TEXT,
    services     JSON         NOT NULL DEFAULT '[]',
    strategy     VARCHAR(64)  NOT NULL,
    rpo          VARCHAR(64)  NOT NULL,
    rto          VARCHAR(64)  NOT NULL,
    priority     INTEGER      NOT NULL DEFAULT 0,
    status       VARCHAR(32)  NOT NULL,
    project_id   VARCHAR(128),
    config       JSON         NOT NULL DEFAULT '{}',
    created_by   VARCHAR(128) NOT NULL,
    created_at   TIMESTAMPTZ  NOT NULL,
    updated_at   TIMESTAMPTZ  NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dr_policies_tenant ON dr_policies (tenant_id);
CREATE INDEX IF NOT EXISTS idx_dr_policies_strategy ON dr_policies (tenant_id, strategy);
CREATE INDEX IF NOT EXISTS idx_dr_policies_status ON dr_policies (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_dr_policies_priority ON dr_policies (tenant_id, priority);
