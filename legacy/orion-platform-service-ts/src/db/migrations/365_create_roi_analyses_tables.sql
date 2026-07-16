-- Migration 365: ROI Analysis & Cost Comparison persistence
-- FinOps repository tables for ROIAnalyzer and FinOpsRepository ROI methods

CREATE TABLE IF NOT EXISTS finops_roi_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  investment_type VARCHAR(50) NOT NULL DEFAULT 'infrastructure',
  name VARCHAR(255) NOT NULL,
  cost DECIMAL(12, 2) NOT NULL,
  savings DECIMAL(12, 2) NOT NULL,
  period VARCHAR(20) NOT NULL DEFAULT 'yearly',
  roi_percentage DECIMAL(8, 2),
  payback_months DECIMAL(8, 2),
  description TEXT,
  details JSONB DEFAULT '{}',
  analyzed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_finops_roi_analyses_tenant ON finops_roi_analyses(tenant_id);
CREATE INDEX idx_finops_roi_analyses_type ON finops_roi_analyses(investment_type);
CREATE INDEX idx_finops_roi_analyses_created ON finops_roi_analyses(created_at DESC);
CREATE INDEX idx_finops_roi_analyses_analyzed ON finops_roi_analyses(analyzed_at DESC);

CREATE TABLE IF NOT EXISTS finops_cost_comparisons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  before_cost DECIMAL(12, 2) NOT NULL,
  after_cost DECIMAL(12, 2) NOT NULL,
  savings DECIMAL(12, 2) NOT NULL,
  savings_percent DECIMAL(8, 2),
  time_savings_hours DECIMAL(10, 2),
  period VARCHAR(20) NOT NULL DEFAULT 'monthly',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_finops_cost_comparisons_tenant ON finops_cost_comparisons(tenant_id);
CREATE INDEX idx_finops_cost_comparisons_period ON finops_cost_comparisons(period);
CREATE INDEX idx_finops_cost_comparisons_created ON finops_cost_comparisons(created_at DESC);

