-- 612_create_digital_twin_missing_tables.sql
-- digital-twin 模块: digital_twins 表已由 035 创建且列齐 (与 INSERT 完全匹配)；
-- 3 张子表 digital_twin_snapshots / digital_twin_traffic_records / digital_twin_replay_sessions 无 CREATE TABLE。
-- 注: 035 还建了个旧名 `replay_sessions` 表, 但代码实际引用的是 `digital_twin_replay_sessions`
-- (命名前缀不一致的潜在遗留 bug), 此处按代码实际引用的新名建表, 不改动 035 旧表。
-- 回滚见 612_create_digital_twin_missing_tables_down.sql。

CREATE TABLE IF NOT EXISTS digital_twin_snapshots (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    twin_id    UUID NOT NULL,
    name       TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_digital_twin_snapshots_twin ON digital_twin_snapshots(twin_id);

CREATE TABLE IF NOT EXISTS digital_twin_traffic_records (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    twin_id        UUID NOT NULL,
    type           TEXT NOT NULL DEFAULT '',
    request_count  INTEGER NOT NULL DEFAULT 0,
    duration       INTEGER NOT NULL DEFAULT 0,
    started_at     TIMESTAMPTZ,
    completed_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_digital_twin_traffic_records_twin ON digital_twin_traffic_records(twin_id);

CREATE TABLE IF NOT EXISTS digital_twin_replay_sessions (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    twin_id               UUID NOT NULL,
    recording_session_id  UUID,
    sandbox_endpoint      TEXT NOT NULL DEFAULT '',
    status                TEXT NOT NULL DEFAULT 'created',
    progress              INTEGER NOT NULL DEFAULT 0,
    started_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    total_requests        INTEGER NOT NULL DEFAULT 0,
    completed_requests    INTEGER NOT NULL DEFAULT 0,
    matched_requests      INTEGER NOT NULL DEFAULT 0,
    failed_requests       INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_digital_twin_replay_sessions_twin ON digital_twin_replay_sessions(twin_id);
CREATE INDEX IF NOT EXISTS idx_digital_twin_replay_sessions_recording ON digital_twin_replay_sessions(recording_session_id);
