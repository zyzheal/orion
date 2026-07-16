-- 003-partition-tables.sql
-- 分片表设计（分区表）
-- 版本：v1.0
-- 创建日期：2026-04-11

-- ============================================================================
-- 分片策略说明
-- ============================================================================
-- 采用 PostgreSQL 声明式分区（Declarative Partitioning）
-- 分区键：tenant_id（租户隔离）+ create_time（时间范围）
-- 分区方法：Range 分区（按时间）+ List 子分区（按租户）
--
-- 分片表清单：
-- 1. audit_log - 审计日志表
-- 2. event_log - 事件日志表
-- 3. pipeline_run - 流水线执行记录
-- 4. deployment_history - 部署历史
-- 5. user_activity - 用户活动日志
-- ============================================================================

-- ============================================================================
-- 1. audit_logs 分区表
-- ============================================================================

-- 创建分区表（按月分区）
CREATE TABLE audit.audit_logs_partitioned (
    id                BIGSERIAL,
    tenant_id         BIGINT NOT NULL,
    user_id           BIGINT,
    action            VARCHAR(64) NOT NULL,
    resource_type     VARCHAR(64) NOT NULL,
    resource_id       BIGINT,
    request_data      JSONB,
    response_data     JSONB,
    ip_address        VARCHAR(45),
    user_agent        VARCHAR(512),
    status            VARCHAR(16) NOT NULL DEFAULT 'success',
    error_message     TEXT,
    duration_ms       INTEGER,
    create_time       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id, create_time)
) PARTITION BY RANGE (create_time);

-- 启用 RLS
ALTER TABLE audit.audit_logs_partitioned ENABLE ROW LEVEL SECURITY;

-- 创建租户隔离策略
CREATE POLICY tenant_isolation_audit_logs_partitioned ON audit.audit_logs_partitioned
    FOR ALL
    USING (tenant_id = current_tenant_id());

-- 插入策略
CREATE POLICY insert_audit_logs_partitioned ON audit.audit_logs_partitioned
    FOR INSERT
    WITH CHECK (TRUE);

-- ============================================================================
-- 2. event_logs 分区表
-- ============================================================================

CREATE TABLE audit.event_logs_partitioned (
    id                BIGSERIAL,
    tenant_id         BIGINT NOT NULL,
    event_type        VARCHAR(64) NOT NULL,
    event_source      VARCHAR(64),
    event_data        JSONB NOT NULL,
    severity          VARCHAR(16) DEFAULT 'info',
    correlation_id    VARCHAR(64),
    trace_id          VARCHAR(64),
    user_id           BIGINT,
    resource_type     VARCHAR(64),
    resource_id       BIGINT,
    create_time       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id, create_time)
) PARTITION BY RANGE (create_time);

-- 启用 RLS
ALTER TABLE audit.event_logs_partitioned ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_event_logs_partitioned ON audit.event_logs_partitioned
    FOR ALL
    USING (tenant_id = current_tenant_id());

CREATE POLICY insert_event_logs_partitioned ON audit.event_logs_partitioned
    FOR INSERT
    WITH CHECK (TRUE);

-- ============================================================================
-- 3. pipeline_runs 分区表
-- ============================================================================

CREATE TABLE cicd.pipeline_runs_partitioned (
    id                BIGSERIAL,
    tenant_id         BIGINT NOT NULL,
    pipeline_id       BIGINT NOT NULL,
    run_id            VARCHAR(64) NOT NULL,
    trigger_type      VARCHAR(32) NOT NULL,
    trigger_by        BIGINT,
    trigger_reason    TEXT,
    git_sha           VARCHAR(64),
    git_branch        VARCHAR(128),
    git_tag           VARCHAR(128),
    git_commit_message TEXT,
    status            VARCHAR(32) NOT NULL DEFAULT 'pending',
    current_stage     VARCHAR(128),
    queued_at         TIMESTAMPTZ,
    started_at        TIMESTAMPTZ,
    finished_at       TIMESTAMPTZ,
    duration_seconds  INTEGER,
    create_time       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id, create_time)
) PARTITION BY RANGE (create_time);

-- 启用 RLS
ALTER TABLE cicd.pipeline_runs_partitioned ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_pipeline_runs_partitioned ON cicd.pipeline_runs_partitioned
    FOR ALL
    USING (tenant_id = current_tenant_id());

-- ============================================================================
-- 4. deployment_history 分区表
-- ============================================================================

