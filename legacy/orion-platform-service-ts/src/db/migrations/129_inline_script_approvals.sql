-- Migration 129: Inline Script Approvals
-- Level 3 Advanced Script 审批流程记录

CREATE TABLE IF NOT EXISTS inline_script_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    approval_id VARCHAR(255) NOT NULL UNIQUE,  -- e.g., 'approval-abc123'
    tenant_id UUID NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    script_code_hash VARCHAR(64) NOT NULL,     -- SHA-256 of submitted code
    script_language VARCHAR(50) NOT NULL,      -- 'javascript'
    permissions JSONB NOT NULL,                -- 请求的权限配置
    reason TEXT NOT NULL,                      -- 申请理由
    status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- 'pending', 'approved', 'denied', 'expired'
    required_approvals INTEGER NOT NULL DEFAULT 2,
    current_approvals INTEGER NOT NULL DEFAULT 0,
    expiration_type VARCHAR(20) NOT NULL DEFAULT 'single_use',  -- 'single_use', '24h', '7d'
    expires_at TIMESTAMP,
    used_count INTEGER NOT NULL DEFAULT 0,
    max_uses INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS approval_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    approval_id UUID NOT NULL REFERENCES inline_script_approvals(id) ON DELETE CASCADE,
    approver_id VARCHAR(255) NOT NULL,
    approver_role VARCHAR(100),
    decision VARCHAR(10) NOT NULL,  -- 'approve', 'deny'
    comment TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_approval_tenant ON inline_script_approvals(tenant_id);
CREATE INDEX idx_approval_status ON inline_script_approvals(status);
CREATE INDEX idx_approval_user ON inline_script_approvals(user_id);
CREATE INDEX idx_approval_code_hash ON inline_script_approvals(script_code_hash);
CREATE INDEX idx_decision_approval ON approval_decisions(approval_id);

COMMENT ON TABLE inline_script_approvals IS 'Level 3 inline script approval requests';
COMMENT ON TABLE approval_decisions IS 'Individual approver decisions for script approvals';

-- Enable RLS
ALTER TABLE inline_script_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE inline_script_approvals FORCE ROW LEVEL SECURITY;
CREATE POLICY approvals_tenant_isolation ON inline_script_approvals
    USING (app.current_tenant_id IS NOT NULL AND app.current_tenant_id::uuid = tenant_id);

ALTER TABLE approval_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_decisions FORCE ROW LEVEL SECURITY;
CREATE POLICY decisions_tenant_isolation ON approval_decisions
    USING (
        EXISTS (
            SELECT 1 FROM inline_script_approvals a
            WHERE a.id = approval_decisions.approval_id
            AND a.tenant_id::uuid = app.current_tenant_id
        )
    );
