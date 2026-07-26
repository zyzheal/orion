-- Migration 001: FinOps Service Core Tables
-- Creates all core tables for cloud resources, K8s costs, SaaS subscriptions, budgets, optimizations, and cost events
-- Version: 1.0.0

-- ==================== Cloud Resources ====================
CREATE TABLE IF NOT EXISTS cloud_resources (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider          VARCHAR(50) NOT NULL,
  resource_type     VARCHAR(50) NOT NULL,
  resource_id       VARCHAR(255) NOT NULL,
  resource_name     VARCHAR(255),
  region            VARCHAR(100) NOT NULL,
  cost              DECIMAL(20, 4) NOT NULL,
  currency          VARCHAR(10) NOT NULL DEFAULT 'USD',
  tags              JSONB NOT NULL DEFAULT '{}',
  timestamp         TIMESTAMPTZ NOT NULL DEFAULT now(),
  tenant_id         UUID,
  environment       VARCHAR(50),
  billing_period    VARCHAR(20),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cloud_resources_tenant ON cloud_resources(tenant_id);
CREATE INDEX idx_cloud_resources_provider ON cloud_resources(provider);
CREATE INDEX idx_cloud_resources_type ON cloud_resources(resource_type);
CREATE INDEX idx_cloud_resources_timestamp ON cloud_resources(timestamp);
CREATE INDEX idx_cloud_resources_resource_id ON cloud_resources(resource_id);

-- ==================== K8s Costs ====================
CREATE TABLE IF NOT EXISTS k8s_costs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  namespace       VARCHAR(255) NOT NULL,
  deployment      VARCHAR(255) NOT NULL,
  pod_name        VARCHAR(255),
  cpu_cost        DECIMAL(20, 4) NOT NULL DEFAULT 0,
  memory_cost     DECIMAL(20, 4) NOT NULL DEFAULT 0,
  storage_cost    DECIMAL(20, 4) NOT NULL DEFAULT 0,
  network_cost    DECIMAL(20, 4) NOT NULL DEFAULT 0,
  total_cost      DECIMAL(20, 4) NOT NULL DEFAULT 0,
  tenant_id       UUID,
  timestamp       TIMESTAMPTZ NOT NULL DEFAULT now(),
  cluster_name    VARCHAR(255),
  node_name       VARCHAR(255),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_k8s_costs_tenant ON k8s_costs(tenant_id);
CREATE INDEX idx_k8s_costs_namespace ON k8s_costs(namespace);
CREATE INDEX idx_k8s_costs_deployment ON k8s_costs(deployment);
CREATE INDEX idx_k8s_costs_timestamp ON k8s_costs(timestamp);

-- ==================== SaaS Costs ====================
CREATE TABLE IF NOT EXISTS saas_costs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool            VARCHAR(255) NOT NULL,
  subscription    VARCHAR(255) NOT NULL,
  seats           INTEGER NOT NULL DEFAULT 1,
  unit_cost       DECIMAL(20, 4) NOT NULL,
  total_cost      DECIMAL(20, 4) NOT NULL,
  billing_cycle   VARCHAR(20) NOT NULL,
  start_date      TIMESTAMPTZ NOT NULL,
  end_date        TIMESTAMPTZ NOT NULL,
  tenant_id       UUID,
  status          VARCHAR(20) NOT NULL DEFAULT 'active',
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_saas_costs_tenant ON saas_costs(tenant_id);
CREATE INDEX idx_saas_costs_tool ON saas_costs(tool);
CREATE INDEX idx_saas_costs_status ON saas_costs(status);

-- ==================== Budget Alerts ====================
CREATE TABLE IF NOT EXISTS budget_alerts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID,
  environment       VARCHAR(50),
  budget_amount     DECIMAL(20, 4) NOT NULL,
  threshold_percent INTEGER NOT NULL CHECK (threshold_percent >= 0 AND threshold_percent <= 100),
  current_spend     DECIMAL(20, 4) NOT NULL DEFAULT 0,
  currency          VARCHAR(10) NOT NULL DEFAULT 'USD',
  period            VARCHAR(20) NOT NULL DEFAULT 'monthly',
  triggered         BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_budget_alerts_tenant ON budget_alerts(tenant_id);
CREATE INDEX idx_budget_alerts_triggered ON budget_alerts(triggered);

-- ==================== Cost Budgets ====================
CREATE TABLE IF NOT EXISTS cost_budgets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type     VARCHAR(20) NOT NULL,
  entity_id       VARCHAR(255) NOT NULL,
  amount          DECIMAL(20, 4) NOT NULL,
  period          VARCHAR(20) NOT NULL,
  currency        VARCHAR(10) NOT NULL DEFAULT 'USD',
  alerts          JSONB NOT NULL DEFAULT '[]',
  environment     VARCHAR(50),
  description     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cost_budgets_entity ON cost_budgets(entity_type, entity_id);
CREATE INDEX idx_cost_budgets_period ON cost_budgets(period);

-- ==================== Budget Alert Triggers ====================
CREATE TABLE IF NOT EXISTS budget_alert_triggers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id       UUID NOT NULL REFERENCES cost_budgets(id),
  threshold       INTEGER NOT NULL,
  actual          DECIMAL(20, 4) NOT NULL,
  percentage      INTEGER NOT NULL,
  triggered_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  entity_type     VARCHAR(20) NOT NULL,
  entity_id       VARCHAR(255) NOT NULL
);