CREATE TABLE cicd.deployment_history (
    id                BIGSERIAL,
    tenant_id         BIGINT NOT NULL,
    product_line_id   BIGINT NOT NULL,
    run_id            BIGINT,
    approval_id       BIGINT,
    environment       VARCHAR(64) NOT NULL,
    version           VARCHAR(64) NOT NULL,
    previous_version  VARCHAR(64),
    strategy          VARCHAR(32) NOT NULL,
    config            JSONB,
    status            VARCHAR(32) NOT NULL DEFAULT 'pending',
    progress_percentage INTEGER DEFAULT 0,
    started_at        TIMESTAMPTZ,
    finished_at       TIMESTAMPTZ,
    duration_seconds  INTEGER,
    is_rollback       BOOLEAN DEFAULT FALSE,
    rollback_of_id    BIGINT,
    create_time       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    creator           BIGINT,
    PRIMARY KEY (id, create_time)
) PARTITION BY RANGE (create_time);

-- 启用 RLS
ALTER TABLE cicd.deployment_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_deployment_history ON cicd.deployment_history
    FOR ALL
    USING (tenant_id = current_tenant_id());

-- ============================================================================
-- 5. user_activity 分区表
-- ============================================================================

CREATE TABLE audit.user_activity (
    id                BIGSERIAL,
    tenant_id         BIGINT NOT NULL,
    user_id           BIGINT NOT NULL,
    activity_type     VARCHAR(64) NOT NULL,
    activity_data     JSONB,
    ip_address        VARCHAR(45),
    user_agent        VARCHAR(512),
    session_id        VARCHAR(64),
    create_time       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id, create_time)
) PARTITION BY RANGE (create_time);

-- 启用 RLS
ALTER TABLE audit.user_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_user_activity ON audit.user_activity
    FOR ALL
    USING (tenant_id = current_tenant_id());

-- 用户可以查看自己的活动日志
CREATE POLICY view_own_activity ON audit.user_activity
    FOR SELECT
    USING (
        user_id = (SELECT id FROM core.users WHERE users.id = current_user_id())
        OR current_setting('app.is_superuser', TRUE) = 'true'
    );

-- ============================================================================
-- 分区管理函数
-- ============================================================================

-- 创建按月分区的函数
CREATE OR REPLACE FUNCTION create_monthly_partition(
    p_table_name TEXT,
    p_partition_date DATE
) RETURNS TEXT AS $$
DECLARE
    v_partition_name TEXT;
    v_start_date DATE;
    v_end_date DATE;
    v_sql TEXT;
BEGIN
    v_partition_name := 'p' || to_char(p_partition_date, 'YYYYMM');
    v_start_date := date_trunc('month', p_partition_date);
    v_end_date := v_start_date + INTERVAL '1 month';

    v_sql := format(
        'ALTER TABLE %I ADD PARTITION %I FOR VALUES FROM (%L) TO (%L)',
        p_table_name,
        v_partition_name,
        v_start_date,
        v_end_date
    );

    EXECUTE v_sql;

    RETURN v_partition_name;
END;
$$ LANGUAGE plpgsql;

-- 批量创建未来 3 个月的分区
CREATE OR REPLACE FUNCTION create_future_partitions(
    p_schema_name TEXT,
    p_table_name TEXT,
    p_months_ahead INTEGER DEFAULT 3
) RETURNS TEXT[] AS $$
DECLARE
    v_partitions TEXT[] := ARRAY[]::TEXT[];
    v_partition_name TEXT;
    v_future_date DATE;
    i INTEGER;
BEGIN
    FOR i IN 0..p_months_ahead LOOP
        v_future_date := (date_trunc('month', CURRENT_DATE) + (i || ' month')::INTERVAL)::DATE;

        BEGIN
            v_partition_name := create_monthly_partition(
                p_schema_name || '.' || p_table_name,
                v_future_date
            );
            v_partitions := array_append(v_partitions, v_partition_name);
        EXCEPTION
            WHEN duplicate_table THEN
                -- 分区已存在，跳过
                v_partitions := array_append(v_partitions, 'p' || to_char(v_future_date, 'YYYYMM') || ' (exists)');
        END;
    END LOOP;

    RETURN v_partitions;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 初始化分区（创建当前月及未来 3 个月的分区）
-- ============================================================================

