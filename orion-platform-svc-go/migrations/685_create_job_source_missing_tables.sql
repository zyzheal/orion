-- job-source 模块: job_sources / job_source_events 2 张表无 CREATE TABLE。
--
-- 模块自带的 internal/job-source/migrations/001_create_job_source_tables.sql
-- 定义了这两张表, 但 database.LoadMigrations 只读 flat 顶层目录
-- (orion-platform-svc-go/migrations) 且跳过子目录, 所以那份 DDL 从未被执行。
-- 七条在册路由 (POST/GET/PUT/DELETE /job-sources, POST /:id/trigger,
-- GET /:id/events) 全部在驱动层以 `relation "job_sources" does not exist` 失败。
--
-- 版本号沿用顶层编号序列: 001_ 前缀会被解析成 version 1, 与已在册的
-- 001_xxx.sql 冲突, 因此这里改号而不是改名。
--
-- 列与 internal/job-source/models 的 db:"..." tag 一一对应: repository 用
-- SELECT * 读回, sqlx 对多出来的列报 "missing destination name", 对缺的列
-- 报 "missing destination name" 一样失败, 所以两侧必须严格对齐。

CREATE TABLE IF NOT EXISTS job_sources (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    config TEXT,
    enabled BOOLEAN DEFAULT TRUE,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_job_sources_tenant ON job_sources(tenant_id);
CREATE INDEX IF NOT EXISTS idx_job_sources_type ON job_sources(type);
CREATE INDEX IF NOT EXISTS idx_job_sources_enabled ON job_sources(enabled);
CREATE INDEX IF NOT EXISTS idx_job_sources_status ON job_sources(status);

CREATE TABLE IF NOT EXISTS job_source_events (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    source_id TEXT NOT NULL REFERENCES job_sources(id),
    payload TEXT,
    status TEXT DEFAULT 'received',
    job_id TEXT,
    error TEXT,
    received_at TIMESTAMPTZ NOT NULL,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_job_source_events_tenant ON job_source_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_job_source_events_source ON job_source_events(source_id);
CREATE INDEX IF NOT EXISTS idx_job_source_events_status ON job_source_events(status);
CREATE INDEX IF NOT EXISTS idx_job_source_events_received ON job_source_events(received_at);
