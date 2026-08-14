CREATE TABLE IF NOT EXISTS eval_sets (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL DEFAULT '',
    name VARCHAR(200) NOT NULL,
    description TEXT DEFAULT '',
    version INT NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    created_by VARCHAR(100) DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_eval_sets_tenant (tenant_id)
);

CREATE TABLE IF NOT EXISTS eval_set_cases (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    set_id VARCHAR(36) NOT NULL,
    tenant_id VARCHAR(36) NOT NULL DEFAULT '',
    query TEXT NOT NULL,
    gold_answer TEXT DEFAULT '',
    gold_sources TEXT DEFAULT '',   -- JSON array of doc IDs
    tags VARCHAR(200) DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_eval_set_cases_set (set_id)
);