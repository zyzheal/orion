-- Migration 001: FinOps Service Core Tables
-- Creates all core tables for cost tracking, budgets, ROI analysis, and optimizations
-- Version: 1.0.0
-- tenant_id convention: UUID NOT NULL per docs/standards/database-conventions.md

-- ==================== Reports ====================
CREATE TABLE IF NOT EXISTS finops_reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  period          VARCHAR(20) NOT NULL,
  total_cost      DECIMAL(12, 2) NOT NULL DEFAULT 0,
  breakdown       JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_finops_reports_tenant ON finops_reports(tenant_id);
CREATE INDEX idx_finops_reports_period ON finops_reports(period);

-- ==================== Resource Costs ====================
CREATE TABLE IF NOT EXISTS resource_costs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  resource_id     VARCHAR(255) NOT NULL,
  service         VARCHAR(100) NOT NULL,
  cost            DECIMAL(12, 4) NOT NULL DEFAULT 0,
  date            DATE NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_resource_costs_tenant ON resource_costs(tenant_id);
CREATE INDEX idx_resource_costs_date ON resource_costs(date);
CREATE INDEX idx_resource_costs_service ON resource_costs(service);

-- ==================== Cost Records ====================
CREATE TABLE IF NOT EXISTS finops_cost_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  entity_type     VARCHAR(50) NOT NULL,
  entity_id       VARCHAR(255) NOT NULL,
  amount          DECIMAL(12, 2) NOT NULL DEFAULT 0,
  category        VARCHAR(100) NOT NULL,
  environment     VARCHAR(100),
  tags            JSONB,
  currency        VARCHAR(10) NOT NULL DEFAULT 'USD',
  timestamp       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_finops_cost_records_tenant ON finops_cost_records(tenant_id);
CREATE INDEX idx_finops_cost_records_entity ON finops_cost_records(entity_type, entity_id);
CREATE INDEX idx_finops_cost_records_timestamp ON finops_cost_records(timestamp);
CREATE INDEX idx_finops_cost_records_category ON finops_cost_records(category);

-- ==================== Budgets ====================
CREATE TABLE IF NOT EXISTS finops_budgets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  entity_type     VARCHAR(50) NOT NULL,
  entity_id       VARCHAR(255) NOT NULL,
  amount          DECIMAL(12, 2) NOT NULL,
  period          VARCHAR(20) NOT NULL,
  currency        VARCHAR(10) NOT NULL DEFAULT 'USD',
  alerts          JSONB NOT NULL DEFAULT '[]',
  environment     VARCHAR(100),
  description     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_finops_budgets_tenant ON finops_budgets(tenant_id);
CREATE INDEX idx_finops_budgets_entity ON finops_budgets(entity_type, entity_id);
CREATE INDEX idx_finops_budgets_period ON finops_budgets(period);

