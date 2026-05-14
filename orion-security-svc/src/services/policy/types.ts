/**
 * Security Service - Additional type definitions
 */

export interface PolicyDefinition {
  id: string;
  name: string;
  description?: string;
  rego: string;
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PolicyEvaluationResult {
  id: string;
  policyId: string;
  input: Record<string, unknown>;
  passed: boolean;
  violations?: string[];
  evaluatedAt: Date;
}

export interface PolicyViolation {
  id: string;
  policyId: string;
  evaluationId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  resource: Record<string, unknown>;
  resolved: boolean;
  createdAt: Date;
}

export interface PolicyOverride {
  id: string;
  policyId: string;
  reason: string;
  overrideBy: string;
  createdAt: Date;
}
