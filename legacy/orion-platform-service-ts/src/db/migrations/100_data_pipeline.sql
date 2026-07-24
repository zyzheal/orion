-- 100: Data Pipeline
-- 数据管道、管道调度、数据血缘

-- data_pipelines 表（数据管道定义）
CREATE TABLE IF NOT EXISTS data_pipelines (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pipeline_name     VARCHAR(200) NOT NULL,
  description       TEXT,
  source_type       VARCHAR(50) NOT NULL,                   -- database, api, file, stream, event
  source_config     JSONB NOT NULL DEFAULT '{}',
  target_type       VARCHAR(50) NOT NULL,                   -- database, warehouse, lake, api, file
  target_config     JSONB NOT NULL DEFAULT '{}',
  transform_steps   JSONB NOT NULL DEFAULT '[]',
  schedule          VARCHAR(50),
  status            VARCHAR(30) NOT NULL DEFAULT 'inactive', -- inactive, active, paused, failed
  last_run_at       TIMESTAMPTZ,
  last_run_status   VARCHAR(30),
  created_by        VARCHAR(100) NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_data_pipelines_tenant ON data_pipelines(tenant_id);
CREATE INDEX idx_data_pipelines_status ON data_pipelines(status);
CREATE INDEX idx_data_pipelines_source ON data_pipelines(source_type);

-- pipeline_schedules 表（管道调度记录）
CREATE TABLE IF NOT EXISTS pipeline_schedules (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pipeline_id       UUID NOT NULL REFERENCES data_pipelines(id) ON DELETE CASCADE,
  schedule_time     TIMESTAMPTZ NOT NULL,
  trigger_type      VARCHAR(30) NOT NULL DEFAULT 'scheduled', -- scheduled, manual, event
  status            VARCHAR(30) NOT NULL DEFAULT 'pending',   -- pending, running, completed, failed, cancelled
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  records_processed BIGINT DEFAULT 0,
  records_failed    BIGINT DEFAULT 0,
  error_message     TEXT,
  metadata          JSONB NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pipeline_schedules_tenant ON pipeline_schedules(tenant_id);
CREATE INDEX idx_pipeline_schedules_pipeline ON pipeline_schedules(pipeline_id);
CREATE INDEX idx_pipeline_schedules_status ON pipeline_schedules(status);
CREATE INDEX idx_pipeline_schedules_time ON pipeline_schedules(schedule_time DESC);

-- data_lineage 表（数据血缘追踪）
CREATE TABLE IF NOT EXISTS data_lineage (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pipeline_id       UUID REFERENCES data_pipelines(id) ON DELETE SET NULL,
  source_table      VARCHAR(200) NOT NULL,
  source_column     VARCHAR(200),
  target_table      VARCHAR(200) NOT NULL,
  target_column     VARCHAR(200),
  transform_type    VARCHAR(50) NOT NULL DEFAULT 'direct',   -- direct, join, aggregate, filter, map
  transform_logic   TEXT,
  schema_version    VARCHAR(50),
  recorded_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_data_lineage_tenant ON data_lineage(tenant_id);
CREATE INDEX idx_data_lineage_source ON data_lineage(source_table, source_column);
CREATE INDEX idx_data_lineage_target ON data_lineage(target_table, target_column);
CREATE INDEX idx_data_lineage_pipeline ON data_lineage(pipeline_id);

-- RLS
ALTER TABLE data_pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_lineage ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_data_pipelines ON data_pipelines
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );
CREATE POLICY tenant_isolation_pipeline_schedules ON pipeline_schedules
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );
CREATE POLICY tenant_isolation_data_lineage ON data_lineage
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );
