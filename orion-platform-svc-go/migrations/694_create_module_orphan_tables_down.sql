-- Reverse 694_create_module_orphan_tables.sql.

DROP INDEX IF EXISTS idx_crossover_calls_target;
DROP INDEX IF EXISTS idx_crossover_calls_status;
DROP INDEX IF EXISTS idx_crossover_calls_created_at;
DROP INDEX IF EXISTS idx_crossover_calls_tenant;
DROP TABLE IF EXISTS crossover_calls;

DROP INDEX IF EXISTS idx_gateway_gray_release_route;
DROP TABLE IF EXISTS gateway_gray_release;

DROP INDEX IF EXISTS idx_webhook_config_domain;
DROP TABLE IF EXISTS webhook_config;

DROP INDEX IF EXISTS idx_skill_versions_skill;
DROP TABLE IF EXISTS skill_versions;

DROP INDEX IF EXISTS idx_queue_jobs_priority;
DROP INDEX IF EXISTS idx_queue_jobs_queue;
DROP TABLE IF EXISTS queue_jobs;

DROP INDEX IF EXISTS idx_llm_model_pricing_model;
DROP TABLE IF EXISTS llm_model_pricing;

DROP INDEX IF EXISTS idx_llm_traces_status;
DROP INDEX IF EXISTS idx_llm_traces_model;
DROP INDEX IF EXISTS idx_llm_traces_tenant;
DROP TABLE IF EXISTS llm_traces;

DROP INDEX IF EXISTS idx_degradation_actions_tenant;
DROP TABLE IF EXISTS degradation_actions;

DROP INDEX IF EXISTS idx_degradation_triggers_tenant;
DROP TABLE IF EXISTS degradation_triggers;

DROP INDEX IF EXISTS idx_scheduler_job_logs_job;
DROP TABLE IF EXISTS scheduler_job_execution_logs;

DROP INDEX IF EXISTS idx_scheduler_job_defs_tenant;
DROP TABLE IF EXISTS scheduler_job_definitions;