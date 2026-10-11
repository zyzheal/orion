-- Migration 735: Create alert_breaker_state table (ADR-010 §3.2.4)
-- 来源: docs/adr/ADR-010-AlertBreaker-并发模型选型.md §3.2.4
-- 目的: Alert Breaker 运行时状态表 - 承载 unique_key 窗口内聚合计数
-- 兼容性: 新表, 不影响 alert_breakers (规则定义表)
-- 编号: 735 (紧邻 730-731 号段; ADR-010 §3.2.4 指定)
-- 回滚: 735_create_alert_breaker_state_down.sql
--
-- 并发模型 (ADR-010 §3.1 方案 C 乐观锁 + §3.2.2 事务边界):
--   SELECT ... FOR UPDATE 行锁 + version 字段 + 5s 超时
--   UPDATE ... WHERE id=$1 AND version=$old
--   RowsAffected=0 → 冲突, 重试或 409

BEGIN;

CREATE TABLE IF NOT EXISTS alert_breaker_state (
    id                BIGSERIAL PRIMARY KEY,
    tenant_id         UUID NOT NULL,
    policy_id         BIGINT NOT NULL,
    unique_key        TEXT NOT NULL,
    count             INTEGER NOT NULL DEFAULT 0,
    last_fingerprint  TEXT,
    window_start      TIMESTAMPTZ,
    window_end        TIMESTAMPTZ,
    version           INTEGER NOT NULL DEFAULT 0,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (tenant_id, policy_id, unique_key)
);

-- 主查询路径: 加载策略下所有活跃 window 状态
CREATE INDEX IF NOT EXISTS idx_alert_breaker_state_lock
    ON alert_breaker_state (tenant_id, policy_id, unique_key);

-- 过期清理: 定期 DELETE WHERE window_end < NOW()
CREATE INDEX IF NOT EXISTS idx_alert_breaker_state_window
    ON alert_breaker_state (window_end);

COMMENT ON TABLE alert_breaker_state IS
    'Alert Breaker 运行时状态 (ADR-010 方案 C 乐观锁 + PG 行锁); '
    '同一 (tenant, policy, unique_key) 在 window_end 内聚合为一条';

COMMENT ON COLUMN alert_breaker_state.unique_key IS
    '业务层生成的 key (通常 fingerprint hash); 高基数, 保证热点分散';

COMMENT ON COLUMN alert_breaker_state.count IS
    'window 内计数; UPDATE ... SET count = count + 1 累加';

COMMENT ON COLUMN alert_breaker_state.last_fingerprint IS
    '最近一次 fingerprint; 用于 dedup 判定, 不参与聚合计算';

COMMENT ON COLUMN alert_breaker_state.window_start IS
    'window 起始; 可为 NULL (窗口尚未开始; e.g. 未来触发)';

COMMENT ON COLUMN alert_breaker_state.window_end IS
    'window 截止; UPDATE 时若 NOW() > window_end, 应先 DELETE 旧行';

COMMENT ON COLUMN alert_breaker_state.version IS
    '乐观锁版本; UPDATE ... WHERE version = $old; RowsAffected=0 视为冲突';

COMMIT;
