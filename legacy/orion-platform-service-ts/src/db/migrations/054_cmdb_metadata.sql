-- Migration 342: CMDB Metadata-Driven Core Tables
-- Tables: ci_metadata_schema, ci_type_attributes

-- ============================================================
-- CI Metadata Schema (CI type definitions / metadata-driven core)
-- ============================================================
CREATE TABLE IF NOT EXISTS ci_metadata_schema (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       VARCHAR(64) NOT NULL,
  name            VARCHAR(100) NOT NULL,
  display_name    VARCHAR(200) NOT NULL,
  description     TEXT,
  icon            VARCHAR(100),
  parent_type_id  UUID REFERENCES ci_metadata_schema(id),
  k8s_type        VARCHAR(50),
  is_system       BOOLEAN NOT NULL DEFAULT FALSE,
  status          VARCHAR(20) NOT NULL DEFAULT 'active',
  sort_order      INTEGER NOT NULL DEFAULT 0,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_by      VARCHAR(128),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ,
  UNIQUE(tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_ci_metadata_schema_tenant ON ci_metadata_schema(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ci_metadata_schema_name ON ci_metadata_schema(tenant_id, name);
CREATE INDEX IF NOT EXISTS idx_ci_metadata_schema_k8s_type ON ci_metadata_schema(k8s_type) WHERE k8s_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ci_metadata_schema_parent ON ci_metadata_schema(parent_type_id) WHERE parent_type_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ci_metadata_schema_deleted ON ci_metadata_schema(deleted_at) WHERE deleted_at IS NOT NULL;

ALTER TABLE ci_metadata_schema ENABLE ROW LEVEL SECURITY;
ALTER TABLE ci_metadata_schema FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_ci_metadata_schema ON ci_metadata_schema
  USING (current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id'));

-- ============================================================
-- CI Type Attributes (per-type attribute schema)
-- ============================================================
CREATE TABLE IF NOT EXISTS ci_type_attributes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       VARCHAR(64) NOT NULL,
  ci_type_id      UUID NOT NULL REFERENCES ci_metadata_schema(id) ON DELETE CASCADE,
  name            VARCHAR(100) NOT NULL,
  display_name    VARCHAR(200) NOT NULL,
  data_type       VARCHAR(30) NOT NULL DEFAULT 'string',
  required        BOOLEAN NOT NULL DEFAULT FALSE,
  default_value   TEXT,
  options         JSONB,
  reference_type  UUID REFERENCES ci_metadata_schema(id),
  validation      JSONB,
  description     TEXT,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  is_system       BOOLEAN NOT NULL DEFAULT FALSE,
  is_searchable   BOOLEAN NOT NULL DEFAULT TRUE,
  is_hidden       BOOLEAN NOT NULL DEFAULT FALSE,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_by      VARCHAR(128),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ,
  UNIQUE(ci_type_id, name)
);

CREATE INDEX IF NOT EXISTS idx_ci_type_attributes_type ON ci_type_attributes(ci_type_id);
CREATE INDEX IF NOT EXISTS idx_ci_type_attributes_tenant ON ci_type_attributes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ci_type_attributes_deleted ON ci_type_attributes(deleted_at) WHERE deleted_at IS NOT NULL;

ALTER TABLE ci_type_attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ci_type_attributes FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_ci_type_attributes ON ci_type_attributes
  USING (current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id'));

-- ============================================================
-- Seed default CI types (system tenant)
-- ============================================================
INSERT INTO ci_metadata_schema (tenant_id, name, display_name, icon, k8s_type, is_system, status)
VALUES
  ('__system__', 'APPLICATION',      '应用',        'AppstoreOutlined',      NULL,           TRUE, 'active'),
  ('__system__', 'SERVICE',          '服务',        'DeploymentUnitOutlined', 'Service',     TRUE, 'active'),
  ('__system__', 'DATABASE',         '数据库',      'DatabaseOutlined',       NULL,           TRUE, 'active'),
  ('__system__', 'SERVER',           '服务器',      'CloudServerOutlined',    NULL,           TRUE, 'active'),
  ('__system__', 'CONTAINER',        '容器',        'BoxPlotOutlined',        NULL,           TRUE, 'active'),
  ('__system__', 'K8S_CLUSTER',      'K8s 集群',   'ClusterOutlined',        'Namespace',    TRUE, 'active'),
  ('__system__', 'K8S_DEPLOYMENT',   'K8s 部署',   'DeploymentUnitOutlined', 'Deployment',   TRUE, 'active'),
  ('__system__', 'K8S_POD',          'K8s Pod',    'CloudOutlined',          'Pod',          TRUE, 'active'),
  ('__system__', 'NETWORK',          '网络',        'GlobalOutlined',         NULL,           TRUE, 'active'),
  ('__system__', 'LOAD_BALANCER',    '负载均衡',    'NodeIndexOutlined',      NULL,           TRUE, 'active'),
  ('__system__', 'STORAGE',          '存储',        'HddOutlined',            NULL,           TRUE, 'active'),
  ('__system__', 'MIDDLEWARE',       '中间件',      'ApiOutlined',            'ConfigMap',    TRUE, 'active'),
  ('__system__', 'PIPELINE',         '流水线',      'ForkOutlined',           NULL,           TRUE, 'active'),
  ('__system__', 'ENVIRONMENT',      '环境',        'EnvironmentOutlined',    NULL,           TRUE, 'active')
ON CONFLICT (tenant_id, name) DO NOTHING;

-- Seed default attributes for SERVER type
INSERT INTO ci_type_attributes (tenant_id, ci_type_id, name, display_name, data_type, required, sort_order)
SELECT '__system__', id, 'hostname', '主机名', 'string', TRUE, 1 FROM ci_metadata_schema WHERE name = 'SERVER' AND tenant_id = '__system__'
UNION ALL
SELECT '__system__', id, 'ip', 'IP 地址', 'string', TRUE, 2 FROM ci_metadata_schema WHERE name = 'SERVER' AND tenant_id = '__system__'
UNION ALL
SELECT '__system__', id, 'os', '操作系统', 'string', FALSE, 3 FROM ci_metadata_schema WHERE name = 'SERVER' AND tenant_id = '__system__'
UNION ALL
SELECT '__system__', id, 'cpu', 'CPU 核数', 'integer', FALSE, 4 FROM ci_metadata_schema WHERE name = 'SERVER' AND tenant_id = '__system__'
UNION ALL
SELECT '__system__', id, 'memory', '内存 (GB)', 'integer', FALSE, 5 FROM ci_metadata_schema WHERE name = 'SERVER' AND tenant_id = '__system__'
UNION ALL
SELECT '__system__', id, 'disk', '磁盘 (GB)', 'integer', FALSE, 6 FROM ci_metadata_schema WHERE name = 'SERVER' AND tenant_id = '__system__';

-- Seed default attributes for K8S_DEPLOYMENT type
INSERT INTO ci_type_attributes (tenant_id, ci_type_id, name, display_name, data_type, required, sort_order)
SELECT '__system__', id, 'namespace', '命名空间', 'string', TRUE, 1 FROM ci_metadata_schema WHERE name = 'K8S_DEPLOYMENT' AND tenant_id = '__system__'
UNION ALL
SELECT '__system__', id, 'replicas', '副本数', 'integer', FALSE, 2 FROM ci_metadata_schema WHERE name = 'K8S_DEPLOYMENT' AND tenant_id = '__system__'
UNION ALL
SELECT '__system__', id, 'image', '镜像', 'string', FALSE, 3 FROM ci_metadata_schema WHERE name = 'K8S_DEPLOYMENT' AND tenant_id = '__system__'
UNION ALL
SELECT '__system__', id, 'labels', '标签', 'json', FALSE, 4 FROM ci_metadata_schema WHERE name = 'K8S_DEPLOYMENT' AND tenant_id = '__system__';
