-- Migration 174: Skill Executions and Audit Log
-- Adds execution history tracking and audit log for skill review workflow

-- ==========================================
-- 1. skill_executions table
-- ==========================================

CREATE TABLE IF NOT EXISTS skill_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    skill_id UUID NOT NULL REFERENCES skill_packages(id) ON DELETE CASCADE,
    instance_id UUID REFERENCES skill_instances(id) ON DELETE SET NULL,
    capability VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'running',  -- running | completed | failed | timeout | cancelled
    input JSONB NOT NULL DEFAULT '{}',
    output JSONB,
    error_message TEXT,
    duration_ms INT,
    triggered_by UUID REFERENCES users(id),
    trigger_mode VARCHAR(20) DEFAULT 'manual',  -- manual | pipeline | schedule | webhook
    metadata JSONB NOT NULL DEFAULT '{}',
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_skill_executions_tenant_id ON skill_executions(tenant_id);
CREATE INDEX idx_skill_executions_skill_id ON skill_executions(skill_id);
CREATE INDEX idx_skill_executions_instance_id ON skill_executions(instance_id);
CREATE INDEX idx_skill_executions_status ON skill_executions(status);
CREATE INDEX idx_skill_executions_started_at ON skill_executions(started_at DESC);
CREATE INDEX idx_skill_executions_tenant_skill ON skill_executions(tenant_id, skill_id);

COMMENT ON TABLE skill_executions IS 'Skill execution history and results';
COMMENT ON COLUMN skill_executions.trigger_mode IS 'How the execution was triggered: manual, pipeline, schedule, webhook';

-- ==========================================
-- 2. skill_audit_logs table
-- ==========================================

CREATE TABLE IF NOT EXISTS skill_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    skill_id UUID NOT NULL REFERENCES skill_packages(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,  -- created | updated | submitted | approved | rejected | archived | published | version_created | instance_created | instance_updated | instance_deleted
    actor_id UUID REFERENCES users(id),
    actor_name VARCHAR(255),
    old_status VARCHAR(20),
    new_status VARCHAR(20),
    reason TEXT,
    changes JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_skill_audit_logs_skill_id ON skill_audit_logs(skill_id);
CREATE INDEX idx_skill_audit_logs_action ON skill_audit_logs(action);
CREATE INDEX idx_skill_audit_logs_created_at ON skill_audit_logs(created_at DESC);

COMMENT ON TABLE skill_audit_logs IS 'Audit trail for skill lifecycle changes';

-- ==========================================
-- 3. Add missing columns to skill_instances
-- ==========================================

ALTER TABLE skill_instances ADD COLUMN IF NOT EXISTS name VARCHAR(255);
ALTER TABLE skill_instances ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false;

-- Copy instance_name to name if name is null
UPDATE skill_instances SET name = instance_name WHERE name IS NULL AND instance_name IS NOT NULL;

COMMENT ON COLUMN skill_instances.is_default IS 'Whether this is the default instance for this skill+tenant';

-- ==========================================
-- 4. Add review-related columns to skill_packages
-- ==========================================

ALTER TABLE skill_packages ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
ALTER TABLE skill_packages ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE skill_packages ADD COLUMN IF NOT EXISTS reviewer_id UUID REFERENCES users(id);
ALTER TABLE skill_packages ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

COMMENT ON COLUMN skill_packages.submitted_at IS 'When the skill was submitted for review';
COMMENT ON COLUMN skill_packages.reviewed_at IS 'When the review decision was made';
COMMENT ON COLUMN skill_packages.rejection_reason IS 'Reason for rejection when status=rejected';
