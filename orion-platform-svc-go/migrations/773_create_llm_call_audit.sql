-- Migration 773: Create llm_call_audit table (GATE-LLM-SEC-1)
-- 来源: docs/llm-security-hardening-2026-10-11.md §L5 审计日志
-- 目的: LLM 调用审计表 - 承载 human_confirm / confidence_score / status / threats_detected
-- 兼容性: 新表, 不影响现有业务表
-- 编号: 773 (企业级升级批次; baseline v5.24 §migrations.assigned.773-775)
-- 回滚: 773_create_llm_call_audit_down.sql
--
-- 用途:
--   GATE-LLM-SEC-1 (BLOCK): 检测 human_confirm 字段（当前 0 处 → T1 时启用 BLOCK）
--   GATE-LLM-SEC-2 (DEGRADE): 检测 confidence_score 字段
--   GATE-LLM-SEC-3 (DEGRADE): 检测 sla_deadline + fallback_action 字段
--
-- 审计保留期: 90 天热存储 + 1 年冷存储 (AWS SEC01-BP01)

BEGIN;

CREATE TABLE IF NOT EXISTS llm_call_audit (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        TEXT NOT NULL,
    request_id       TEXT NOT NULL,
    decision_type    TEXT NOT NULL,

    -- 模板信息 (L6 关联 prompt_templates)
    template_id      TEXT NOT NULL,
    template_version TEXT NOT NULL,

    -- 输入/输出摘要 (避免记录原文, 只记录 hash + 长度)
    input_hash       TEXT NOT NULL,
    input_length     INTEGER NOT NULL,
    output_hash      TEXT,
    output_length    INTEGER,

    -- 计量
    token_usage      INTEGER,
    latency_ms       INTEGER,

    -- 状态机 (L5 状态枚举)
    status           TEXT NOT NULL CHECK (status IN ('ok', 'blocked', 'timeout', 'invalid_output', 'needs_confirm', 'expired')),
    block_reason     TEXT,

    -- 安全检测
    threats_detected JSONB,
    pii_redacted     TEXT[],

    -- GATE-LLM-SEC-1: 人工确认 (BLOCK 门控)
    human_confirm    BOOLEAN NOT NULL DEFAULT FALSE,
    human_confirmed_by UUID,
    human_confirmed_at TIMESTAMPTZ,

    -- GATE-LLM-SEC-2: 置信度评分 (DEGRADE 门控)
    confidence_score NUMERIC(5,4),

    -- GATE-LLM-SEC-3: SLA 与降级 (DEGRADE 门控)
    sla_deadline     TIMESTAMPTZ,
    fallback_action  TEXT CHECK (fallback_action IN ('retry', 'manual_review', 'reject', 'escalate')),

    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 审计查询主索引 (按租户 + 决策类型 + 时间排序)
CREATE INDEX IF NOT EXISTS idx_llm_call_audit_tenant_decision
    ON llm_call_audit (tenant_id, decision_type, created_at);

-- 人工确认查询索引 (GATE-LLM-SEC-1)
CREATE INDEX IF NOT EXISTS idx_llm_call_audit_human_confirm
    ON llm_call_audit (human_confirm, tenant_id, created_at)
    WHERE human_confirm = FALSE;

-- 置信度查询索引 (GATE-LLM-SEC-2)
CREATE INDEX IF NOT EXISTS idx_llm_call_audit_confidence
    ON llm_call_audit (confidence_score, tenant_id)
    WHERE confidence_score < 0.7;

-- 状态查询索引
CREATE INDEX IF NOT EXISTS idx_llm_call_audit_status
    ON llm_call_audit (status, tenant_id, created_at);

COMMIT;