CREATE INDEX idx_budget_alert_triggers_budget ON budget_alert_triggers(budget_id);
CREATE INDEX idx_budget_alert_triggers_entity ON budget_alert_triggers(entity_type, entity_id);
CREATE INDEX idx_budget_alert_triggers_time ON budget_alert_triggers(triggered_at);

-- ==================== ROI Analyses ====================
CREATE TABLE IF NOT EXISTS roi_analyses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investment_type VARCHAR(50) NOT NULL,
  name            VARCHAR(255) NOT NULL,
  cost            DECIMAL(20, 4) NOT NULL,
  savings         DECIMAL(20, 4) NOT NULL DEFAULT 0,
  period          VARCHAR(20) NOT NULL,
  roi_percentage  DECIMAL(10, 2) NOT NULL DEFAULT 0,
  payback_months  INTEGER,
  analyzed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  description     TEXT,
  details         JSONB DEFAULT '{}'
);

CREATE INDEX idx_roi_analyses_type ON roi_analyses(investment_type);
CREATE INDEX idx_roi_analyses_analyzed ON roi_analyses(analyzed_at);

-- ==================== Cost Comparisons ====================
CREATE TABLE IF NOT EXISTS cost_comparisons (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  description     TEXT NOT NULL,
  before_cost     DECIMAL(20, 4) NOT NULL,
  after_cost      DECIMAL(20, 4) NOT NULL,
  savings         DECIMAL(20, 4) NOT NULL DEFAULT 0,
  savings_percent DECIMAL(10, 2) NOT NULL DEFAULT 0,
  time_savings_hours DECIMAL(10, 2),
  period          VARCHAR(20) NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cost_comparisons_period ON cost_comparisons(period);

-- ==================== Cost Optimizations ====================
CREATE TABLE IF NOT EXISTS cost_optimizations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category          VARCHAR(50) NOT NULL,
  description       TEXT NOT NULL,
  estimated_savings DECIMAL(20, 4) NOT NULL DEFAULT 0,
  effort            DECIMAL(5, 1) NOT NULL DEFAULT 0,
  priority          VARCHAR(20) NOT NULL DEFAULT 'medium',
  status            VARCHAR(20) NOT NULL DEFAULT 'identified',
  resource_ids      JSONB DEFAULT '[]',
  entity_id         VARCHAR(255),
  entity_type       VARCHAR(20),
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cost_optimizations_category ON cost_optimizations(category);
CREATE INDEX idx_cost_optimizations_priority ON cost_optimizations(priority);
CREATE INDEX idx_cost_optimizations_status ON cost_optimizations(status);

-- ==================== Resource Utilizations ====================
CREATE TABLE IF NOT EXISTS resource_utilizations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id       VARCHAR(255) NOT NULL,
  resource_type     VARCHAR(50) NOT NULL,
  resource_name     VARCHAR(255) NOT NULL,
  cpu_utilization   DECIMAL(5, 2) NOT NULL,
  memory_utilization DECIMAL(5, 2) NOT NULL,
  storage_utilization DECIMAL(5, 2) NOT NULL,
  monthly_cost      DECIMAL(20, 4) NOT NULL DEFAULT 0,
  tenant_id         UUID,
  environment       VARCHAR(50),
  recorded_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_resource_utilizations_tenant ON resource_utilizations(tenant_id);
CREATE INDEX idx_resource_utilizations_resource ON resource_utilizations(resource_id);
CREATE INDEX idx_resource_utilizations_recorded ON resource_utilizations(recorded_at);

-- ==================== Right-Sizing Recommendations ====================
CREATE TABLE IF NOT EXISTS right_sizing_recommendations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id       VARCHAR(255) NOT NULL,
  resource_type     VARCHAR(50) NOT NULL,
  current_spec      JSONB NOT NULL DEFAULT '{}',
  recommended_spec  JSONB NOT NULL DEFAULT '{}',
  current_cost      DECIMAL(20, 4) NOT NULL,
  estimated_cost    DECIMAL(20, 4) NOT NULL,
  estimated_savings DECIMAL(20, 4) NOT NULL DEFAULT 0,
  reason            TEXT,
  tenant_id         UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_right_sizing_tenant ON right_sizing_recommendations(tenant_id);
CREATE INDEX idx_right_sizing_resource ON right_sizing_recommendations(resource_id);

-- ==================== Cost Events ====================
CREATE TABLE IF NOT EXISTS cost_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type            VARCHAR(50) NOT NULL,
  source          VARCHAR(255) NOT NULL,
  data            JSONB NOT NULL,
  timestamp       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cost_events_type ON cost_events(type);
CREATE INDEX idx_cost_events_timestamp ON cost_events(timestamp);

-- ==================== Cost Collection Schedules ====================
CREATE TABLE IF NOT EXISTS cost_collection_schedules (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider          VARCHAR(50) NOT NULL,
  cron_expression   VARCHAR(100) NOT NULL,
  enabled           BOOLEAN NOT NULL DEFAULT true,
  last_collected_at TIMESTAMPTZ,
  last_status       VARCHAR(20),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cost_collection_schedules_provider ON cost_collection_schedules(provider);
CREATE INDEX idx_cost_collection_schedules_enabled ON cost_collection_schedules(enabled);

-- ==================== Migration Info ====================
CREATE TABLE IF NOT EXISTS finops_schema_migrations (
  version             VARCHAR(20) PRIMARY KEY,
  applied_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  description         TEXT
);

INSERT INTO finops_schema_migrations (version, description)
VALUES ('001', 'Initial FinOps service tables: cloud_resources, k8s_costs, saas_costs, budget_alerts, cost_budgets, roi_analyses, cost_optimizations, resource_utilizations');
