export type QualityMetric = 'coverage' | 'complexity' | 'duplication' | 'security_hotspots' | 'bugs' | 'vulnerabilities' | string;
export type QualityOperator = '<' | '<=' | '>' | '>=' | '==' | string;

export interface QualityGateRule {
  metric: QualityMetric;
  operator: QualityOperator;
  threshold: number;
  severity: 'block' | 'warn';
  [key: string]: unknown;
}

export interface QualityGate {
  id: string;
  name: string;
  rules: QualityGateRule[];
  enabled?: boolean;
  tenantId?: string;
}

export interface QualityGateResult {
  id: string;
  gateId: string;
  gateName: string;
  runId: string;
  stageName: string;
  metrics: Record<string, number>;
  passed: boolean;
  blockedRules: Array<{ rule: QualityGateRule; actualValue: number; reason: string }>;
  warnedRules: Array<{ rule: QualityGateRule; actualValue: number; reason: string }>;
  evaluatedAt: Date;
  [key: string]: unknown;
}

export interface QualityGateCreateInput {
  name: string;
  rules: QualityGateRule[];
  enabled?: boolean;
  tenantId?: string;
  [key: string]: unknown;
}

export interface QualityGateUpdateInput {
  name?: string;
  rules?: QualityGateRule[];
  enabled?: boolean;
  [key: string]: unknown;
}

export interface QualityGateEvaluateInput {
  gateId: string;
  runId: string;
  stageName: string;
  metrics: Record<string, number>;
  [key: string]: unknown;
}

export interface QualityMetricValue {
  metric: QualityMetric;
  value: number;
  [key: string]: unknown;
}

export interface QualityGateEntity {
  id: string;
  name: string;
  rules: QualityGateRule[];
  enabled: boolean;
  tenant_id?: string;
  created_at?: Date;
  updated_at?: Date;
  [key: string]: unknown;
}

export interface QualityGateResultEntity {
  id: string;
  gate_id: string;
  gate_name: string;
  run_id: string;
  stage_name: string;
  metrics: Record<string, number>;
  passed: boolean;
  blocked_rules: unknown[];
  warned_rules: unknown[];
  evaluated_at: Date;
  created_at?: Date;
  [key: string]: unknown;
}
