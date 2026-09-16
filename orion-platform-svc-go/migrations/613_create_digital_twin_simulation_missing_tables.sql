-- 613_create_digital_twin_simulation_missing_tables.sql
-- digital-twin-simulation 模块 3 张表无 CREATE TABLE。
-- digital_twin_sim_states 不用 id 列, 用 twin_id 作为主键 (单行状态, 非事件流)。
-- 回滚见 613_create_digital_twin_simulation_missing_tables_down.sql。

CREATE TABLE IF NOT EXISTS digital_twin_sim_twins (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL,
    name            TEXT NOT NULL DEFAULT '',
    description     TEXT NOT NULL DEFAULT '',
    entity_type     TEXT NOT NULL DEFAULT '',
    source_id       TEXT NOT NULL DEFAULT '',
    status          TEXT NOT NULL DEFAULT 'active',
    config          JSONB DEFAULT '{}',
    metadata        JSONB DEFAULT '{}',
    sync_policy     TEXT NOT NULL DEFAULT '',
    last_sync_time  BIGINT,
    sync_health     TEXT NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_digital_twin_sim_twins_tenant ON digital_twin_sim_twins(tenant_id);

-- digital_twin_sim_states: twin_id 为单行主键 (状态快照, 非事件流)。
CREATE TABLE IF NOT EXISTS digital_twin_sim_states (
    twin_id       TEXT PRIMARY KEY,
    timestamp     BIGINT NOT NULL DEFAULT 0,
    status        TEXT NOT NULL DEFAULT '',
    resources     JSONB DEFAULT '{}',
    performance   JSONB DEFAULT '{}',
    dependencies  JSONB DEFAULT '{}',
    events        JSONB DEFAULT '{}',
    created_at    BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS digital_twin_sim_simulations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL,
    twin_id     TEXT,
    type        TEXT NOT NULL DEFAULT '',
    name        TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    parameters  JSONB DEFAULT '{}',
    status      TEXT NOT NULL DEFAULT 'pending',
    start_time  BIGINT,
    end_time    BIGINT,
    duration    BIGINT,
    results     JSONB DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_digital_twin_sim_simulations_tenant ON digital_twin_sim_simulations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_digital_twin_sim_simulations_twin ON digital_twin_sim_simulations(twin_id);
