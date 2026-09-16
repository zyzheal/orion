-- Reverse 689_create_ai_domain_orphan_tables.sql.
-- Drops the 14 ai-domain orphan tables and their indexes.
-- Indexes first (they reference the column), then tables.

DROP INDEX IF EXISTS idx_skill_packages_category;
DROP INDEX IF EXISTS idx_skill_packages_name_ver;
DROP TABLE IF EXISTS skill_packages;

DROP INDEX IF EXISTS idx_orchestration_runs_status;
DROP INDEX IF EXISTS idx_orchestration_runs_orch;
DROP TABLE IF EXISTS orchestration_runs;

DROP INDEX IF EXISTS idx_orchestrations_tenant;
DROP TABLE IF EXISTS orchestrations;

DROP INDEX IF EXISTS idx_model_custom_pricing_tenant;
DROP TABLE IF EXISTS model_custom_pricing;

DROP INDEX IF EXISTS idx_knowledge_bases_tenant;
DROP TABLE IF EXISTS knowledge_bases;

DROP INDEX IF EXISTS idx_intelligence_tasks_type;
DROP INDEX IF EXISTS idx_intelligence_tasks_tenant;
DROP TABLE IF EXISTS intelligence_tasks;

DROP INDEX IF EXISTS idx_ai_security_tenant;
DROP TABLE IF EXISTS ai_security;

DROP INDEX IF EXISTS idx_ai_review_status;
DROP INDEX IF EXISTS idx_ai_review_tenant;
DROP TABLE IF EXISTS ai_review;

DROP INDEX IF EXISTS idx_ai_cost_savings_tenant;
DROP TABLE IF EXISTS ai_cost_savings;

DROP INDEX IF EXISTS idx_ai_cost_records_model;
DROP INDEX IF EXISTS idx_ai_cost_records_tenant;
DROP TABLE IF EXISTS ai_cost_records;

DROP INDEX IF EXISTS idx_ai_canary_tenant;
DROP INDEX IF EXISTS idx_ai_canary_model;
DROP TABLE IF EXISTS ai_canary_configs;

DROP INDEX IF EXISTS idx_ai_models_type_status;
DROP INDEX IF EXISTS idx_ai_models_tenant;
DROP TABLE IF EXISTS ai_models;

DROP INDEX IF EXISTS idx_ai_agent_audit_agent;
DROP INDEX IF EXISTS idx_ai_agent_audit_tenant;
DROP TABLE IF EXISTS ai_agent_audit_logs;

DROP INDEX IF EXISTS idx_ai_agents_status;
DROP INDEX IF EXISTS idx_ai_agents_tenant;
DROP TABLE IF EXISTS ai_agents;