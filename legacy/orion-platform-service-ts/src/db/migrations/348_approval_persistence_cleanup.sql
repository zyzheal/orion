-- Migration 348: Approval Domain Persistence Cleanup
-- Adds missing columns and ensures consistency for approval tables

-- Add title column to approvals table (used by ApprovalRepository)
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS title VARCHAR(500);

-- Ensure approval_flow_configs has all needed columns
-- (migration 285 created the table, this adds any missing indexes)
CREATE INDEX IF NOT EXISTS idx_approval_flow_configs_enabled
  ON approval_flow_configs(tenant_id, enabled) WHERE enabled = true;

-- Ensure RLS policies exist for approval_flow_configs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'approval_flow_configs' AND policyname = 'tenant_isolation_approval_flow_configs'
  ) THEN
    ALTER TABLE approval_flow_configs ENABLE ROW LEVEL SECURITY;
    ALTER TABLE approval_flow_configs FORCE ROW LEVEL SECURITY;
    CREATE POLICY tenant_isolation_approval_flow_configs ON approval_flow_configs
      USING (
        current_setting('app.current_tenant_id', true) IS NOT NULL
        AND current_setting('app.current_tenant_id', true) != ''
        AND tenant_id::text = current_setting('app.current_tenant_id')
      );
  END IF;
END $$;

-- Ensure RLS policies exist for approval_approver_rules
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'approval_approver_rules' AND policyname = 'tenant_isolation_approval_approver_rules'
  ) THEN
    ALTER TABLE approval_approver_rules ENABLE ROW LEVEL SECURITY;
    ALTER TABLE approval_approver_rules FORCE ROW LEVEL SECURITY;
    CREATE POLICY tenant_isolation_approval_approver_rules ON approval_approver_rules
      USING (
        current_setting('app.current_tenant_id', true) IS NOT NULL
        AND current_setting('app.current_tenant_id', true) != ''
        AND tenant_id::text = current_setting('app.current_tenant_id')
      );
  END IF;
END $$;

-- Ensure RLS policies exist for approval_fallback_logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'approval_fallback_logs' AND policyname = 'tenant_isolation_approval_fallback_logs'
  ) THEN
    ALTER TABLE approval_fallback_logs ENABLE ROW LEVEL SECURITY;
    ALTER TABLE approval_fallback_logs FORCE ROW LEVEL SECURITY;
    CREATE POLICY tenant_isolation_approval_fallback_logs ON approval_fallback_logs
      USING (
        current_setting('app.current_tenant_id', true) IS NOT NULL
        AND current_setting('app.current_tenant_id', true) != ''
        AND tenant_id::text = current_setting('app.current_tenant_id')
      );
  END IF;
END $$;
