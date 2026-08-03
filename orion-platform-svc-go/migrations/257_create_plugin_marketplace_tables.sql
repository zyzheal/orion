-- Plugin Marketplace 模块表 + 初始数据

CREATE TABLE IF NOT EXISTS plugin_marketplace (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    author VARCHAR(255),
    category VARCHAR(100),
    version VARCHAR(50) NOT NULL,
    tags JSONB,
    icon_url VARCHAR(500),
    repository_url VARCHAR(500),
    documentation_url VARCHAR(500),
    price_cents BIGINT,
    main_entry VARCHAR(255),
    code TEXT,
    dependencies JSONB,
    platform_api_version VARCHAR(50),
    permissions JSONB,
    config_schema JSONB,
    verified BOOLEAN NOT NULL DEFAULT FALSE,
    rating_avg DECIMAL(3,2),
    rating_count BIGINT NOT NULL DEFAULT 0,
    download_count BIGINT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM now())::bigint,
    updated_at BIGINT DEFAULT EXTRACT(EPOCH FROM now())::bigint
);

CREATE INDEX IF NOT EXISTS idx_plugin_marketplace_tenant ON plugin_marketplace(tenant_id);
CREATE INDEX IF NOT EXISTS idx_plugin_marketplace_category ON plugin_marketplace(category);
CREATE INDEX IF NOT EXISTS idx_plugin_marketplace_verified ON plugin_marketplace(verified);
CREATE INDEX IF NOT EXISTS idx_plugin_marketplace_name ON plugin_marketplace(name);
CREATE INDEX IF NOT EXISTS idx_plugin_marketplace_status ON plugin_marketplace(status);

CREATE TABLE IF NOT EXISTS plugin_reviews (
    id VARCHAR(36) PRIMARY KEY,
    plugin_id VARCHAR(36) NOT NULL,
    tenant_id VARCHAR(36),
    user_id VARCHAR(255) NOT NULL,
    rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM now())::bigint
);

CREATE INDEX IF NOT EXISTS idx_plugin_reviews_plugin_id ON plugin_reviews(plugin_id);
CREATE INDEX IF NOT EXISTS idx_plugin_reviews_rating ON plugin_reviews(rating);

CREATE TABLE IF NOT EXISTS plugin_quality_scores (
    plugin_id VARCHAR(36) PRIMARY KEY,
    score DECIMAL(3,2) NOT NULL,
    code_quality SMALLINT NOT NULL,
    security SMALLINT NOT NULL,
    completeness SMALLINT NOT NULL,
    performance SMALLINT NOT NULL,
    documentation SMALLINT NOT NULL,
    computed_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM now())::bigint
);

-- 初始数据：预置官方插件
INSERT INTO plugin_marketplace (id, tenant_id, name, description, author, category, version, tags, verified, rating_avg, rating_count, download_count, status)
VALUES
    ('plugin-official-001', 'tenant-001', 'Slack 通知插件', '将流水线事件推送到 Slack 频道', 'Orion', 'notification', '1.0.0', '["slack","notification"]'::jsonb, TRUE, 4.5, 28, 1520, 'active'),
    ('plugin-official-002', 'tenant-001', 'Prometheus 告警插件', '对接 Prometheus Alertmanager 实现统一告警', 'Orion', 'monitoring', '1.2.0', '["prometheus","alerting","monitoring"]'::jsonb, TRUE, 4.2, 15, 890, 'active'),
    ('plugin-official-003', 'tenant-001', 'Jira 工单插件', '自动创建 Jira 工单并与工单系统联动', 'Orion', 'ticketing', '1.0.0', '["jira","ticketing","integration"]'::jsonb, TRUE, 4.0, 9, 420, 'active'),
    ('plugin-official-004', 'tenant-001', 'GitLab PR 插件', '自动创建 GitLab Merge Request 并同步状态', 'Orion', 'code', '1.1.0', '["gitlab","pr","merge-request"]'::jsonb, TRUE, 4.8, 35, 2100, 'active'),
    ('plugin-official-005', 'tenant-001', 'Docker Registry 插件', '制品扫描与镜像版本管理', 'Orion', 'artifact', '1.0.0', '["docker","registry","artifact"]'::jsonb, TRUE, 4.1, 12, 670, 'active')
ON CONFLICT (id) DO NOTHING;
