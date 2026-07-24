-- Report Definition table
CREATE TABLE IF NOT EXISTS report_definition (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    layout JSONB DEFAULT '{}',
    components JSONB DEFAULT '[]',
    datasource_bindings JSONB,
    template_id VARCHAR(255),
    enabled BOOLEAN DEFAULT true,
    created_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS report_datasource (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    datasource_type VARCHAR(100) NOT NULL,
    config JSONB NOT NULL DEFAULT '{}',
    refresh_interval INT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS report_schedule (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    report_id UUID NOT NULL,
    cron_expression VARCHAR(255) NOT NULL,
    export_format VARCHAR(50) NOT NULL,
    recipients JSONB DEFAULT '[]',
    enabled BOOLEAN DEFAULT true,
    last_run_at TIMESTAMP WITH TIME ZONE,
    next_run_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS report_execution_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    report_id UUID NOT NULL,
    schedule_id UUID,
    export_format VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    file_url TEXT,
    error TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_ms INT,
    triggered_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_report_definition_tenant ON report_definition(tenant_id);
CREATE INDEX IF NOT EXISTS idx_report_datasource_tenant ON report_datasource(tenant_id);
CREATE INDEX IF NOT EXISTS idx_report_schedule_tenant ON report_schedule(tenant_id);
CREATE INDEX IF NOT EXISTS idx_report_execution_tenant ON report_execution_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_report_execution_report ON report_execution_history(tenant_id, report_id);
