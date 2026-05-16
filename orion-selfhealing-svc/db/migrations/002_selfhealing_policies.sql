-- Self-Healing Policies Migration
-- Adds strategy policy library and execution records

-- Self-Healing Policies Table
CREATE TABLE IF NOT EXISTS selfhealing_policies (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              VARCHAR(255) NOT NULL,
  description       TEXT,
  condition_type    VARCHAR(100) NOT NULL,
  condition_config  JSONB NOT NULL DEFAULT '{}',
  action_type       VARCHAR(100) NOT NULL,
  action_config     JSONB NOT NULL DEFAULT '{}',
  cooldown_seconds  INTEGER DEFAULT 300,
  enabled           BOOLEAN DEFAULT true,
  priority          INTEGER DEFAULT 10,
  confidence        DECIMAL(5,4) DEFAULT 0.5,
  max_retries       INTEGER DEFAULT 3,
  timeout_seconds   INTEGER DEFAULT 300,
  tenant_id         VARCHAR(100),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Self-Healing Executions Table
CREATE TABLE IF NOT EXISTS selfhealing_executions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  policy_id         UUID NOT NULL,
  incident_id       UUID,
  target            VARCHAR(255) NOT NULL,
  status            VARCHAR(50) NOT NULL DEFAULT 'pending',
  result            JSONB,
  error_message     TEXT,
  started_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at      TIMESTAMPTZ,
  FOREIGN KEY (policy_id) REFERENCES selfhealing_policies(id) ON DELETE CASCADE,
  FOREIGN KEY (incident_id) REFERENCES self_healing_incidents(id) ON DELETE SET NULL
);

-- Indexes for performance
CREATE INDEX idx_policies_enabled ON selfhealing_policies(enabled);
CREATE INDEX idx_policies_condition_type ON selfhealing_policies(condition_type);
CREATE INDEX idx_policies_tenant ON selfhealing_policies(tenant_id);
CREATE INDEX idx_policies_priority ON selfhealing_policies(priority);

CREATE INDEX idx_executions_policy ON selfhealing_executions(policy_id);
CREATE INDEX idx_executions_incident ON selfhealing_executions(incident_id);
CREATE INDEX idx_executions_status ON selfhealing_executions(status);
CREATE INDEX idx_executions_target ON selfhealing_executions(target);

-- Insert default policies (seed data)
INSERT INTO selfhealing_policies (name, description, condition_type, condition_config, action_type, action_config, cooldown_seconds, enabled, priority, confidence, max_retries, timeout_seconds) VALUES
(
  'High Severity Auto-Restart',
  'Automatically restart services when critical or high severity incidents occur',
  'severity',
  '{"severity": ["critical", "high"]}',
  'restart',
  '{"maxRetries": 3, "graceful": true}',
  300,
  true,
  1,
  0.85,
  3,
  300
),
(
  'Medium Severity Auto-Scale',
  'Automatically scale out when medium severity incidents occur',
  'severity',
  '{"severity": ["medium"]}',
  'scale',
  '{"scaleFactor": 2, "minReplicas": 1, "maxReplicas": 10}',
  180,
  true,
  2,
  0.7,
  2,
  180
),
(
  'Database Connection Recovery',
  'Recover from database connection issues',
  'source_match',
  '{"pattern": "database|connection"}',
  'reconnect',
  '{"verifyConnection": true, "maxRetries": 5}',
  120,
  true,
  1,
  0.9,
  3,
  120
),
(
  'Memory Pressure Auto-Scale',
  'Scale out when memory usage is high',
  'metric_threshold',
  '{"metric": "memory_usage", "operator": ">", "threshold": 80}',
  'scale',
  '{"scaleFactor": 1.5, "minReplicas": 2}',
  300,
  true,
  3,
  0.75,
  2,
  180
),
(
  'CPU High Auto-Scale',
  'Scale out when CPU usage exceeds threshold',
  'metric_threshold',
  '{"metric": "cpu_usage", "operator": ">", "threshold": 85}',
  'scale',
  '{"scaleFactor": 2, "maxReplicas": 20}',
  180,
  true,
  3,
  0.8,
  2,
  180
),
(
  'Always Notify On-Call',
  'Always notify on-call engineers for any incident',
  'always',
  '{}',
  'notify',
  '{"channel": "slack", "urgency": "high"}',
  60,
  true,
  10,
  0.99,
  1,
  30
),
(
  'Disk Full Cleanup',
  'Clean up disk when disk usage is critical',
  'metric_threshold',
  '{"metric": "disk_usage", "operator": ">", "threshold": 95}',
  'cleanup',
  '{"targetPath": "/tmp", "maxAge": 3600}',
  600,
  true,
  1,
  0.6,
  2,
  300
),
(
  'Pod Crash Loop Recovery',
  'Recover from pod crash loop by restarting with backoff',
  'event_match',
  '{"event": "CrashLoopBackOff"}',
  'restart',
  '{"force": true, "backoffMultiplier": 1.5}',
  600,
  true,
  1,
  0.7,
  5,
  600
)
ON CONFLICT DO NOTHING;

-- Rollback:
-- DROP TABLE IF EXISTS selfhealing_executions, selfhealing_policies;