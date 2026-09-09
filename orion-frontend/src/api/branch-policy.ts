/**
 * Branch Policy API Service
 * Multi-branch strategy: branch profiles, namespace matrix, sync policies,
 * deploy events (change audit + rollback), pre-deploy gate, merge preview.
 * Aligned with backend routes: /branch-policy/* (orion-platform-svc-go
 * internal/branch-policy handler). client.ts auto-prepends /api/v1.
 */
import { api } from './client';

// ============================================================================
// Enums
// ============================================================================

export type BranchSemantic = 'main' | 'release' | 'hotfix' | 'lts' | 'customer-custom';
export type BranchStatus = 'active' | 'archived' | 'retired';
export type BuildArtifactStatus = 'active' | 'deprecated';
export type SyncFrequency = 'daily' | 'weekly' | 'monthly';
export type SyncStrategy = 'rebase' | 'cherry-pick' | 'merge';
export type SyncResolve = 'none' | 'skip-conflict' | 'manual-required';
export type SyncRunStatus = 'success' | 'conflict' | 'failed';
export type SyncTriggerBy = 'scheduler' | 'manual';
export type DeployOutcome = 'success' | 'rolled-back' | 'failed';
export type GateSeverity = 'blocking' | 'warning';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type EnvName = 'dev' | 'staging' | 'prod';

// ============================================================================
// Models
// ============================================================================

export interface BranchProfile {
  id: string;
  tenantId: string;
  repoId: string;
  name: string;
  semantic: BranchSemantic;
  ownerId: string;
  ownerName: string;
  description?: string;
  ltsUntil?: string | null;
  mergeTargets: string[];
  mergeSources: string[];
  protectedEnvs: string[];
  allowedPipelines: string[];
  status: BranchStatus;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string | null;
}

export interface CreateBranchProfileInput {
  repoId: string;
  name: string;
  semantic: BranchSemantic;
  ownerId: string;
  ownerName?: string;
  description?: string;
  ltsUntil?: string | null;
  mergeTargets?: string[];
  mergeSources?: string[];
  protectedEnvs?: string[];
  allowedPipelines?: string[];
}

export interface UpdateBranchProfileInput {
  name?: string;
  description?: string;
  ownerId?: string;
  ownerName?: string;
  ltsUntil?: string | null;
  mergeTargets?: string[];
  mergeSources?: string[];
  protectedEnvs?: string[];
  allowedPipelines?: string[];
}

export interface BuildArtifact {
  id: string;
  tenantId: string;
  branchProfileId: string;
  branch: string;
  commitSha: string;
  imageDigest: string;
  imageTag: string;
  imageRepo: string;
  buildPipelineId: string;
  targetEnvs: string[];
  signedBy: string;
  signatureValid: boolean;
  binaryChecksum: string;
  configChecksum: string;
  migrationChecksum: string;
  builtAt: string;
  sizeBytes: number;
  status: BuildArtifactStatus;
  deprecatedAt?: string | null;
  deprecatedReason?: string;
}

export interface RegisterArtifactInput {
  branchProfileId: string;
  branch: string;
  commitSha: string;
  imageDigest: string;
  imageTag: string;
  imageRepo: string;
  buildPipelineId: string;
  targetEnvs: string[];
  signedBy?: string;
  binaryChecksum?: string;
  configChecksum?: string;
  migrationChecksum?: string;
  sizeBytes?: number;
}

export interface SignatureVerificationResult {
  artifactId: string;
  valid: boolean;
  reason: string;
  verifiedAt: string;
}

export interface NamespaceBinding {
  id: string;
  tenantId: string;
  branchProfileId: string;
  envName: EnvName;
  configNamespace: string;
  dbName: string;
  mqTopicPrefix: string;
  redisKeyPrefix: string;
  imageTagPrefix: string;
  createdAt: string;
}

export interface CreateNamespaceInput {
  branchProfileId: string;
  envName: EnvName;
  imageTagPrefix: string;
  configNamespace?: string;
  dbName?: string;
  mqTopicPrefix?: string;
  redisKeyPrefix?: string;
  imageRepo?: string;
}

