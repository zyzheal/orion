-- Migration 192: Map() in-memory storage → PostgreSQL Repository
-- Migrates remaining services from Map() to persistent storage
-- Covers: self-healing, security, hook-chain, integration, finops, degradation,
--          test-generation, message-queue, privacy, deploy, risk-assessment, auth

-- ==================== Self-Healing ====================

CREATE TABLE IF NOT EXISTS healing_action_results (
  id VARCHAR(100) PRIMARY KEY,
  action_type VARCHAR(50) NOT NULL,
  success BOOLEAN NOT NULL DEFAULT false,
  duration_ms INTEGER,
  message TEXT,
  error TEXT,
  executed_at TIMESTAMP DEFAULT NOW(),
  verified BOOLEAN DEFAULT false,
  rollback_needed BOOLEAN DEFAULT false,
  rollback_success BOOLEAN,
  tenant_id VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_healing_action_results_type ON healing_action_results(action_type);
CREATE INDEX IF NOT EXISTS idx_healing_action_results_tenant ON healing_action_results(tenant_id);

CREATE TABLE IF NOT EXISTS healing_approval_requests (
  id VARCHAR(100) PRIMARY KEY,
  incident_id VARCHAR(100) NOT NULL,
  title VARCHAR(500),
  description TEXT,
  risk_level VARCHAR(50),
  recommended_actions JSONB DEFAULT '[]',
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  requested_by VARCHAR(200),
  requested_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  approved_by VARCHAR(200),
  approval_reason TEXT,
  responded_at TIMESTAMP,
  tenant_id VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_healing_approval_incident ON healing_approval_requests(incident_id);
CREATE INDEX IF NOT EXISTS idx_healing_approval_status ON healing_approval_requests(status);

-- ==================== Security ====================

CREATE TABLE IF NOT EXISTS security_trivy_scans (
  id VARCHAR(100) PRIMARY KEY,
  image_name VARCHAR(500) NOT NULL,
  scanned_at TIMESTAMP DEFAULT NOW(),
  scanner_version VARCHAR(100),
  vulnerabilities JSONB DEFAULT '[]',
  summary JSONB DEFAULT '{}',
  passed BOOLEAN DEFAULT false,
  tenant_id VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_trivy_image ON security_trivy_scans(image_name);

CREATE TABLE IF NOT EXISTS security_cosign_signatures (
  id VARCHAR(100) PRIMARY KEY,
  image_name VARCHAR(500) NOT NULL,
  digest VARCHAR(200),
  signed_at TIMESTAMP DEFAULT NOW(),
  key_id VARCHAR(200),
  verified BOOLEAN DEFAULT false,
  tenant_id VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_cosign_image ON security_cosign_signatures(image_name);

CREATE TABLE IF NOT EXISTS security_sbom_documents (
  id VARCHAR(100) PRIMARY KEY,
  image_name VARCHAR(500) NOT NULL,
  format VARCHAR(50) NOT NULL DEFAULT 'spdx',
  generated_at TIMESTAMP DEFAULT NOW(),
  components JSONB DEFAULT '[]',
  raw_document TEXT,
  tenant_id VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_sbom_image ON security_sbom_documents(image_name);

CREATE TABLE IF NOT EXISTS compliance_evidence (
  id VARCHAR(100) PRIMARY KEY,
  tenant_id VARCHAR(100) NOT NULL,
  policy_id VARCHAR(100) NOT NULL,
  control_id VARCHAR(100) NOT NULL,
  evidence_type VARCHAR(50) NOT NULL,
  description TEXT,
  source VARCHAR(500),
  collected_at TIMESTAMP DEFAULT NOW(),
  status VARCHAR(50) DEFAULT 'collected',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compliance_evidence_policy ON compliance_evidence(policy_id);
CREATE INDEX IF NOT EXISTS idx_compliance_evidence_tenant ON compliance_evidence(tenant_id);

-- ==================== Hook Chain ====================

CREATE TABLE IF NOT EXISTS hook_chain_definitions (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  hooks JSONB NOT NULL DEFAULT '[]',
  execution_mode VARCHAR(50) DEFAULT 'sequential',
  stop_on_failure BOOLEAN DEFAULT true,
  input_transform VARCHAR(200),
  output_transform VARCHAR(200),
  tenant_id VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hook_chain_executions (
  id VARCHAR(100) PRIMARY KEY,
  chain_id VARCHAR(100) NOT NULL,
  execution_id VARCHAR(200) NOT NULL,
  trigger_source VARCHAR(200),
  success BOOLEAN NOT NULL DEFAULT false,
  hook_results JSONB DEFAULT '[]',
  total_duration_ms INTEGER,
  final_output JSONB,
  error TEXT,
  executed_at TIMESTAMP DEFAULT NOW(),
  tenant_id VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hook_chain_exec_chain ON hook_chain_executions(chain_id);
CREATE INDEX IF NOT EXISTS idx_hook_chain_exec_tenant ON hook_chain_executions(tenant_id);

-- ==================== Integration ====================

CREATE TABLE IF NOT EXISTS integration_configs (
  id VARCHAR(100) PRIMARY KEY,
  tenant_id VARCHAR(100) NOT NULL,
  provider VARCHAR(100) NOT NULL,
  name VARCHAR(200) NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  status VARCHAR(50) DEFAULT 'active',
  last_sync_at TIMESTAMP,
  sync_status VARCHAR(100),
  error_message TEXT,
  created_by VARCHAR(200),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_integration_configs_tenant ON integration_configs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_integration_configs_provider ON integration_configs(provider);

CREATE TABLE IF NOT EXISTS integration_mappings (
  id VARCHAR(100) PRIMARY KEY,
  integration_id VARCHAR(100) NOT NULL,
  resource_type VARCHAR(100) NOT NULL,
  resource_id VARCHAR(200),
  external_id VARCHAR(200),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_integration_mappings_integration ON integration_mappings(integration_id);

-- ==================== FinOps ====================

CREATE TABLE IF NOT EXISTS budget_spend_records (
  id VARCHAR(100) PRIMARY KEY,
  entity_type VARCHAR(100) NOT NULL,
  entity_id VARCHAR(100) NOT NULL,
  amount NUMERIC(15,4) NOT NULL DEFAULT 0,
  recorded_at TIMESTAMP DEFAULT NOW(),
  window_start TIMESTAMP,
  window_end TIMESTAMP,
  tenant_id VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_budget_spend_entity ON budget_spend_records(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_budget_spend_tenant ON budget_spend_records(tenant_id);

CREATE TABLE IF NOT EXISTS saas_cost_subscriptions (
  id VARCHAR(100) PRIMARY KEY,
  tool VARCHAR(200) NOT NULL,
  subscription VARCHAR(200),
  seats INTEGER DEFAULT 0,
  unit_cost NUMERIC(15,4) DEFAULT 0,
  total_cost NUMERIC(15,4) DEFAULT 0,
  billing_cycle VARCHAR(50),
  start_date TIMESTAMP,
  end_date TIMESTAMP,
  status VARCHAR(50) DEFAULT 'active',
  notes TEXT,
  tenant_id VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saas_cost_tenant ON saas_cost_subscriptions(tenant_id);

-- ==================== Degradation / Auto-Recovery ====================

CREATE TABLE IF NOT EXISTS auto_recovery_records (
  id VARCHAR(100) PRIMARY KEY,
  provider_id VARCHAR(200) NOT NULL,
  attempted_at TIMESTAMP DEFAULT NOW(),
  success BOOLEAN DEFAULT false,
  success_rate NUMERIC(5,4),
  degraded_at TIMESTAMP,
  recovered_at TIMESTAMP,
  tenant_id VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auto_recovery_provider ON auto_recovery_records(provider_id);

-- ==================== Test Generation ====================

CREATE TABLE IF NOT EXISTS test_generation_history (
  id VARCHAR(100) PRIMARY KEY,
  source_file VARCHAR(500),
  test_framework VARCHAR(100),
  generated_count INTEGER DEFAULT 0,
  status VARCHAR(50) DEFAULT 'completed',
  result JSONB DEFAULT '{}',
  tenant_id VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS test_templates (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  language VARCHAR(50),
  framework VARCHAR(100),
  template_content TEXT,
  description TEXT,
  tags JSONB DEFAULT '[]',
  tenant_id VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ==================== Message Queue ====================

CREATE TABLE IF NOT EXISTS dead_letter_messages (
  id VARCHAR(100) PRIMARY KEY,
  original_queue_id VARCHAR(100),
  queue_name VARCHAR(200) NOT NULL,
  task_id VARCHAR(100),
  payload JSONB NOT NULL DEFAULT '{}',
  retry_count INTEGER DEFAULT 0,
  last_error TEXT,
  dead_reason VARCHAR(50),
  dead_at TIMESTAMP DEFAULT NOW(),
  replay_status VARCHAR(50),
  tenant_id VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dead_letter_queue ON dead_letter_messages(queue_name);

CREATE TABLE IF NOT EXISTS consumer_registry (
  consumer_id VARCHAR(200) PRIMARY KEY,
  group_name VARCHAR(200) NOT NULL,
  queue_name VARCHAR(200) NOT NULL,
  last_heartbeat TIMESTAMP DEFAULT NOW(),
  messages_processed INTEGER DEFAULT 0,
  status VARCHAR(50) DEFAULT 'active',
  tenant_id VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consumer_registry_queue ON consumer_registry(queue_name);

-- ==================== Privacy ====================

CREATE TABLE IF NOT EXISTS tenant_privacy_policies (
  id VARCHAR(100) PRIMARY KEY,
  tenant_id INTEGER NOT NULL UNIQUE,
  data_retention_days INTEGER DEFAULT 90,
  anonymize_pii BOOLEAN DEFAULT true,
  allowed_regions JSONB DEFAULT '[]',
  encryption_at_rest BOOLEAN DEFAULT true,
  audit_logging BOOLEAN DEFAULT true,
  policy_document TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_privacy_policy_tenant ON tenant_privacy_policies(tenant_id);

-- ==================== Deploy / Release Notes ====================

CREATE TABLE IF NOT EXISTS release_notes (
  id VARCHAR(100) PRIMARY KEY,
  deployment_id VARCHAR(100),
  version VARCHAR(200),
  content TEXT,
  generated_by VARCHAR(100) DEFAULT 'ai',
  status VARCHAR(50) DEFAULT 'draft',
  tenant_id VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_release_notes_deployment ON release_notes(deployment_id);

-- ==================== Risk Assessment ====================

CREATE TABLE IF NOT EXISTS risk_assessment_records (
  id VARCHAR(100) PRIMARY KEY,
  assessment_type VARCHAR(100),
  target VARCHAR(200),
  risk_score NUMERIC(5,2),
  risk_level VARCHAR(50),
  factors JSONB DEFAULT '{}',
  recommendations JSONB DEFAULT '[]',
  status VARCHAR(50) DEFAULT 'completed',
  tenant_id VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_risk_assessment_tenant ON risk_assessment_records(tenant_id);

-- ==================== Auth / JWT Keys ====================

CREATE TABLE IF NOT EXISTS jwt_signing_keys (
  id VARCHAR(100) PRIMARY KEY,
  key_data TEXT NOT NULL,
  algorithm VARCHAR(50) DEFAULT 'RS256',
  status VARCHAR(50) DEFAULT 'active',
  activated_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  tenant_id VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);
