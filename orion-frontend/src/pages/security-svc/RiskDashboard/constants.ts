/**
 * RiskDashboard constants
 * 抽取自 index.tsx (P2-9 Phase 143)
 */
export const RISK_LEVEL_COLOR: Record<string, string> = {
  low: 'green',
  medium: 'blue',
  high: 'orange',
  critical: 'red',
};

export const RISK_LEVEL_TO_SEVERITY: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export const DAY_LABELS: string[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const SEVERITY_LABELS: string[] = ['Low', 'Medium', 'High', 'Critical'];