-- ==================== Spend Tracking ====================
CREATE TABLE IF NOT EXISTS finops_spend_tracking (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  entity_type     VARCHAR(50) NOT NULL,
  entity_id       VARCHAR(255) NOT NULL,
  amount          DECIMAL(12, 2) NOT NULL DEFAULT 0,
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_finops_spend_tracking_tenant ON finops_spend_tracking(tenant_id);
CREATE INDEX idx_finops_spend_tracking_entity ON finops_spend_tracking(entity_type, entity_id);
CREATE INDEX idx_finops_spend_tracking_date ON finops_spend_tracking(recorded_at);

-- ==================== Alert Triggers ====================
CREATE TABLE IF NOT EXISTS finops_alert_triggers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  budget_id       UUID NOT NULL,
  threshold       DECIMAL(5, 2) NOT NULL,
  actual          DECIMAL(5, 2) NOT NULL,
  percentage      DECIMAL(5, 2) NOT NULL,
  entity_type     VARCHAR(50) NOT NULL,
  entity_id       VARCHAR(255) NOT NULL,
  triggered_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_finops_alert_triggers_tenant ON finops_alert_triggers(tenant_id);
CREATE INDEX idx_finops_alert_triggers_budget ON finops_alert_triggers(budget_id);
CREATE INDEX idx_finops_alert_triggers_entity ON finops_alert_triggers(entity_type, entity_id);
CREATE INDEX idx_finops_alert_triggers_date ON finops_alert_triggers(triggered_at);

-- ==================== ROI Analyses ====================
CREATE TABLE IF NOT EXISTS finops_roi_analyses (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL,
  investment_type     VARCHAR(100) NOT NULL,
  name                VARCHAR(255) NOT NULL,
  cost                DECIMAL(12, 2) NOT NULL DEFAULT 0,
  savings             DECIMAL(12, 2) NOT NULL DEFAULT 0,
  period              VARCHAR(20) NOT NULL,
  roi_percentage      DECIMAL(8, 2) NOT NULL DEFAULT 0,
  payback_months      INTEGER NOT NULL DEFAULT 0,
  description         TEXT,
  details             JSONB,
  analyzed_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_finops_roi_analyses_tenant ON finops_roi_analyses(tenant_id);
CREATE INDEX idx_finops_roi_analyses_type ON finops_roi_analyses(investment_type);
CREATE INDEX idx_finops_roi_analyses_date ON finops_roi_analyses(analyzed_at);

-- ==================== Cost Comparisons ====================
CREATE TABLE IF NOT EXISTS finops_cost_comparisons (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL,
  description         TEXT NOT NULL,
  before_cost         DECIMAL(12, 2) NOT NULL DEFAULT 0,
  after_cost          DECIMAL(12, 2) NOT NULL DEFAULT 0,
  savings             DECIMAL(12, 2) NOT NULL DEFAULT 0,
  savings_percent     DECIMAL(5, 2) NOT NULL DEFAULT 0,
  time_savings_hours  DECIMAL(8, 2),
  period              VARCHAR(20) NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_finops_cost_comparisons_tenant ON finops_cost_comparisons(tenant_id);
CREATE INDEX idx_finops_cost_comparisons_period ON finops_cost_comparisons(period);

-- ==================== Cost Optimizations ====================
CREATE TABLE IF NOT EXISTS finops_optimizations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL,
  category            VARCHAR(50) NOT NULL,
  description         TEXT NOT NULL,
  estimated_savings   DECIMAL(12, 2) NOT NULL DEFAULT 0,
  effort              INTEGER NOT NULL DEFAULT 1,
  priority            VARCHAR(20) NOT NULL DEFAULT 'medium',
  status              VARCHAR(20) NOT NULL DEFAULT 'pending',
  resource_ids        JSONB,
  entity_id           VARCHAR(255),
  entity_type         VARCHAR(50),
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_finops_optimizations_tenant ON finops_optimizations(tenant_id);
CREATE INDEX idx_finops_optimizations_category ON finops_optimizations(category);
CREATE INDEX idx_finops_optimizations_priority ON finops_optimizations(priority);
CREATE INDEX idx_finops_optimizations_status ON finops_optimizations(status);
CREATE INDEX idx_finops_optimizations_entity ON finops_optimizations(entity_type, entity_id);

-- ==================== Cloud Costs ====================
CREATE TABLE IF NOT EXISTS finops_cloud_costs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider        VARCHAR(50) NOT NULL,
  resource_type   VARCHAR(50) NOT NULL,
  resource_id     VARCHAR(255) NOT NULL,
  resource_name   VARCHAR(255),
  region          VARCHAR(50) NOT NULL,
  cost            DECIMAL(12, 4) NOT NULL DEFAULT 0,
  currency        VARCHAR(10) NOT NULL DEFAULT 'USD',
  tags            JSONB,
  timestamp       TIMESTAMPTZ NOT NULL DEFAULT now(),
  tenant_id       UUID NOT NULL,
  environment     VARCHAR(100),
  billing_period  VARCHAR(20),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_finops_cloud_costs_provider ON finops_cloud_costs(provider);
CREATE INDEX idx_finops_cloud_costs_resource_type ON finops_cloud_costs(resource_type);
CREATE INDEX idx_finops_cloud_costs_tenant ON finops_cloud_costs(tenant_id);
CREATE INDEX idx_finops_cloud_costs_timestamp ON finops_cloud_costs(timestamp);

-- ==================== K8s Costs ====================
CREATE TABLE IF NOT EXISTS finops_k8s_costs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  namespace       VARCHAR(100) NOT NULL,
  deployment      VARCHAR(255) NOT NULL,
  pod_name        VARCHAR(255),
  cpu_cost        DECIMAL(10, 4) NOT NULL DEFAULT 0,
  memory_cost     DECIMAL(10, 4) NOT NULL DEFAULT 0,
  storage_cost    DECIMAL(10, 4) NOT NULL DEFAULT 0,
  network_cost    DECIMAL(10, 4) NOT NULL DEFAULT 0,
  total_cost      DECIMAL(10, 4) NOT NULL DEFAULT 0,
  tenant_id       UUID NOT NULL,
  timestamp       TIMESTAMPTZ NOT NULL DEFAULT now(),
  cluster_name    VARCHAR(255),
  node_name       VARCHAR(255),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_finops_k8s_costs_namespace ON finops_k8s_costs(namespace);
CREATE INDEX idx_finops_k8s_costs_deployment ON finops_k8s_costs(deployment);
CREATE INDEX idx_finops_k8s_costs_tenant ON finops_k8s_costs(tenant_id);
CREATE INDEX idx_finops_k8s_costs_timestamp ON finops_k8s_costs(timestamp);

-- ==================== SaaS Costs ====================
CREATE TABLE IF NOT EXISTS finops_saas_costs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool            VARCHAR(100) NOT NULL,
  subscription    VARCHAR(255) NOT NULL,
  seats           INTEGER NOT NULL DEFAULT 1,
  unit_cost       DECIMAL(10, 4) NOT NULL DEFAULT 0,
  total_cost      DECIMAL(12, 2) NOT NULL DEFAULT 0,
  billing_cycle   VARCHAR(20) NOT NULL,
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  tenant_id       UUID NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'active',
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_finops_saas_costs_tool ON finops_saas_costs(tool);
CREATE INDEX idx_finops_saas_costs_status ON finops_saas_costs(status);
CREATE INDEX idx_finops_saas_costs_tenant ON finops_saas_costs(tenant_id);

-- ==================== Budget Alerts (Legacy) ====================
CREATE TABLE IF NOT EXISTS finops_budget_alerts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL,
  environment         VARCHAR(100),
  budget_amount       DECIMAL(12, 2) NOT NULL,
  threshold_percent   DECIMAL(5, 2) NOT NULL,
  current_spend       DECIMAL(12, 2) NOT NULL DEFAULT 0,
  currency            VARCHAR(10) NOT NULL DEFAULT 'USD',
  period              VARCHAR(20) NOT NULL DEFAULT 'monthly',
  triggered           BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_finops_budget_alerts_tenant ON finops_budget_alerts(tenant_id);
CREATE INDEX idx_finops_budget_alerts_environment ON finops_budget_alerts(environment);
CREATE INDEX idx_finops_budget_alerts_triggered ON finops_budget_alerts(triggered);

-- ==================== Migration Info ====================
CREATE TABLE IF NOT EXISTS finops_schema_migrations (
  version             VARCHAR(20) PRIMARY KEY,
  applied_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  description         TEXT
);

INSERT INTO finops_schema_migrations (version, description) VALUES ('001', 'Initial FinOps tables');
