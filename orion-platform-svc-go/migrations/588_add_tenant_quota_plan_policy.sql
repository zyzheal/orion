-- tenant-quota: Phase 306 policy fields were written by the repository and the
-- service but declared by no migration.
--
-- 398_create_tenant_quota.sql declares tenant_quota_plan with ten per-metric
-- caps and no policy columns. Since Phase 306 the module has carried four more:
--   soft_limit         BIGINT     -- absolute warning threshold
--   hard_limit         BIGINT     -- absolute blocking threshold
--   over_limit_action  VARCHAR    -- block / warn / allow
--   warn_thresholds    VARCHAR    -- comma-separated percentages
-- The service (internal/tenant-quota/service/service.go, UpdatePlan) puts all
-- four into the attrs map, and the repository interpolated them into the
-- UPDATE verbatim, so every request that set any of them died with
--   pq: column "soft_limit" of relation "tenant_quota_plan" does not exist
-- CreatePlan silently dropped them too: the INSERT names no such columns, so a
-- plan created with a SoftLimit came back from the database without it.
--
-- warn_thresholds is stored as a comma-separated string rather than JSONB
-- because the service already serialises it with joinInts and deserialises it
-- with parseThresholds; keeping the wire format in the column avoids a second
-- representation of the same data. VARCHAR(255) holds the normalised
-- threshold list (normalizeWarnThresholds caps it at three entries).
--
-- NOT NULL with defaults, so existing rows keep the "no policy configured"
-- semantics: soft_limit = hard_limit = 0 means "no cap", and
-- over_limit_action defaults to "block" because that is the value
-- normalizeOverLimitAction returns for an unknown action.
-- cmd/server/migration_tenant_quota_tables_test.go pins the pair.

ALTER TABLE tenant_quota_plan ADD COLUMN IF NOT EXISTS soft_limit BIGINT NOT NULL DEFAULT 0;
ALTER TABLE tenant_quota_plan ADD COLUMN IF NOT EXISTS hard_limit BIGINT NOT NULL DEFAULT 0;
ALTER TABLE tenant_quota_plan ADD COLUMN IF NOT EXISTS over_limit_action VARCHAR(20) NOT NULL DEFAULT 'block';
ALTER TABLE tenant_quota_plan ADD COLUMN IF NOT EXISTS warn_thresholds VARCHAR(255) NOT NULL DEFAULT '';
