-- Migration 376: Notification Policies - PostgreSQL persistence migration
-- 通知策略表规范化补齐缺失列，补齐后由 NotificationPolicyService 支持 DB 失败降级到内存

-- 补齐 notification_policies 缺失列
DO $$
BEGIN
  -- recipients column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notification_policies' AND column_name = 'recipients'
  ) THEN
    ALTER TABLE notification_policies ADD COLUMN recipients TEXT[] DEFAULT '{}';
  END IF;

  -- throttle_minutes column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notification_policies' AND column_name = 'throttle_minutes'
  ) THEN
    ALTER TABLE notification_policies ADD COLUMN throttle_minutes INTEGER NOT NULL DEFAULT 0;
  END IF;

  -- created_by column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notification_policies' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE notification_policies ADD COLUMN created_by VARCHAR(100);
  END IF;
END $$;

-- 补齐 notification_workflows 缺失列
DO $$
BEGIN
  -- policy_id column (for linking workflows to policies)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notification_workflows' AND column_name = 'policy_id'
  ) THEN
    ALTER TABLE notification_workflows ADD COLUMN policy_id TEXT;
  END IF;

  -- created_by column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notification_workflows' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE notification_workflows ADD COLUMN created_by VARCHAR(100);
  END IF;
END $$;

-- 索引
CREATE INDEX IF NOT EXISTS idx_notif_policy_tenant ON notification_policies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notif_policy_enabled ON notification_policies(enabled) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_notif_workflow_policy ON notification_workflows(policy_id);

-- 迁移: throttle_config JSONB -> throttle_minutes integer
UPDATE notification_policies
SET throttle_minutes = (throttle_config->>'minutes')::integer
WHERE throttle_config IS NOT NULL
  AND throttle_config != '{}'
  AND throttle_minutes = 0;
