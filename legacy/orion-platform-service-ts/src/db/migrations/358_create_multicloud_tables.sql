-- Migration 358: Multi-Cloud Advanced Tables
-- Purpose: Persist CrossZoneDR, DRTestResult, CloudNetwork, SchedulingPolicy, SchedulingDecision

CREATE TABLE IF NOT EXISTS multicloud_cross_zone_dr (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  primary_zone VARCHAR(100) NOT NULL,
  secondary_zone VARCHAR(100) NOT NULL,
  strategy VARCHAR(20) NOT NULL DEFAULT 'active-passive',
  rpo INTEGER NOT NULL DEFAULT 300,
  rto INTEGER NOT NULL DEFAULT 600,
  status VARCHAR(20) NOT NULL DEFAULT 'configured',
  last_test_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cross_zone_dr_tenant ON multicloud_cross_zone_dr(tenant_id);

CREATE TABLE IF NOT EXISTS multicloud_dr_test_results (
  id VARCHAR(36) PRIMARY KEY,
  dr_id VARCHAR(36) NOT NULL REFERENCES multicloud_cross_zone_dr(id),
  status VARCHAR(20) NOT NULL,
  duration INTEGER NOT NULL,
  details JSONB NOT NULL DEFAULT '{}',
  tested_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dr_test_results_dr ON multicloud_dr_test_results(dr_id);

CREATE TABLE IF NOT EXISTS multicloud_cloud_networks (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  vpc_id VARCHAR(255) NOT NULL,
  subnets TEXT[] NOT NULL DEFAULT '{}',
  security_groups TEXT[] NOT NULL DEFAULT '{}',
  status VARCHAR(20) NOT NULL DEFAULT 'provisioning',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cloud_networks_tenant ON multicloud_cloud_networks(tenant_id);

CREATE TABLE IF NOT EXISTS multicloud_scheduling_policies (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  strategy VARCHAR(30) NOT NULL DEFAULT 'balanced',
  constraints JSONB NOT NULL DEFAULT '{}',
  priority INTEGER NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_scheduling_policies_tenant ON multicloud_scheduling_policies(tenant_id);

CREATE TABLE IF NOT EXISTS multicloud_scheduling_decisions (
  id VARCHAR(36) PRIMARY KEY,
  policy_id VARCHAR(36) NOT NULL,
  resource_type VARCHAR(100) NOT NULL,
  selected_provider VARCHAR(50) NOT NULL,
  selected_region VARCHAR(100) NOT NULL,
  estimated_cost NUMERIC(15,2) NOT NULL,
  reason TEXT NOT NULL,
  alternatives JSONB NOT NULL DEFAULT '[]',
  decided_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_scheduling_decisions_policy ON multicloud_scheduling_decisions(policy_id);