-- audit_logs_partitioned
SELECT create_monthly_partition('audit.audit_logs_partitioned', date_trunc('month', CURRENT_DATE)::DATE);
SELECT create_monthly_partition('audit.audit_logs_partitioned', (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month')::DATE);
SELECT create_monthly_partition('audit.audit_logs_partitioned', (date_trunc('month', CURRENT_DATE) + INTERVAL '2 months')::DATE);
SELECT create_monthly_partition('audit.audit_logs_partitioned', (date_trunc('month', CURRENT_DATE) + INTERVAL '3 months')::DATE);

-- event_logs_partitioned
SELECT create_monthly_partition('audit.event_logs_partitioned', date_trunc('month', CURRENT_DATE)::DATE);
SELECT create_monthly_partition('audit.event_logs_partitioned', (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month')::DATE);
SELECT create_monthly_partition('audit.event_logs_partitioned', (date_trunc('month', CURRENT_DATE) + INTERVAL '2 months')::DATE);
SELECT create_monthly_partition('audit.event_logs_partitioned', (date_trunc('month', CURRENT_DATE) + INTERVAL '3 months')::DATE);

-- pipeline_runs_partitioned
SELECT create_monthly_partition('cicd.pipeline_runs_partitioned', date_trunc('month', CURRENT_DATE)::DATE);
SELECT create_monthly_partition('cicd.pipeline_runs_partitioned', (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month')::DATE);
SELECT create_monthly_partition('cicd.pipeline_runs_partitioned', (date_trunc('month', CURRENT_DATE) + INTERVAL '2 months')::DATE);
SELECT create_monthly_partition('cicd.pipeline_runs_partitioned', (date_trunc('month', CURRENT_DATE) + INTERVAL '3 months')::DATE);

-- deployment_history
SELECT create_monthly_partition('cicd.deployment_history', date_trunc('month', CURRENT_DATE)::DATE);
SELECT create_monthly_partition('cicd.deployment_history', (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month')::DATE);
SELECT create_monthly_partition('cicd.deployment_history', (date_trunc('month', CURRENT_DATE) + INTERVAL '2 months')::DATE);
SELECT create_monthly_partition('cicd.deployment_history', (date_trunc('month', CURRENT_DATE) + INTERVAL '3 months')::DATE);

-- user_activity
SELECT create_monthly_partition('audit.user_activity', date_trunc('month', CURRENT_DATE)::DATE);
SELECT create_monthly_partition('audit.user_activity', (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month')::DATE);
SELECT create_monthly_partition('audit.user_activity', (date_trunc('month', CURRENT_DATE) + INTERVAL '2 months')::DATE);
SELECT create_monthly_partition('audit.user_activity', (date_trunc('month', CURRENT_DATE) + INTERVAL '3 months')::DATE);

-- ============================================================================
-- 自动分区管理（通过 pg_cron 定时任务）
-- ============================================================================

-- 如果安装了 pg_cron，可以创建定时任务自动创建分区
-- 注意：需要 postgresql.conf 中配置 shared_preload_libraries = 'pg_cron'

/*
SELECT cron.schedule(
    'create-monthly-partitions',
    '0 0 25 * *',  -- 每月 25 日执行
    $$SELECT create_future_partitions('audit', 'audit_logs_partitioned', 3)$$
);

SELECT cron.schedule(
    'create-event-log-partitions',
    '0 0 25 * *',
    $$SELECT create_future_partitions('audit', 'event_logs_partitioned', 3)$$
);

SELECT cron.schedule(
    'create-pipeline-run-partitions',
    '0 0 25 * *',
    $$SELECT create_future_partitions('cicd', 'pipeline_runs_partitioned', 3)$$
);
*/

-- ============================================================================
-- 分区数据归档函数
-- ============================================================================

-- 删除过期分区（将数据归档到冷存储后调用）
CREATE OR REPLACE FUNCTION drop_old_partition(
    p_schema_name TEXT,
    p_table_name TEXT,
    p_months_old INTEGER DEFAULT 12
) RETURNS TEXT AS $$
DECLARE
    v_partition_name TEXT;
    v_old_date DATE;
    v_sql TEXT;
BEGIN
    v_old_date := (date_trunc('month', CURRENT_DATE) - (p_months_old || ' months')::INTERVAL)::DATE;
    v_partition_name := 'p' || to_char(v_old_date, 'YYYYMM');

    v_sql := format(
        'ALTER TABLE %I.%I DETACH PARTITION %I',
        p_schema_name,
        p_table_name,
        v_partition_name
    );

    EXECUTE v_sql;

    -- 可以将分离的分区重命名为归档表
    v_sql := format('ALTER TABLE %I RENAME TO %I', v_partition_name, p_table_name || '_archived_' || to_char(v_old_date, 'YYYYMM'));
    EXECUTE v_sql;

    RETURN v_partition_name;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 分区视图（统一查询所有分区）
-- ============================================================================

-- 创建统一视图，应用无需关心分区细节
CREATE OR REPLACE VIEW audit.audit_logs_all AS
SELECT * FROM audit.audit_logs_partitioned;

CREATE OR REPLACE VIEW audit.event_logs_all AS
SELECT * FROM audit.event_logs_partitioned;

CREATE OR REPLACE VIEW cicd.pipeline_runs_all AS
SELECT * FROM cicd.pipeline_runs_partitioned;

CREATE OR REPLACE VIEW cicd.deployment_history_all AS
SELECT * FROM cicd.deployment_history;

CREATE OR REPLACE VIEW audit.user_activity_all AS
SELECT * FROM audit.user_activity;
