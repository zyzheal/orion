-- Schema 一致性测试: TS vs Go (共享 PostgreSQL)
-- 验证: id/tenant_id 类型统一为 UUID, 字段名一致, 约束兼容

-- 1. tenants 表
SELECT 'tenants' as tbl, column_name, data_type, is_nullable
FROM information_schema.columns WHERE table_name = 'tenants'
  AND column_name IN ('id','tenant_id','name','status')
ORDER BY ordinal_position;

-- 2. approval_requests
SELECT 'approval_requests' as tbl, column_name, data_type
FROM information_schema.columns WHERE table_name = 'approval_requests'
  AND column_name IN ('id','tenant_id')
ORDER BY ordinal_position;

-- 3. 验证: 所有重复模块 id 和 tenant_id 均为 uuid
DO $$
DECLARE
  r RECORD;
  bad_count INT := 0;
BEGIN
  FOR r IN (
    SELECT c.table_name, c.column_name, c.data_type
    FROM information_schema.columns c
    WHERE c.table_name IN (
      'tenants','tenant_users','approval_requests','approval_levels','approval_history',
      'approval_templates','approval_gates','artifacts','artifact_tags',
      'builds','build_images','deployments','rollback_plans',
      'incidents','timeline_events','escalaion_records','postmortems',
      'knowledge_spaces','documents','doc_versions','sync_logs',
      'monitoring_metrics','alert_rules','alerts','notification_channels'
    )
    AND c.column_name IN ('id','tenant_id')
    AND c.data_type NOT LIKE '%uuid%'
  ) LOOP
    RAISE NOTICE '❌ %.% is % (expected uuid)', r.table_name, r.column_name, r.data_type;
    bad_count := bad_count + 1;
  END LOOP;
  IF bad_count = 0 THEN
    RAISE NOTICE '✅ 所有重复模块 id/tenant_id 均为 UUID';
  ELSE
    RAISE NOTICE '⚠️ 发现 % 处类型不匹配', bad_count;
  END IF;
END $$;
