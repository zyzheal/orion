export type ComplianceStatus = 'compliant' | 'non_compliant' | 'partial' | 'not_evaluated';

export type ComplianceSeverity = 'low' | 'medium' | 'high' | 'critical';

export type RemediationStatus = 'open' | 'in_progress' | 'resolved' | 'accepted_risk' | 'expired';

export type AuditPlanStatus = 'draft' | 'active' | 'completed' | 'archived';

export type FindingStatus = 'open' | 'investigating' | 'resolved' | 'false_positive' | 'accepted';

export interface CompliancePolicy {
  id: string;
  name: string;
  description: string;
  framework: string;
  rules: ComplianceRule[];
  status: ComplianceStatus;
  lastEvaluated: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ComplianceRule {
  id: string;
  policyId: string;
  name: string;
  description: string;
  checkType: string;
  severity: ComplianceSeverity;
  parameters: Record<string, unknown>;
}

export interface ComplianceEvaluation {
  id: string;
  policyId: string;
  resourceId: string;
  status: ComplianceStatus;
  score: number;
  findings: ComplianceFinding[];
  evaluatedAt: Date;
  evaluatedBy: string;
  details: Record<string, unknown>;
}

export interface ComplianceFinding {
  id: string;
  ruleId: string;
  resourceId: string;
  status: ComplianceStatus;
  severity: ComplianceSeverity;
  description: string;
  evidence: string | null;
  remediation: string | null;
  createdAt: Date;
}

export interface ComplianceReport {
  id: string;
  policyId: string;
  title: string;
  status: ComplianceStatus;
  overallScore: number;
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  findings: ComplianceFinding[];
  generatedAt: Date;
  generatedBy: string;
  periodStart: Date;
  periodEnd: Date;
}

export interface ComplianceScore {
  policyId: string;
  policyName: string;
  score: number;
  status: ComplianceStatus;
  lastEvaluated: Date | null;
  totalChecks: number;
  passedChecks: number;
}

export interface Remediation {
  id: string;
  findingId: string;
  description: string;
  status: RemediationStatus;
  assignedTo: string | null;
  dueDate: Date | null;
  resolvedAt: Date | null;
  resolvedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditPlan {
  id: string;
  name: string;
  description: string;
  scope: Record<string, unknown>;
  status: AuditPlanStatus;
  createdBy: string;
  startDate: Date;
  endDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditFinding {
  id: string;
  auditPlanId: string;
  title: string;
  description: string;
  severity: ComplianceSeverity;
  status: FindingStatus;
  resourceId: string | null;
  evidence: string | null;
  recommendation: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ComplianceFramework {
  id: string;
  name: string;
  version: string;
  description: string;
  categories: string[];
  policies: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ComplianceEvidence {
  id: string;
  findingId: string;
  type: string;
  content: string;
  source: string;
  collectedAt: Date;
  collectedBy: string;
  verified: boolean;
  verifiedAt: Date | null;
}

export interface GapAnalysisResult {
  id: string;
  frameworkId: string;
  policyId: string;
  currentStatus: ComplianceStatus;
  targetStatus: ComplianceStatus;
  gapDescription: string;
  remediationSteps: string[];
  estimatedEffort: string;
  priority: ComplianceSeverity;
  createdAt: Date;
}

export interface ComplianceEvaluationInput {
  policyId: string;
  resourceId: string;
  context?: Record<string, unknown>;
}

export interface RemediationInput {
  findingId: string;
  description: string;
  assignedTo?: string;
  dueDate?: Date;
}
