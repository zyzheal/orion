/**
 * OPA Policy Engine 数据模型
 */

import { v4 as uuidv4 } from 'uuid';

// ==================== PolicyDefinition ====================

export type PolicyCategory = 'security' | 'cost' | 'quality' | 'governance';
export type PolicySeverity = 'block' | 'warning' | 'info';

export interface PolicyDefinition {
  id: string;
  name: string;
  description?: string;
  category: PolicyCategory;
  regoPath: string;
  gateId?: string;
  severity: PolicySeverity;
  enabled: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface PolicyDefinitionCreateInput {
  name: string;
  description?: string;
  category: PolicyCategory;
  regoPath: string;
  gateId?: string;
  severity?: PolicySeverity;
  metadata?: Record<string, unknown>;
}

export interface PolicyDefinitionUpdateInput {
  description?: string;
  category?: PolicyCategory;
  regoPath?: string;
  gateId?: string;
  severity?: PolicySeverity;
  enabled?: boolean;
  metadata?: Record<string, unknown>;
}

export function createPolicyDefinition(input: PolicyDefinitionCreateInput): PolicyDefinition {
  const now = new Date();
  return {
    id: uuidv4(),
    name: input.name,
    description: input.description,
    category: input.category,
    regoPath: input.regoPath,
    gateId: input.gateId,
    severity: input.severity ?? 'warning',
    enabled: true,
    metadata: input.metadata ?? {},
    createdAt: now,
    updatedAt: now,
  };
}

// ==================== PolicyBundle ====================

export type PolicyBundleStatus = 'active' | 'deprecated' | 'failed';

export interface PolicyBundle {
  id: string;
  bundleName: string;
  gitRef: string;
  regoContent: Record<string, string>;
  testResults?: Record<string, unknown>;
  deployedAt: Date;
  deployedBy?: string;
  status: PolicyBundleStatus;
}

export interface PolicyBundleCreateInput {
  bundleName: string;
  gitRef: string;
  regoContent: Record<string, string>;
  deployedBy?: string;
  testResults?: Record<string, unknown>;
}

export function createPolicyBundle(input: PolicyBundleCreateInput): PolicyBundle {
  const now = new Date();
  return {
    id: uuidv4(),
    bundleName: input.bundleName,
    gitRef: input.gitRef,
    regoContent: input.regoContent,
    testResults: input.testResults,
    deployedAt: now,
    deployedBy: input.deployedBy,
    status: 'active',
  };
}

// ==================== PolicyEvaluation ====================

export interface PolicyEvaluation {
  id: string;
  policyId?: string;
  runId: string;
  inputContext: Record<string, unknown>;
  result: Record<string, unknown>;
  evaluatedAt: Date;
  evaluationMs?: number;
}

export interface PolicyEvaluationCreateInput {
  policyId?: string;
  runId: string;
  inputContext: Record<string, unknown>;
  result: Record<string, unknown>;
  evaluationMs?: number;
}

export function createPolicyEvaluation(input: PolicyEvaluationCreateInput): PolicyEvaluation {
  const now = new Date();
  return {
    id: uuidv4(),
    policyId: input.policyId,
    runId: input.runId,
    inputContext: input.inputContext,
    result: input.result,
    evaluatedAt: now,
    evaluationMs: input.evaluationMs,
  };
}

// ==================== PolicyViolation ====================

export type ViolationStatus = 'open' | 'waived' | 'resolved';
export type ViolationResourceType = 'pipeline' | 'deployment' | 'image' | 'config';

export interface PolicyViolation {
  id: string;
  evaluationId?: string;
  policyId?: string;
  severity: PolicySeverity;
  message: string;
  resourceType?: ViolationResourceType;
  resourceId?: string;
  status: ViolationStatus;
  createdAt: Date;
}

export interface PolicyViolationCreateInput {
  evaluationId?: string;
  policyId?: string;
  severity: PolicySeverity;
  message: string;
  resourceType?: ViolationResourceType;
  resourceId?: string;
}

export function createPolicyViolation(input: PolicyViolationCreateInput): PolicyViolation {
  const now = new Date();
  return {
    id: uuidv4(),
    evaluationId: input.evaluationId,
    policyId: input.policyId,
    severity: input.severity,
    message: input.message,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    status: 'open',
    createdAt: now,
  };
}

// ==================== PolicyOverride ====================

export type OverrideScope = 'global' | 'project' | 'environment';

export interface PolicyOverride {
  id: string;
  policyId?: string;
  violationId?: string;
  reason: string;
  approvedBy?: string;
  approvedAt: Date;
  expiresAt: Date;
  scope: OverrideScope;
}

export interface PolicyOverrideCreateInput {
  policyId?: string;
  violationId?: string;
  reason: string;
  approvedBy?: string;
  expiresAt: Date;
  scope?: OverrideScope;
}

export function createPolicyOverride(input: PolicyOverrideCreateInput): PolicyOverride {
  const now = new Date();
  return {
    id: uuidv4(),
    policyId: input.policyId,
    violationId: input.violationId,
    reason: input.reason,
    approvedBy: input.approvedBy,
    approvedAt: now,
    expiresAt: input.expiresAt,
    scope: input.scope ?? 'global',
  };
}
