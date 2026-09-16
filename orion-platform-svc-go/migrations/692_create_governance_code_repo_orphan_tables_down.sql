-- Reverse 692_create_governance_code_repo_orphan_tables.sql.
-- Drops the 10 governance + code-repo orphan tables and their indexes.

DROP INDEX IF EXISTS idx_code_repo_webhook_logs_tenant;
DROP INDEX IF EXISTS idx_code_repo_webhook_logs_repo;
DROP TABLE IF EXISTS code_repo_webhook_logs;

DROP INDEX IF EXISTS idx_code_repo_codeowners_repo;
DROP TABLE IF EXISTS code_repo_codeowners;

DROP INDEX IF EXISTS idx_code_repo_diffs_key;
DROP TABLE IF EXISTS code_repo_diffs;

DROP INDEX IF EXISTS idx_code_repo_commits_sha;
DROP INDEX IF EXISTS idx_code_repo_commits_key;
DROP TABLE IF EXISTS code_repo_commits;

DROP INDEX IF EXISTS idx_code_repo_repos_name;
DROP TABLE IF EXISTS code_repo_repos;

DROP INDEX IF EXISTS idx_compliance_remediations_status;
DROP INDEX IF EXISTS idx_compliance_remediations_tenant;
DROP TABLE IF EXISTS compliance_remediations;

DROP INDEX IF EXISTS idx_governance_rules_type;
DROP INDEX IF EXISTS idx_governance_rules_tenant;
DROP TABLE IF EXISTS governance_rules;

DROP INDEX IF EXISTS idx_api_contract_violations_contract;
DROP TABLE IF EXISTS api_contract_violations;

DROP INDEX IF EXISTS idx_api_versions_contract;
DROP INDEX IF EXISTS idx_api_versions_tenant;
DROP TABLE IF EXISTS api_versions;

DROP INDEX IF EXISTS idx_api_inventory_tenant;
DROP TABLE IF EXISTS api_inventory;