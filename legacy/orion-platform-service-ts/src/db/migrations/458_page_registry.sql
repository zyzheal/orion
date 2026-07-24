-- Migration 458: Page Registry Configuration Tables
--
-- Purpose: Store page routing configuration for the Phase 4 frontend routing
-- configuration system. Enables page-based route management without code changes.
-- Pattern: Follows subapp_configs (migration 175) design.

-- ============================================================
-- 1. Page Registry Table
-- ============================================================

CREATE TABLE IF NOT EXISTS page_registry (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    path            VARCHAR(200) UNIQUE NOT NULL,              -- Route path (e.g. /compliance/reports)
    component       VARCHAR(200) NOT NULL,                     -- Lazy import path (e.g. @/pages/compliance-svc/ComplianceReports)
    protected       BOOLEAN DEFAULT true,                      -- Requires authentication
    permission      JSONB DEFAULT '{}',                        -- { resource: 'compliance', action: 'read' }
    hide_layout     BOOLEAN DEFAULT false,                     -- Skip main Layout (for fullscreen/sub-app pages)
    micro_app       BOOLEAN DEFAULT false,                     -- Is micro-frontend sub-application
    sub_app_key     VARCHAR(50),                               -- Associated sub-app key (micro_app=true)
    menu_key        VARCHAR(50),                               -- Menu module key
    menu_label      VARCHAR(100),                              -- Display label in menu
    menu_icon       VARCHAR(50),                               -- Icon name
    hidden          BOOLEAN DEFAULT false,                     -- Hidden from menu (still accessible)
    redirect_to     VARCHAR(200),                              -- Redirect target path
    title           VARCHAR(100),                              -- Page title
    breadcrumb      BOOLEAN DEFAULT true,                      -- Show breadcrumb
    sort_order      INTEGER DEFAULT 0,                         -- Display sort order
    status          VARCHAR(20) DEFAULT 'enabled',             -- enabled / disabled
    tenant_id       UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    created_by      UUID,                                       -- Creator user ID
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_page_registry_path ON page_registry(path);
CREATE INDEX IF NOT EXISTS idx_page_registry_status ON page_registry(status);
CREATE INDEX IF NOT EXISTS idx_page_registry_tenant_id ON page_registry(tenant_id);
CREATE INDEX IF NOT EXISTS idx_page_registry_sort_order ON page_registry(sort_order);
CREATE INDEX IF NOT EXISTS idx_page_registry_micro_app ON page_registry(micro_app);

-- Comments
COMMENT ON TABLE page_registry IS 'Page routing configuration for frontend route management';
COMMENT ON COLUMN page_registry.path IS 'Route path (React Router path), supports params like /pipelines/:id';
COMMENT ON COLUMN page_registry.component IS 'Lazy import path string, resolved by frontend route-generator';
COMMENT ON COLUMN page_registry.permission IS 'Required permission: { resource: string, action: read|write|manage }';
COMMENT ON COLUMN page_registry.hide_layout IS 'Skip main Layout wrapper (for login, sub-apps, fullscreen pages)';
COMMENT ON COLUMN page_registry.micro_app IS 'If true, route is handled by SubAppRouteDynamic';
COMMENT ON COLUMN page_registry.sub_app_key IS 'Sub-application key for Orion-MF loading';
COMMENT ON COLUMN page_registry.menu_key IS 'Menu module identifier for menu sync';
COMMENT ON COLUMN page_registry.hidden IS 'Hidden from menu navigation but directly accessible';

-- ============================================================
-- 2. Page Registry History Table (Audit)
-- ============================================================

CREATE TABLE IF NOT EXISTS page_registry_history (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    page_path       VARCHAR(200) NOT NULL,                     -- Page path for audit tracking
    action          VARCHAR(20) NOT NULL,                      -- created / updated / deleted / status_changed
    old_value       JSONB,                                     -- Previous configuration
    new_value       JSONB,                                     -- New configuration
    changed_by      UUID,                                       -- User ID who made the change
    change_summary  VARCHAR(500),                              -- Human-readable change description
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_page_registry_history_path ON page_registry_history(page_path);
CREATE INDEX IF NOT EXISTS idx_page_registry_history_created ON page_registry_history(created_at DESC);

-- Tenant isolation
ALTER TABLE page_registry_history ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';
CREATE INDEX IF NOT EXISTS idx_page_registry_history_tenant_id ON page_registry_history(tenant_id);

COMMENT ON TABLE page_registry_history IS 'Audit log for page registry configuration changes';

-- ============================================================
-- 3. Insert Default Page Registry Configuration
-- ============================================================

INSERT INTO page_registry (path, component, protected, permission, hide_layout, micro_app, sub_app_key, menu_key, menu_label, menu_icon, sort_order, status, title) VALUES
-- ========== Public Pages ==========
('/', '@/pages/RootRedirect', false, '{}', true, false, NULL, NULL, NULL, NULL, 0, 'enabled', 'Root Redirect'),
('/login', '@/pages/Login', false, '{}', true, false, NULL, NULL, NULL, NULL, 1, 'enabled', 'Login'),

-- ========== Main Application Routes ==========
('/subapps', '@/pages/SubApps', true, '{}', false, false, NULL, 'subapp', '子应用管理', 'AppstoreOutlined', 2, 'enabled', 'Sub Apps'),
('/dashboard', '@/pages/DashboardNew', true, '{}', false, false, NULL, 'dashboard', '总览看板', 'DashboardOutlined', 3, 'enabled', 'Dashboard'),
('/console', '@/pages/Console', true, '{"resource":"*","action":"manage"}', false, false, NULL, 'console', '控制台', 'SettingOutlined', 4, 'enabled', 'Console'),

-- ========== Sub-Application Routes (Micro-Frontend) ==========
('/dba', '@/components/SubAppRouteDynamic', true, '{}', true, true, 'dba', 'dba', '数据库管理', 'DatabaseOutlined', 5, 'enabled', 'DBA'),
('/knowledge', '@/components/SubAppRouteDynamic', true, '{}', true, true, 'knowledge', 'knowledge', '知识库', 'ReadOutlined', 6, 'enabled', 'Knowledge'),
('/visor', '@/components/SubAppRouteDynamic', true, '{}', true, true, 'visor', 'visor', '监控中心', 'RadarChartOutlined', 7, 'enabled', 'Visor'),

-- ========== Delivery Module ==========
('/pipelines', '@/pages/pipeline-svc/PipelineList', true, '{"resource":"pipeline","action":"read"}', false, false, NULL, 'delivery', '流水线', 'CloudUploadOutlined', 10, 'enabled', 'Pipelines'),
('/pipelines/new', '@/pages/pipeline-svc/PipelineEditor', true, '{"resource":"pipeline","action":"write"}', true, false, NULL, NULL, NULL, NULL, 11, 'enabled', 'New Pipeline'),
('/pipelines/:id', '@/pages/pipeline-svc/PipelineDetail', true, '{"resource":"pipeline","action":"read"}', false, false, NULL, NULL, NULL, NULL, 12, 'enabled', 'Pipeline Detail'),
('/pipelines/:id/executions', '@/pages/pipeline-svc/PipelineExecutions', true, '{"resource":"pipeline","action":"read"}', false, false, NULL, NULL, NULL, NULL, 13, 'enabled', 'Pipeline Executions'),

-- ========== Canary Module ==========
('/canary/analysis', '@/pages/canary-svc/CanaryAnalysis', true, '{"resource":"canary","action":"read"}', false, false, NULL, 'canary', '灰度发布', 'ExperimentOutlined', 20, 'enabled', 'Canary Analysis'),
('/canary/configs', '@/pages/canary-svc/CanaryConfigs', true, '{"resource":"canary","action":"write"}', false, false, NULL, NULL, NULL, NULL, 21, 'enabled', 'Canary Configs'),

-- ========== Compliance Module ==========
('/compliance/reports', '@/pages/compliance-svc/ComplianceReports', true, '{"resource":"compliance","action":"read"}', false, false, NULL, 'compliance', '合规管理', 'SafetyCertificateOutlined', 30, 'enabled', 'Compliance Reports'),
('/compliance/policies', '@/pages/compliance-svc/CompliancePolicies', true, '{"resource":"compliance","action":"write"}', false, false, NULL, NULL, NULL, NULL, 31, 'enabled', 'Compliance Policies'),
('/compliance/audit', '@/pages/compliance-svc/ComplianceAudit', true, '{"resource":"compliance","action":"manage"}', false, false, NULL, NULL, NULL, NULL, 32, 'enabled', 'Compliance Audit'),

-- ========== Report Designer Module ==========
('/reports/designer', '@/pages/report-designer-svc/ReportDesigner', true, '{"resource":"reports","action":"write"}', false, false, NULL, 'reports', '报表设计', 'FileTextOutlined', 40, 'enabled', 'Report Designer'),
('/reports/schedules', '@/pages/report-designer-svc/ReportSchedules', true, '{"resource":"reports","action":"read"}', false, false, NULL, NULL, NULL, NULL, 41, 'enabled', 'Report Schedules'),

-- ========== Observability Module ==========
('/monitor', '@/pages/monitor-svc/Monitoring', true, '{"resource":"monitor","action":"read"}', false, false, NULL, 'monitor', '监控中心', 'RadarChartOutlined', 50, 'enabled', 'Monitoring'),

-- ========== AI Module ==========
('/ai', '@/pages/ai-svc/AIDashboard', true, '{}', false, false, NULL, 'ai', 'AI 平台', 'RobotOutlined', 60, 'enabled', 'AI Platform'),

-- ========== NotFound (404) ==========
('*', '@/pages/NotFound', false, '{}', true, false, NULL, NULL, NULL, NULL, 999, 'enabled', 'Not Found');

-- ============================================================
-- 4. Migration Info
-- ============================================================

CREATE TABLE IF NOT EXISTS schema_migrations (
    version             VARCHAR(20) PRIMARY KEY,
    applied_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    description         TEXT
);

INSERT INTO schema_migrations (version, description)
VALUES ('458', 'Add page_registry and page_registry_history tables for frontend route configuration')
ON CONFLICT (version) DO NOTHING;

-- ============================================================
-- 5. Tenant Isolation
-- ============================================================

ALTER TABLE page_registry ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';
CREATE INDEX IF NOT EXISTS idx_page_registry_tenant_id ON page_registry(tenant_id);
