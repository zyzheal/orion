-- 596_create_test_selector_missing_tables.sql
-- test-selector 模块 5 张表无 CREATE TABLE。
-- 回滚见 596_create_test_selector_missing_tables_down.sql。

CREATE TABLE IF NOT EXISTS test_selector_cases (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID NOT NULL,
    suite_id     UUID,
    name         TEXT NOT NULL DEFAULT '',
    file_path    TEXT NOT NULL DEFAULT '',
    dependencies JSONB DEFAULT '[]',
    avg_duration DECIMAL(10,2) NOT NULL DEFAULT 0,
    flaky_score  DECIMAL(5,2) NOT NULL DEFAULT 0,
    history      JSONB DEFAULT '[]',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_test_selector_cases_tenant ON test_selector_cases(tenant_id);
CREATE INDEX IF NOT EXISTS idx_test_selector_cases_suite ON test_selector_cases(suite_id);

CREATE TABLE IF NOT EXISTS test_selector_code_mappings (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      UUID NOT NULL,
    test_path      TEXT NOT NULL DEFAULT '',
    source_paths   JSONB DEFAULT '[]',
    symbol_mapping JSONB DEFAULT '{}',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_test_selector_code_mappings_tenant ON test_selector_code_mappings(tenant_id);

CREATE TABLE IF NOT EXISTS test_selector_execution_history (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      UUID NOT NULL,
    test_id        UUID,
    execution_id   TEXT NOT NULL DEFAULT '',
    passed         BOOLEAN NOT NULL DEFAULT FALSE,
    duration       DECIMAL(10,2) NOT NULL DEFAULT 0,
    failure_message TEXT NOT NULL DEFAULT '',
    pr_id          TEXT,
    executed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_test_selector_execution_history_tenant ON test_selector_execution_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_test_selector_execution_history_test ON test_selector_execution_history(test_id);

CREATE TABLE IF NOT EXISTS test_selector_pr_results (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL,
    pr_id       TEXT NOT NULL DEFAULT '',
    plan_data   JSONB NOT NULL DEFAULT '{}',
    impact_data JSONB NOT NULL DEFAULT '{}',
    status      TEXT NOT NULL DEFAULT 'pending',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_test_selector_pr_results_tenant ON test_selector_pr_results(tenant_id);
CREATE INDEX IF NOT EXISTS idx_test_selector_pr_results_pr ON test_selector_pr_results(pr_id);

CREATE TABLE IF NOT EXISTS test_selector_suites (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID NOT NULL,
    name         TEXT NOT NULL DEFAULT '',
    file_path    TEXT NOT NULL DEFAULT '',
    test_count   INTEGER NOT NULL DEFAULT 0,
    avg_duration DECIMAL(10,2) NOT NULL DEFAULT 0,
    pass_rate    DECIMAL(5,2) NOT NULL DEFAULT 0,
    last_run     TIMESTAMPTZ,
    source_files JSONB DEFAULT '[]',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_test_selector_suites_tenant ON test_selector_suites(tenant_id);
