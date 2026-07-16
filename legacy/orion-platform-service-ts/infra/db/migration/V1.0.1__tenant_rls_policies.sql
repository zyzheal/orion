-- Tenant RLS (Row-Level Security) Policies
-- Flyway Migration V1.0.1
-- Description: Enables row-level security for tenant isolation

-- ==================== Tenant Isolation Function ====================

-- Create function to get current tenant from session variable
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS BIGINT
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN COALESCE(
        current_setting('app.current_tenant', true)::BIGINT,
        0
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN 0;
END;
$$;

-- Create function to check if tenant isolation is active
CREATE OR REPLACE FUNCTION is_tenant_isolation_enabled()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN current_setting('app.tenant_isolation', true)::BOOLEAN;
EXCEPTION
    WHEN OTHERS THEN
        RETURN false;
END;
$$;

-- Create tenant isolation policy function
CREATE OR REPLACE FUNCTION tenant_isolation_policy(tenant_column TEXT DEFAULT 'tenant_id')
RETURNS TEXT
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN format('
        CASE
            WHEN is_tenant_isolation_enabled() THEN
                %I = current_tenant_id()
            ELSE
                true
        END
    ', tenant_column);
END;
$$;

-- ==================== Enable RLS on Core Tables ====================

-- Enable RLS on cmdb_ci
ALTER TABLE cmdb_ci ENABLE ROW LEVEL SECURITY;
ALTER TABLE cmdb_ci FORCE ROW LEVEL SECURITY;

-- Create RLS policy for cmdb_ci
CREATE POLICY tenant_isolation_cmdb_ci ON cmdb_ci
    USING (
        CASE
            WHEN current_setting('app.tenant_isolation', true)::BOOLEAN IS NOT NULL
                 AND current_setting('app.tenant_isolation', true)::BOOLEAN THEN
                tenant_id = current_tenant_id()
            ELSE true
        END
    );

-- Enable RLS on cmdb_host_group
ALTER TABLE cmdb_host_group ENABLE ROW LEVEL SECURITY;
ALTER TABLE cmdb_host_group FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_cmdb_host_group ON cmdb_host_group
    USING (
        CASE
            WHEN current_setting('app.tenant_isolation', true)::BOOLEAN IS NOT NULL
                 AND current_setting('app.tenant_isolation', true)::BOOLEAN THEN
                tenant_id = current_tenant_id()
            ELSE true
        END
    );

-- Enable RLS on cmdb_host
ALTER TABLE cmdb_host ENABLE ROW LEVEL SECURITY;
ALTER TABLE cmdb_host FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_cmdb_host ON cmdb_host
    USING (
        CASE
            WHEN current_setting('app.tenant_isolation', true)::BOOLEAN IS NOT NULL
                 AND current_setting('app.tenant_isolation', true)::BOOLEAN THEN
                tenant_id = current_tenant_id()
            ELSE true
        END
    );

-- Enable RLS on cmdb_k8s_cluster
ALTER TABLE cmdb_k8s_cluster ENABLE ROW LEVEL SECURITY;
ALTER TABLE cmdb_k8s_cluster FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_cmdb_k8s_cluster ON cmdb_k8s_cluster
    USING (
        CASE
            WHEN current_setting('app.tenant_isolation', true)::BOOLEAN IS NOT NULL
                 AND current_setting('app.tenant_isolation', true)::BOOLEAN THEN
                tenant_id = current_tenant_id()
            ELSE true
        END
    );

-- Enable RLS on cmdb_k8s_namespace
ALTER TABLE cmdb_k8s_namespace ENABLE ROW LEVEL SECURITY;
ALTER TABLE cmdb_k8s_namespace FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_cmdb_k8s_namespace ON cmdb_k8s_namespace
    USING (
        CASE
            WHEN current_setting('app.tenant_isolation', true)::BOOLEAN IS NOT NULL
                 AND current_setting('app.tenant_isolation', true)::BOOLEAN THEN
                tenant_id = current_tenant_id()
            ELSE true
        END
    );

-- Enable RLS on cmdb_k8s_deployment
ALTER TABLE cmdb_k8s_deployment ENABLE ROW LEVEL SECURITY;
ALTER TABLE cmdb_k8s_deployment FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_cmdb_k8s_deployment ON cmdb_k8s_deployment
    USING (
        CASE
            WHEN current_setting('app.tenant_isolation', true)::BOOLEAN IS NOT NULL
                 AND current_setting('app.tenant_isolation', true)::BOOLEAN THEN
                tenant_id = current_tenant_id()
            ELSE true
        END
    );

-- Enable RLS on cmdb_k8s_pod
ALTER TABLE cmdb_k8s_pod ENABLE ROW LEVEL SECURITY;
ALTER TABLE cmdb_k8s_pod FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_cmdb_k8s_pod ON cmdb_k8s_pod
    USING (
        CASE
            WHEN current_setting('app.tenant_isolation', true)::BOOLEAN IS NOT NULL
                 AND current_setting('app.tenant_isolation', true)::BOOLEAN THEN
                tenant_id = current_tenant_id()
            ELSE true
        END
    );

-- Enable RLS on cmdb_cicd_pipeline
ALTER TABLE cmdb_cicd_pipeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE cmdb_cicd_pipeline FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_cmdb_cicd_pipeline ON cmdb_cicd_pipeline
    USING (
        CASE
            WHEN current_setting('app.tenant_isolation', true)::BOOLEAN IS NOT NULL
                 AND current_setting('app.tenant_isolation', true)::BOOLEAN THEN
                tenant_id = current_tenant_id()
            ELSE true
        END
    );

-- Enable RLS on cmdb_cicd_pipeline_run
ALTER TABLE cmdb_cicd_pipeline_run ENABLE ROW LEVEL SECURITY;
ALTER TABLE cmdb_cicd_pipeline_run FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_cmdb_cicd_pipeline_run ON cmdb_cicd_pipeline_run
    USING (
        CASE
            WHEN current_setting('app.tenant_isolation', true)::BOOLEAN IS NOT NULL
                 AND current_setting('app.tenant_isolation', true)::BOOLEAN THEN
                tenant_id = current_tenant_id()
            ELSE true
        END
    );

-- Enable RLS on cmdb_cicd_task_run
ALTER TABLE cmdb_cicd_task_run ENABLE ROW LEVEL SECURITY;
ALTER TABLE cmdb_cicd_task_run FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_cmdb_cicd_task_run ON cmdb_cicd_task_run
    USING (
        CASE
            WHEN current_setting('app.tenant_isolation', true)::BOOLEAN IS NOT NULL
                 AND current_setting('app.tenant_isolation', true)::BOOLEAN THEN
                tenant_id = current_tenant_id()
            ELSE true
        END
    );

-- Enable RLS on cmdb_script_execution
ALTER TABLE cmdb_script_execution ENABLE ROW LEVEL SECURITY;
ALTER TABLE cmdb_script_execution FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_cmdb_script_execution ON cmdb_script_execution
    USING (
        CASE
            WHEN current_setting('app.tenant_isolation', true)::BOOLEAN IS NOT NULL
                 AND current_setting('app.tenant_isolation', true)::BOOLEAN THEN
                tenant_id = current_tenant_id()
            ELSE true
        END
    );

-- ==================== Tenant ID Indexes ====================

-- Create optimized indexes for tenant_id queries (composite with id for RLS performance)
CREATE INDEX IF NOT EXISTS idx_cmdb_ci_tenant_id ON cmdb_ci(tenant_id, id);
CREATE INDEX IF NOT EXISTS idx_cmdb_host_group_tenant_id ON cmdb_host_group(tenant_id, id);
CREATE INDEX IF NOT EXISTS idx_cmdb_host_tenant_id ON cmdb_host(tenant_id, id);
CREATE INDEX IF NOT EXISTS idx_cmdb_k8s_cluster_tenant_id ON cmdb_k8s_cluster(tenant_id, id);
CREATE INDEX IF NOT EXISTS idx_cmdb_k8s_namespace_tenant_id ON cmdb_k8s_namespace(tenant_id, id);
CREATE INDEX IF NOT EXISTS idx_cmdb_k8s_deployment_tenant_id ON cmdb_k8s_deployment(tenant_id, id);
CREATE INDEX IF NOT EXISTS idx_cmdb_k8s_pod_tenant_id ON cmdb_k8s_pod(tenant_id, id);
CREATE INDEX IF NOT EXISTS idx_cmdb_cicd_pipeline_tenant_id ON cmdb_cicd_pipeline(tenant_id, id);
CREATE INDEX IF NOT EXISTS idx_cmdb_cicd_pipeline_run_tenant_id ON cmdb_cicd_pipeline_run(tenant_id, id);
CREATE INDEX IF NOT EXISTS idx_cmdb_cicd_task_run_tenant_id ON cmdb_cicd_task_run(tenant_id, id);
CREATE INDEX IF NOT EXISTS idx_cmdb_script_exec_tenant_id ON cmdb_script_execution(tenant_id, id);

-- ==================== Tenant Quota Table ====================

-- Tenant quota configuration table
CREATE TABLE IF NOT EXISTS tenant_quota (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id BIGINT NOT NULL UNIQUE,

    -- Resource Quotas
    max_pipelines INTEGER NOT NULL DEFAULT 100,
    max_pipeline_runs_per_day INTEGER NOT NULL DEFAULT 1000,
    max_concurrent_runs INTEGER NOT NULL DEFAULT 10,
    max_tasks_per_pipeline INTEGER NOT NULL DEFAULT 50,

    -- Compute Quotas
    max_runners INTEGER NOT NULL DEFAULT 5,
    max_cpu_cores INTEGER NOT NULL DEFAULT 16,
    max_memory_gb INTEGER NOT NULL DEFAULT 32,
    max_storage_gb INTEGER NOT NULL DEFAULT 100,

    -- Namespace Quotas
    max_namespaces INTEGER NOT NULL DEFAULT 10,

    -- Rate Limits
    api_rate_limit INTEGER NOT NULL DEFAULT 1000,
    api_rate_limit_window_seconds INTEGER NOT NULL DEFAULT 60,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE tenant_quota IS 'Tenant Resource Quotas - 租户资源配额';

-- ==================== Tenant Usage Table ====================

-- Tenant resource usage tracking
CREATE TABLE IF NOT EXISTS tenant_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id BIGINT NOT NULL,
    resource_type VARCHAR(32) NOT NULL,
    resource_key VARCHAR(64) NOT NULL,
    current_value BIGINT NOT NULL DEFAULT 0,
    window_start TIMESTAMPTZ NOT NULL,
    window_end TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uk_tenant_usage UNIQUE (tenant_id, resource_type, resource_key, window_start)
);

CREATE INDEX idx_tenant_usage_tenant ON tenant_usage(tenant_id);
CREATE INDEX idx_tenant_usage_window ON tenant_usage(window_start, window_end);
CREATE INDEX idx_tenant_usage_type ON tenant_usage(resource_type);

COMMENT ON TABLE tenant_usage IS 'Tenant Resource Usage - 租户资源使用量追踪';

-- ==================== Namespace Pool Table ====================

-- K8s Namespace pool for tenant isolation
CREATE TABLE IF NOT EXISTS namespace_pool (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    namespace_name VARCHAR(128) NOT NULL UNIQUE,
    cluster_id UUID NOT NULL,
    tenant_id BIGINT,
    status VARCHAR(32) NOT NULL DEFAULT 'available', -- available, allocated, reserved
    purpose VARCHAR(64),
    labels JSONB DEFAULT '{}',
    allocated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_namespace_status CHECK (status IN ('available', 'allocated', 'reserved'))
);

CREATE INDEX idx_namespace_pool_tenant ON namespace_pool(tenant_id);
CREATE INDEX idx_namespace_pool_status ON namespace_pool(status);
CREATE INDEX idx_namespace_pool_cluster ON namespace_pool(cluster_id);

COMMENT ON TABLE namespace_pool IS 'Namespace Pool - K8s 命名空间池';

-- ==================== Tenant Runner Allocation Table ====================

-- Runner allocation for tenant compute isolation
CREATE TABLE IF NOT EXISTS tenant_runner_allocation (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id BIGINT NOT NULL,
    runner_id VARCHAR(128) NOT NULL,
    runner_name VARCHAR(256) NOT NULL,
    namespace_id UUID REFERENCES namespace_pool(id),
    status VARCHAR(32) NOT NULL DEFAULT 'pending', -- pending, running, stopped, error
    cpu_cores INTEGER NOT NULL DEFAULT 1,
    memory_gb INTEGER NOT NULL DEFAULT 2,
    labels JSONB DEFAULT '{}',
    started_at TIMESTAMPTZ,
    stopped_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_runner_status CHECK (status IN ('pending', 'running', 'stopped', 'error'))
);

CREATE INDEX idx_runner_alloc_tenant ON tenant_runner_allocation(tenant_id);
CREATE INDEX idx_runner_alloc_runner ON tenant_runner_allocation(runner_id);
CREATE INDEX idx_runner_alloc_status ON tenant_runner_allocation(status);
CREATE INDEX idx_runner_alloc_namespace ON tenant_runner_allocation(namespace_id);

COMMENT ON TABLE tenant_runner_allocation IS 'Tenant Runner Allocation - 租户 Runner 分配';

-- ==================== Helper Functions ====================

-- Function to set tenant context in session
CREATE OR REPLACE FUNCTION set_tenant_context(p_tenant_id BIGINT, p_isolation_enabled BOOLEAN DEFAULT true)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM set_config('app.current_tenant', p_tenant_id::TEXT, false);
    PERFORM set_config('app.tenant_isolation', p_isolation_enabled::TEXT, false);
END;
$$;

-- Function to clear tenant context
CREATE OR REPLACE FUNCTION clear_tenant_context()
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM set_config('app.current_tenant', '', false);
    PERFORM set_config('app.tenant_isolation', 'false', false);
END;
$$;

-- Function to check quota
CREATE OR REPLACE FUNCTION check_tenant_quota(
    p_tenant_id BIGINT,
    p_resource_type VARCHAR(32),
    p_requested_value BIGINT DEFAULT 1
)
RETURNS TABLE (
    allowed BOOLEAN,
    current_usage BIGINT,
    quota_limit BIGINT,
    remaining BIGINT
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_quota RECORD;
    v_current BIGINT;
BEGIN
    -- Get quota limits
    SELECT * INTO v_quota FROM tenant_quota WHERE tenant_id = p_tenant_id;

    IF NOT FOUND THEN
        -- Return default limits if no quota configured
        RETURN QUERY SELECT
            true::BOOLEAN,
            0::BIGINT,
            CASE p_resource_type
                WHEN 'pipelines' THEN 100
                WHEN 'concurrent_runs' THEN 10
                WHEN 'runners' THEN 5
                WHEN 'namespaces' THEN 10
                ELSE 0
            END::BIGINT,
            CASE p_resource_type
                WHEN 'pipelines' THEN 100
                WHEN 'concurrent_runs' THEN 10
                WHEN 'runners' THEN 5
                WHEN 'namespaces' THEN 10
                ELSE 0
            END::BIGINT;
        RETURN;
    END IF;

    -- Get current usage based on resource type
    CASE p_resource_type
        WHEN 'pipelines' THEN
            SELECT COUNT(*)::BIGINT INTO v_current
            FROM cmdb_cicd_pipeline
            WHERE tenant_id = p_tenant_id AND deleted_at IS NULL;

            RETURN QUERY SELECT
                (v_current + p_requested_value <= v_quota.max_pipelines),
                v_current,
                v_quota.max_pipelines::BIGINT,
                (v_quota.max_pipelines - v_current)::BIGINT;

        WHEN 'concurrent_runs' THEN
            SELECT COUNT(*)::BIGINT INTO v_current
            FROM cmdb_cicd_pipeline_run
            WHERE tenant_id = p_tenant_id AND status = 'running';

            RETURN QUERY SELECT
                (v_current + p_requested_value <= v_quota.max_concurrent_runs),
                v_current,
                v_quota.max_concurrent_runs::BIGINT,
                (v_quota.max_concurrent_runs - v_current)::BIGINT;

        WHEN 'runners' THEN
            SELECT COUNT(*)::BIGINT INTO v_current
            FROM tenant_runner_allocation
            WHERE tenant_id = p_tenant_id AND status IN ('pending', 'running');

            RETURN QUERY SELECT
                (v_current + p_requested_value <= v_quota.max_runners),
                v_current,
                v_quota.max_runners::BIGINT,
                (v_quota.max_runners - v_current)::BIGINT;

        WHEN 'namespaces' THEN
            SELECT COUNT(*)::BIGINT INTO v_current
            FROM namespace_pool
            WHERE tenant_id = p_tenant_id;

            RETURN QUERY SELECT
                (v_current + p_requested_value <= v_quota.max_namespaces),
                v_current,
                v_quota.max_namespaces::BIGINT,
                (v_quota.max_namespaces - v_current)::BIGINT;

        ELSE
            RETURN QUERY SELECT true::BOOLEAN, 0::BIGINT, 0::BIGINT, 0::BIGINT;
    END CASE;
END;
$$;

-- ==================== Comments ====================

COMMENT ON FUNCTION current_tenant_id() IS 'Returns the current tenant ID from session context';
COMMENT ON FUNCTION set_tenant_context(BIGINT, BOOLEAN) IS 'Sets tenant context for RLS isolation';
COMMENT ON FUNCTION clear_tenant_context() IS 'Clears tenant context from session';
COMMENT ON FUNCTION check_tenant_quota(BIGINT, VARCHAR, BIGINT) IS 'Checks if tenant quota allows requested resource';