export interface NamespaceValidationResult {
  branchProfileId: string;
  envName: string;
  valid: boolean;
  checks: NamespaceCheck[];
  validatedAt: string;
}

export interface NamespaceCheck {
  field: string;
  valid: boolean;
  message: string;
}

export interface BranchEnvMatrix {
  branches: MatrixRow[];
  envs: string[];
  generatedAt: string;
}

export interface MatrixRow {
  branchProfileId: string;
  branchName: string;
  semantic: BranchSemantic;
  status: BranchStatus;
  bindings: Record<string, MatrixCell>;
}

export interface MatrixCell {
  exists: boolean;
  bindingId?: string;
  imageTagPrefix?: string;
  dbName?: string;
}

export interface SyncPolicy {
  id: string;
  tenantId: string;
  name: string;
  sourceBranch: string;
  targetBranches: string[];
  frequency: SyncFrequency;
  cronExpr: string;
  strategy: SyncStrategy;
  autoResolve: SyncResolve;
  notifyOnConflict: string[];
  notifyWebhook: string;
  enabled: boolean;
  lastRunAt?: string | null;
  lastRunStatus?: SyncRunStatus | null;
  lastRunConflictFiles: string[];
  changeManagementId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSyncPolicyInput {
  name: string;
  sourceBranch: string;
  targetBranches: string[];
  frequency?: SyncFrequency;
  cronExpr?: string;
  strategy?: SyncStrategy;
  autoResolve?: SyncResolve;
  notifyOnConflict?: string[];
  notifyWebhook?: string;
  enabled?: boolean;
}

export interface UpdateSyncPolicyInput {
  name?: string;
  sourceBranch?: string;
  targetBranches?: string[];
  frequency?: SyncFrequency;
  cronExpr?: string;
  strategy?: SyncStrategy;
  autoResolve?: SyncResolve;
  notifyOnConflict?: string[];
  notifyWebhook?: string;
  enabled?: boolean;
}

export interface SyncRunLog {
  id: string;
  tenantId: string;
  policyId: string;
  triggeredAt: string;
  triggeredBy: SyncTriggerBy;
  sourceCommit: string;
  targetBranches: string[];
  status: SyncRunStatus;
  conflictFiles: string[];
  errorMsg: string;
  durationMs: number;
  changeId: string;
}

export interface DeployEvent {
  id: string;
  tenantId: string;
  actorId: string;
  actorName: string;
  branch: string;
  env: EnvName;
  fromCommit: string;
  toCommit: string;
  artifactId: string;
  imageDigest: string;
  approvalId: string;
  outcome: DeployOutcome;
  rollbackTo?: string | null;
  durationMs: number;
  errorRate: number;
  p99Latency: number;
  startedAt: string;
  completedAt?: string | null;
  gateResult: string;
  errorMsg: string;
  createdAt: string;
}

export interface CreateDeployEventInput {
  actorId: string;
  actorName?: string;
  branch: string;
  env: EnvName;
  fromCommit?: string;
  toCommit: string;
  artifactId?: string;
  imageDigest?: string;
  approvalId?: string;
  outcome?: DeployOutcome;
  gateResult?: string;
}

export interface AuditTrailResult {
  events: DeployEvent[];
  branches: string[];
  envs: string[];
  artifactIds: string[];
  approvalIds: string[];
  generatedAt: string;
}

export interface GateRuleResult {
  ruleId: string;
  name: string;
  passed: boolean;
  detail: string;
  severity: GateSeverity;
}

export interface PreDeployGateResult {
  passed: boolean;
  requestId: string;
  checkedAt: string;
  branch: string;
  env: string;
  rules: GateRuleResult[];
  blocked: string[];
}

export interface PreDeployGateInput {
  branch: string;
  targetEnv: EnvName;
  imageTag?: string;
  approvalId?: string;
  artifactId?: string;
  pipelineName?: string;
  sourceCommit?: string;
}

export interface MergePreview {
  id: string;
  tenantId: string;
  sourceBranch: string;
  targetBranch: string;
  sourceCommit: string;
  targetCommit: string;
  conflictFiles: string[];
  addedFiles: string[];
  modifiedFiles: string[];
  deletedFiles: string[];
  conflictCount: number;
  riskLevel: RiskLevel;
  previewedAt: string;
}

export interface MergePreviewInput {
  sourceBranch: string;
  targetBranch: string;
  sourceCommit?: string;
  targetCommit?: string;
  conflictFiles?: string[];
  addedFiles?: string[];
  modifiedFiles?: string[];
  deletedFiles?: string[];
}

// ============================================================================
// Branch Profiles
// ============================================================================

export function getBranchProfiles(params?: {
  status?: BranchStatus;
  semantic?: BranchSemantic;
  repoId?: string;
  ownerId?: string;
  page?: number;
  limit?: number;
}) {
  return api.get('/branch-policy/branch-profiles', { params });
}

export function createBranchProfile(data: CreateBranchProfileInput) {
  return api.post('/branch-policy/branch-profiles', data);
}

export function getBranchProfile(id: string) {
  return api.get(`/branch-policy/branch-profiles/${id}`);
}

export function updateBranchProfile(id: string, data: UpdateBranchProfileInput) {
  return api.put(`/branch-policy/branch-profiles/${id}`, data);
}

export function archiveBranchProfile(id: string) {
  return api.post(`/branch-policy/branch-profiles/${id}/archive`);
}

export function activateBranchProfile(id: string) {
  return api.post(`/branch-policy/branch-profiles/${id}/activate`);
}

// ============================================================================
// Build Artifacts
// ============================================================================

export function getBuildArtifacts(params?: {
  branchProfileId?: string;
  branch?: string;
  commitSha?: string;
  status?: BuildArtifactStatus;
  signatureValid?: boolean;
  page?: number;
  limit?: number;
}) {
  return api.get('/branch-policy/build-artifacts', { params });
}

export function registerBuildArtifact(data: RegisterArtifactInput) {
  return api.post('/branch-policy/build-artifacts', data);
}

export function getBuildArtifact(id: string) {
  return api.get(`/branch-policy/build-artifacts/${id}`);
}

export function verifyArtifactSignature(id: string) {
  return api.post(`/branch-policy/build-artifacts/${id}/verify-signature`);
}

export function deprecateArtifact(id: string) {
  return api.post(`/branch-policy/build-artifacts/${id}/deprecate`);
}

// ============================================================================
// Namespace Bindings & Matrix
// ============================================================================

export function getNamespaceBindings(params?: {
  branchProfileId?: string;
  envName?: EnvName;
  page?: number;
  limit?: number;
}) {
  return api.get('/branch-policy/namespace-bindings', { params });
}

export function createNamespaceBinding(data: CreateNamespaceInput) {
  return api.post('/branch-policy/namespace-bindings', data);
}

export function getNamespaceMatrix() {
  return api.get('/branch-policy/namespace-bindings/matrix');
}

export function getNamespaceBinding(id: string) {
  return api.get(`/branch-policy/namespace-bindings/${id}`);
}

export function deleteNamespaceBinding(id: string) {
  return api.delete(`/branch-policy/namespace-bindings/${id}`);
}

export function validateNamespaceBinding(id: string) {
  return api.get(`/branch-policy/namespace-bindings/${id}/validate`);
}

// ============================================================================
// Sync Policies
// ============================================================================

export function getSyncPolicies(params?: {
  enabled?: boolean;
  frequency?: SyncFrequency;
  strategy?: SyncStrategy;
  sourceBranch?: string;
}) {
  return api.get('/branch-policy/sync-policies', { params });
}

export function createSyncPolicy(data: CreateSyncPolicyInput) {
  return api.post('/branch-policy/sync-policies', data);
}

export function getSyncPolicy(id: string) {
  return api.get(`/branch-policy/sync-policies/${id}`);
}

export function updateSyncPolicy(id: string, data: UpdateSyncPolicyInput) {
  return api.put(`/branch-policy/sync-policies/${id}`, data);
}

export function deleteSyncPolicy(id: string) {
  return api.delete(`/branch-policy/sync-policies/${id}`);
}

export function runSyncNow(id: string) {
  return api.post(`/branch-policy/sync-policies/${id}/run-now`);
}

export function enableSyncPolicy(id: string) {
  return api.post(`/branch-policy/sync-policies/${id}/enable`);
}

export function disableSyncPolicy(id: string) {
  return api.post(`/branch-policy/sync-policies/${id}/disable`);
}

export function getSyncRunLogs(params?: {
  policyId?: string;
  status?: SyncRunStatus;
  limit?: number;
}) {
  return api.get('/branch-policy/sync-policies/run-logs', { params });
}

export function getSyncPolicyRunLogs(id: string, params?: { status?: SyncRunStatus; limit?: number }) {
  return api.get(`/branch-policy/sync-policies/${id}/run-logs`, { params });
}

// ============================================================================
// Deploy Events (change audit + rollback)
// ============================================================================

export function getAuditTrail(params?: {
  branch?: string;
  env?: EnvName;
  artifactId?: string;
  approvalId?: string;
  limit?: number;
}) {
  return api.get('/branch-policy/deploy-events/audit-trail', { params });
}

export function getDeployEvents(params?: {
  branch?: string;
  env?: EnvName;
  actorId?: string;
  approvalId?: string;
  outcome?: DeployOutcome;
  limit?: number;
}) {
  return api.get('/branch-policy/deploy-events', { params });
}

export function createDeployEvent(data: CreateDeployEventInput) {
  return api.post('/branch-policy/deploy-events', data);
}

export function getDeployEvent(id: string) {
  return api.get(`/branch-policy/deploy-events/${id}`);
}

export function getDeployEventsByBranch(branch: string) {
  return api.get(`/branch-policy/deploy-events/by-branch/${encodeURIComponent(branch)}`);
}

export function getDeployEventsByEnv(env: string) {
  return api.get(`/branch-policy/deploy-events/by-env/${env}`);
}

export function getDeployEventsByActor(actor: string) {
  return api.get(`/branch-policy/deploy-events/by-actor/${encodeURIComponent(actor)}`);
}

export function rollbackDeployEvent(id: string) {
  return api.post(`/branch-policy/deploy-events/${id}/rollback`);
}

// ============================================================================
// Pre-Deploy Gate
// ============================================================================

export function checkPreDeployGate(data: PreDeployGateInput) {
  return api.post('/branch-policy/pre-deploy-gate/check', data);
}

// ============================================================================
// Merge Preview (conflict pre-check)
// ============================================================================

export function createMergePreview(data: MergePreviewInput) {
  return api.post('/branch-policy/merge-preview', data);
}

export function getMergePreview(id: string) {
  return api.get(`/branch-policy/merge-preview/${id}`);
}

export function listMergePreviews(params?: { sourceBranch?: string; targetBranch?: string; limit?: number }) {
  return api.get('/branch-policy/merge-preview', { params });
}

// ============================================================================
// Base Branch Policy (generic CRUD + enforce + coverage + stats)
// ============================================================================

export function getBranchPolicies(params?: { status?: string; page?: number; limit?: number }) {
  return api.get('/branch-policy', { params });
}

export function createBranchPolicy(data: { name: string; status?: string; config?: Record<string, unknown> }) {
  return api.post('/branch-policy', data);
}

export function validateBranch(branch: string) {
  return api.get(`/branch-policy/validate/${encodeURIComponent(branch)}`);
}

export function getBranchCoverage() {
  return api.get('/branch-policy/coverage');
}

export function enforceBranchPolicy() {
  return api.post('/branch-policy/enforce');
}

export function getBranchViolations(params?: { status?: string; limit?: number }) {
  return api.get('/branch-policy/violations', { params });
}

export function getBranchStats() {
  return api.get('/branch-policy/stats');
}
