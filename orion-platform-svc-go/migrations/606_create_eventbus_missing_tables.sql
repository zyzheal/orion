-- 606_create_eventbus_missing_tables.sql
-- eventbus 模块: events 表已由 038 创建但 INSERT 比表多 2 列（correlation_id / causation_id），
-- 真实 INSERT 走 `INSERT INTO events (..., correlation_id, causation_id, ...)` 路径，缺列导致运行期失败。
-- 模块没有第二张表 —— 038 的注释提到 event_logs/event_bus_config/event_subscriptions，但代码从未引用，不在本次范围。
-- 回滚见 606_create_eventbus_missing_tables_down.sql。

ALTER TABLE events ADD COLUMN IF NOT EXISTS correlation_id TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS causation_id   TEXT;
CREATE INDEX IF NOT EXISTS idx_events_correlation_id ON events(correlation_id);
CREATE INDEX IF NOT EXISTS idx_events_causation_id   ON events(causation_id);
