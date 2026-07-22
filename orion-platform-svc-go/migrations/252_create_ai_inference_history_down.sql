-- Migration #252 down: Drop ai_inference_history table

DROP INDEX IF EXISTS idx_ai_inference_history_tenant_created;
DROP INDEX IF NOT EXISTS idx_ai_inference_history_success;
DROP INDEX IF NOT EXISTS idx_ai_inference_history_type;
DROP INDEX IF NOT EXISTS idx_ai_inference_history_created_at;
DROP INDEX IF NOT EXISTS idx_ai_inference_history_tenant;

DROP TABLE IF EXISTS ai_inference_history;
