-- orion-platform-service/src/db/migrations/080_create_llm_traces.sql
-- LLM调用链追踪表
-- Migration for #51 LLM调用链追踪

-- LLM追踪主表
CREATE TABLE IF NOT EXISTS llm_traces (
    id SERIAL PRIMARY KEY,
    trace_id VARCHAR(64) NOT NULL UNIQUE,
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    user_id VARCHAR(64),
    scenario_id VARCHAR(64),
    provider_id VARCHAR(64),
    model_id VARCHAR(64) NOT NULL,

    -- Prompt信息
    prompt_content TEXT,
    prompt_hash VARCHAR(128),
    prompt_tokens INTEGER,

    -- 输出信息
    output_content TEXT,
    output_hash VARCHAR(128),
    output_tokens INTEGER,

    -- Token统计
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,

    -- 成本信息
    input_cost DECIMAL(10,6) DEFAULT 0,
    output_cost DECIMAL(10,6) DEFAULT 0,
    total_cost DECIMAL(10,6) DEFAULT 0,
    currency VARCHAR(8) DEFAULT 'CNY',

    -- 时间信息
    request_started_at TIMESTAMP WITH TIME ZONE,
    request_completed_at TIMESTAMP WITH TIME ZONE,
    duration_ms INTEGER,

    -- 状态信息
    status VARCHAR(16) DEFAULT 'pending',
    error_message TEXT,

    -- 上下文关联
    parent_trace_id VARCHAR(64),
    request_context JSONB DEFAULT '{}',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_llm_traces_trace_id ON llm_traces(trace_id);
CREATE INDEX IF NOT EXISTS idx_llm_traces_tenant ON llm_traces(tenant_id);
CREATE INDEX IF NOT EXISTS idx_llm_traces_scenario ON llm_traces(scenario_id);
CREATE INDEX IF NOT EXISTS idx_llm_traces_model ON llm_traces(model_id);
CREATE INDEX IF NOT EXISTS idx_llm_traces_created ON llm_traces(created_at);
CREATE INDEX IF NOT EXISTS idx_llm_traces_parent ON llm_traces(parent_trace_id);

-- Token消耗聚合表（按日）
CREATE TABLE IF NOT EXISTS llm_token_daily_stats (
    id SERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    stat_date DATE NOT NULL,
    scenario_id VARCHAR(64),
    provider_id VARCHAR(64),
    model_id VARCHAR(64),

    total_requests INTEGER DEFAULT 0,
    total_input_tokens BIGINT DEFAULT 0,
    total_output_tokens BIGINT DEFAULT 0,
    total_tokens BIGINT DEFAULT 0,

    total_cost DECIMAL(12,4) DEFAULT 0,
    avg_duration_ms INTEGER,

    success_rate DECIMAL(5,4),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(tenant_id, stat_date, scenario_id, model_id)
);

-- 统计表索引
CREATE INDEX IF NOT EXISTS idx_llm_token_stats_tenant ON llm_token_daily_stats(tenant_id);
CREATE INDEX IF NOT EXISTS idx_llm_token_stats_date ON llm_token_daily_stats(stat_date);

-- 表注释
COMMENT ON TABLE llm_traces IS 'LLM调用链追踪记录';
COMMENT ON TABLE llm_token_daily_stats IS 'LLM Token消耗日聚合统计';

-- 字段注释
COMMENT ON COLUMN llm_traces.trace_id IS '追踪唯一标识符';
COMMENT ON COLUMN llm_traces.tenant_id IS '租户ID';
COMMENT ON COLUMN llm_traces.user_id IS '用户ID';
COMMENT ON COLUMN llm_traces.scenario_id IS '场景ID（如autofix, chatops等）';
COMMENT ON COLUMN llm_traces.provider_id IS 'LLM提供商ID（如openai, anthropic等）';
COMMENT ON COLUMN llm_traces.model_id IS '模型ID（如gpt-4, claude-sonnet等）';
COMMENT ON COLUMN llm_traces.prompt_content IS '原始Prompt内容';
COMMENT ON COLUMN llm_traces.prompt_hash IS 'Prompt内容SHA256哈希';
COMMENT ON COLUMN llm_traces.prompt_tokens IS 'Prompt Token数量';
COMMENT ON COLUMN llm_traces.output_content IS 'LLM输出内容';
COMMENT ON COLUMN llm_traces.output_hash IS '输出内容SHA256哈希';
COMMENT ON COLUMN llm_traces.output_tokens IS '输出Token数量';
COMMENT ON COLUMN llm_traces.input_tokens IS '总输入Token数（含历史上下文）';
COMMENT ON COLUMN llm_traces.output_tokens IS '总输出Token数';
COMMENT ON COLUMN llm_traces.total_tokens IS '总Token数';
COMMENT ON COLUMN llm_traces.input_cost IS '输入成本（元）';
COMMENT ON COLUMN llm_traces.output_cost IS '输出成本（元）';
COMMENT ON COLUMN llm_traces.total_cost IS '总成本（元）';
COMMENT ON COLUMN llm_traces.currency IS '货币单位';
COMMENT ON COLUMN llm_traces.request_started_at IS '请求开始时间';
COMMENT ON COLUMN llm_traces.request_completed_at IS '请求完成时间';
COMMENT ON COLUMN llm_traces.duration_ms IS '请求耗时（毫秒）';
COMMENT ON COLUMN llm_traces.status IS '状态：pending/completed/failed';
COMMENT ON COLUMN llm_traces.error_message IS '错误信息';
COMMENT ON COLUMN llm_traces.parent_trace_id IS '父追踪ID（用于调用链关联）';
COMMENT ON COLUMN llm_traces.request_context IS '请求上下文信息（JSON）';
COMMENT ON COLUMN llm_traces.metadata IS '扩展元数据（JSON）';

COMMENT ON COLUMN llm_token_daily_stats.tenant_id IS '租户ID';
COMMENT ON COLUMN llm_token_daily_stats.stat_date IS '统计日期';
COMMENT ON COLUMN llm_token_daily_stats.scenario_id IS '场景ID';
COMMENT ON COLUMN llm_token_daily_stats.provider_id IS 'LLM提供商ID';
COMMENT ON COLUMN llm_token_daily_stats.model_id IS '模型ID';
COMMENT ON COLUMN llm_token_daily_stats.total_requests IS '总请求数';
COMMENT ON COLUMN llm_token_daily_stats.total_input_tokens IS '总输入Token数';
COMMENT ON COLUMN llm_token_daily_stats.total_output_tokens IS '总输出Token数';
COMMENT ON COLUMN llm_token_daily_stats.total_tokens IS '总Token数';
COMMENT ON COLUMN llm_token_daily_stats.total_cost IS '总成本（元）';
COMMENT ON COLUMN llm_token_daily_stats.avg_duration_ms IS '平均请求耗时（毫秒）';
COMMENT ON COLUMN llm_token_daily_stats.success_rate IS '成功率（0-1）';