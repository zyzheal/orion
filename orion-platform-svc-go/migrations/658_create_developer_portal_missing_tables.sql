-- 658_create_developer_portal_missing_tables.sql
-- developer-portal 模块: dev_portal_usage_records / dev_portal_response_history 2 张表无 CREATE TABLE。
-- 注: 598_create_developer_portal_missing_tables.sql 已建 developer_portals/portal_documents/
-- portal_document_versions/dev_portal_subscriptions/dev_portal_sdk_tasks/dev_portal_playground_requests/
-- dev_portal_mock_rules 7 张表，但漏了 usage_records 和 response_history (代码实际引用)。
-- 回滚见 658_create_developer_portal_missing_tables_down.sql。

CREATE TABLE IF NOT EXISTS dev_portal_usage_records (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id  UUID NOT NULL,
    api_name         TEXT NOT NULL DEFAULT '',
    method           TEXT NOT NULL DEFAULT '',
    path             TEXT NOT NULL DEFAULT '',
    status           INTEGER NOT NULL DEFAULT 0,
    latency_ms       INTEGER NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dev_portal_usage_records_subscription ON dev_portal_usage_records(subscription_id);

CREATE TABLE IF NOT EXISTS dev_portal_response_history (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id  UUID,
    status      INTEGER NOT NULL DEFAULT 0,
    headers     JSONB DEFAULT '{}',
    body        TEXT NOT NULL DEFAULT '',
    latency_ms  INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dev_portal_response_history_request ON dev_portal_response_history(request_id);
