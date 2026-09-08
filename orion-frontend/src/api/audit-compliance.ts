/**
 * Audit Compliance Dashboard API (Phase 305)
 *
 * Wraps the /api/v1/audit/compliance/{dashboard|risk-map|trend|combined}
 * endpoints introduced in Phase 305. Types match the Go backend models in
 * orion-platform-svc-go/internal/audit/models/models.go.
 */
import { api } from './client';

// ---------------------------------------------------------------------------
// Type mirrors of the backend models (Phase 305 additions).
// ---------------------------------------------------------------------------

export interface FrameworkScore {
  framework: string;
  score: number;
  rating: 'compliant' | 'partial' | 'non-compliant';
  totalControls: number;
  passedControls: number;
  failedControls: number;
}

export interface ComplianceDashboardOverview {
  frameworkScores: FrameworkScore[];
  overallScore: number;
  overallRating: 'compliant' | 'partial' | 'non-compliant';
  totalControls: number;
  totalPassed: number;
  totalFailed: number;
  assessedAt: string;
}

export interface FrameworkRiskRow {
  framework: string;
  low: number;
  medium: number;
  high: number;
  critical: number;
  totalFindings: number;
  score: number;
}

export interface ComplianceRiskMatrix {
  frameworkRows: FrameworkRiskRow[];
  severityBuckets: Array<'low' | 'medium' | 'high' | 'critical'>;
  totalFindings: number;
  assessedAt: string;
}

export interface TrendPoint {
  date: string; // YYYY-MM-DD
  score: number;
  rating: 'compliant' | 'partial' | 'non-compliant';
  totalControls: number;
  passedControls: number;
}

export interface ComplianceScoreTrend {
  days: number;
  overall: TrendPoint[];
  perFramework: Record<string, TrendPoint[]>;
  assessedAt: string;
}

// Reuse the shared ComplianceReport type from compliance.ts.
export type { ComplianceReport } from './compliance';

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

/** GET /audit/compliance/dashboard — per-framework score roll-up. */
export function getComplianceDashboard() {
  return api.get<ComplianceDashboardOverview>('/audit/compliance/dashboard');
}

/** GET /audit/compliance/combined — full COMBINED compliance report. */
export function getComplianceCombined() {
  // The backend returns the report body directly (no envelope).
  return api.get<unknown>('/audit/compliance/combined');
}

/** GET /audit/compliance/risk-map — framework × severity heatmap. */
export function getComplianceRiskMap() {
  return api.get<ComplianceRiskMatrix>('/audit/compliance/risk-map');
}

/**
 * GET /audit/compliance/trend — per-day score history.
 * days is clamped to [1, 90] by the backend; defaults to 30.
 */
export function getComplianceTrend(days = 30) {
  return api.get<ComplianceScoreTrend>('/audit/compliance/trend', {
    params: { days },
  });
}

/**
 * Convenience loader that runs the 4 dashboard endpoints in parallel.
 * Returns `{ dashboard, riskMap, trend }`. Used by useAuditComplianceState.
 */
export async function loadComplianceDashboardBundle(days = 30) {
  const [dashboard, riskMap, trend] = await Promise.all([
    getComplianceDashboard().then((r) => r.data as ComplianceDashboardOverview),
    getComplianceRiskMap().then((r) => r.data as ComplianceRiskMatrix),
    getComplianceTrend(days).then((r) => r.data as ComplianceScoreTrend),
  ]);
  return { dashboard, riskMap, trend };
}
