-- Rollback Migration 122: Drop policy override table
DROP TABLE IF EXISTS policy_overrides_v2 CASCADE;
