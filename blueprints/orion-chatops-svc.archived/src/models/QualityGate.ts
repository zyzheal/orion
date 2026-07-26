/** QualityGate model */

export interface QualityGateRule {
  metric: string;
  operator: string;
  threshold: number;
  severity: 'warn' | 'block';
}

export interface QualityGateExternalProvider {
  name: string;
  config: Record<string, any>;
}

export interface QualityGate {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  rules: QualityGateRule[];
  externalProvider?: QualityGateExternalProvider;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface QualityGateCreateInput {
  tenantId: string;
  name: string;
  description?: string;
  rules: QualityGateRule[];
  externalProvider?: QualityGateExternalProvider;
  enabled?: boolean;
}

export interface QualityGateUpdateInput {
  name?: string;
  description?: string;
  rules?: QualityGateRule[];
  externalProvider?: QualityGateExternalProvider;
  enabled?: boolean;
}

export interface QualityGateResult {
  id: string;
  gateId: string;
  gateName: string;
  runId: string;
  stageName: string;
  metrics: Record<string, number>;
  passed: boolean;
  blockedRules: Array<{
    rule: { metric: string; operator: string; threshold: number; severity: string };
    actualValue: number;
    reason: string;
  }>;
  warnedRules: Array<{
    rule: { metric: string; operator: string; threshold: number; severity: string };
    actualValue: number;
    reason: string;
  }>;
  evaluatedAt: Date;
}
