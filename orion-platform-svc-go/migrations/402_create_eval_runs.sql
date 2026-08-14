CREATE TABLE IF NOT EXISTS eval_runs (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    set_id VARCHAR(36) NOT NULL,
    tenant_id VARCHAR(36) NOT NULL DEFAULT '',
    model VARCHAR(100) DEFAULT '',
    status VARCHAR(20) NOT NULL DEFAULT 'running',  -- running / completed / failed
    pass_count INT NOT NULL DEFAULT 0,
    total_count INT NOT NULL DEFAULT 0,
    avg_recall DOUBLE PRECISION DEFAULT 0,
    avg_score DOUBLE PRECISION DEFAULT 0,
    report TEXT DEFAULT '',                          -- JSON summary
    created_by VARCHAR(100) DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    INDEX idx_eval_runs_set (set_id),
    INDEX idx_eval_runs_tenant (tenant_id)
);