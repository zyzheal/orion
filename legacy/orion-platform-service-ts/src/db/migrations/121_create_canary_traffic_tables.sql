-- Migration 121: Create canary_traffic_configs and canary_traffic_history tables
-- Tables for TrafficManager - traffic split configuration and execution history tracking

-- Canary Traffic Split Configurations
CREATE TABLE IF NOT EXISTS canary_traffic_configs (
    id VARCHAR(255) PRIMARY KEY,
    canary_id VARCHAR(255) NOT NULL,
    strategy VARCHAR(20) NOT NULL,
    host VARCHAR(255),
    namespace VARCHAR(100) DEFAULT 'default',
    upstream_name VARCHAR(255),
    phase VARCHAR(20) DEFAULT 'initial',
    baseline_weight INT,
    canary_weight INT,
    baseline_destination VARCHAR(255),
    baseline_subset VARCHAR(100),
    canary_destination VARCHAR(255),
    canary_subset VARCHAR(100),
    servers JSONB DEFAULT '[]',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_canary_traffic_configs_canary ON canary_traffic_configs(canary_id);
CREATE INDEX idx_canary_traffic_configs_strategy ON canary_traffic_configs(strategy);
CREATE INDEX idx_canary_traffic_configs_phase ON canary_traffic_configs(phase);

COMMENT ON TABLE canary_traffic_configs IS 'Traffic split configurations for canary deployments';

-- Canary Traffic Execution History
CREATE TABLE IF NOT EXISTS canary_traffic_history (
    id VARCHAR(255) PRIMARY KEY,
    canary_id VARCHAR(255) NOT NULL,
    success BOOLEAN NOT NULL,
    result TEXT NOT NULL,
    error TEXT,
    executed_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_canary_traffic_history_canary ON canary_traffic_history(canary_id);
CREATE INDEX idx_canary_traffic_history_success ON canary_traffic_history(success);
CREATE INDEX idx_canary_traffic_history_executed ON canary_traffic_history(executed_at DESC);

COMMENT ON TABLE canary_traffic_history IS 'Execution history of traffic split operations';
