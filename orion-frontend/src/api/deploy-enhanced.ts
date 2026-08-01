/**
 * Deploy Enhanced API Service
 * Release management: plans, strategies, windows, approvals, records, versions, rollbacks, reports
 * Prefix: /api/v1/deploy-enhanced
 */
import { api } from './client';

// ==================== Release Plan ====================

export interface ReleasePlanStep {
  id: string;
  order: number;
  name: string;
  type: 'build' | 'test' | 'deploy' | 'verify';
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  config: Record<string, unknown>;
  duration?: number;
  startedAt?: string;
  completedAt?: string;
}

export interface ReleasePlan {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  projectId: string;
  appNames: string[];
  environment: string;
  status: 'draft' | 'approved' | 'executing' | 'completed' | 'cancelled' | 'failed';
  strategyId: string;
  scheduledAt?: string;
  steps: ReleasePlanStep[];
  createdBy: string;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePlanInput {
  name: string;
  description: string;
  projectId: string;
  appNames: string[];
  environment: string;
  strategyId: string;
  scheduledAt?: string;
  steps: Omit<ReleasePlanStep, 'id' | 'status' | 'startedAt' | 'completedAt'>[];
}

export function listPlans(params?: { page?: number; limit?: number; status?: string; search?: string }) {
  return api.get('/api/v1/deploy-enhanced/plans', { params });
}

export function getPlan(id: string) {
  return api.get(`/api/v1/deploy-enhanced/plans/${id}`);
}

export function createPlan(data: CreatePlanInput) {
  return api.post('/api/v1/deploy-enhanced/plans', data);
}

export function updatePlan(id: string, data: Partial<ReleasePlan>) {
  return api.patch(`/api/v1/deploy-enhanced/plans/${id}`, data);
}

export function deletePlan(id: string) {
  return api.delete(`/api/v1/deploy-enhanced/plans/${id}`);
}

export function approvePlan(id: string) {
  return api.post(`/api/v1/deploy-enhanced/plans/${id}/approve`);
}

export function cancelPlan(id: string) {
  return api.post(`/api/v1/deploy-enhanced/plans/${id}/cancel`);
}

// ==================== Release Strategy ====================

export interface ReleaseStrategy {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  type: 'blue-green' | 'canary' | 'full';
  config: {
    canaryPercentage?: number;
    canarySteps?: number[];
    canaryInterval?: number;
    maxRollbackVersion?: number;
  };
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStrategyInput {
  name: string;
  description: string;
  type: 'blue-green' | 'canary' | 'full';
  config: {
    canaryPercentage?: number;
    canarySteps?: number[];
    canaryInterval?: number;
    maxRollbackVersion?: number;
  };
}

export function listStrategies(params?: { page?: number; limit?: number; search?: string }) {
  return api.get('/api/v1/deploy-enhanced/strategies', { params });
}

export function getStrategy(id: string) {
  return api.get(`/api/v1/deploy-enhanced/strategies/${id}`);
}

export function createStrategy(data: CreateStrategyInput) {
  return api.post('/api/v1/deploy-enhanced/strategies', data);
}

export function updateStrategy(id: string, data: Partial<ReleaseStrategy>) {
  return api.patch(`/api/v1/deploy-enhanced/strategies/${id}`, data);
}

export function deleteStrategy(id: string) {
  return api.delete(`/api/v1/deploy-enhanced/strategies/${id}`);
}

export function toggleStrategy(id: string) {
  return api.post(`/api/v1/deploy-enhanced/strategies/${id}/toggle`);
}

// ==================== Release Window ====================

export interface ReleaseWindow {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  environment: string;
  weekDays: number[];
  startTime: string;
  endTime: string;
  timezone: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWindowInput {
  name: string;
  description: string;
  environment: string;
  weekDays: number[];
  startTime: string;
  endTime: string;
  timezone?: string;
}

export function listWindows(params?: { page?: number; limit?: number; environment?: string; search?: string }) {
  return api.get('/api/v1/deploy-enhanced/windows', { params });
}

export function getWindow(id: string) {
  return api.get(`/api/v1/deploy-enhanced/windows/${id}`);
}

export function createWindow(data: CreateWindowInput) {
  return api.post('/api/v1/deploy-enhanced/windows', data);
}

export function updateWindow(id: string, data: Partial<ReleaseWindow>) {
  return api.patch(`/api/v1/deploy-enhanced/windows/${id}`, data);
}

export function deleteWindow(id: string) {
  return api.delete(`/api/v1/deploy-enhanced/windows/${id}`);
}

export function toggleWindow(id: string) {
  return api.post(`/api/v1/deploy-enhanced/windows/${id}/toggle`);
}

export function checkWindow(environment: string) {
  return api.get(`/api/v1/deploy-enhanced/windows/check/${environment}`);
}

// ==================== Approval ====================

export interface ApprovalUser {
  userId: string;
  userName: string;
  status: 'pending' | 'approved' | 'rejected';
  respondedAt?: string;
  comment?: string;
}

export interface ApprovalRecord {
  id: string;
  tenantId: string;
  planId: string;
  planName: string;
  type: 'plan' | 'strategy' | 'rollback';
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  approvers: ApprovalUser[];
  requestedBy: string;
  requestedAt: string;
  approvedAt?: string;
  rejectedReason?: string;
  createdAt: string;
}

export function listApprovals(params?: { page?: number; limit?: number; status?: string }) {
  return api.get('/api/v1/deploy-enhanced/approvals', { params });
}

export function getApproval(id: string) {
  return api.get(`/api/v1/deploy-enhanced/approvals/${id}`);
}

export function createApproval(planId: string, type: 'plan' | 'strategy' | 'rollback') {
  return api.post('/api/v1/deploy-enhanced/approvals', { planId, type });
}

export function respondToApproval(id: string, approved: boolean, comment?: string) {
  const userId = (localStorage.getItem('userId') || 'current-user');
  const userName = (localStorage.getItem('userName') || 'Current User');
  return api.post(`/api/v1/deploy-enhanced/approvals/${id}/respond`, { userId, userName, approved, comment });
}

export function cancelApproval(id: string) {
  return api.post(`/api/v1/deploy-enhanced/approvals/${id}/cancel`);
}

// ==================== Release Record ====================

export interface ReleaseRecordMetrics {
  successRate: number;
  totalPods: number;
  healthyPods: number;
  responseTimeP50: number;
  responseTimeP99: number;
  errorRate: number;
}

export interface ReleaseRecord {
  id: string;
  tenantId: string;
  planId?: string;
  appName: string;
  version: string;
  environment: string;
  strategy: string;
  status: 'pending' | 'deploying' | 'success' | 'failed' | 'rolled_back' | 'cancelled';
  startedAt: string;
  completedAt?: string;
  duration?: number;
  createdBy: string;
  metrics?: ReleaseRecordMetrics;
  rollbackFrom?: string;
}

export function listRecords(params?: { page?: number; limit?: number; environment?: string; status?: string; search?: string }) {
  return api.get('/api/v1/deploy-enhanced/records', { params });
}

export function getRecord(id: string) {
  return api.get(`/api/v1/deploy-enhanced/records/${id}`);
}

export function createRecord(data: { planId?: string; appName: string; version: string; environment: string; strategy: string }) {
  return api.post('/api/v1/deploy-enhanced/records', data);
}

export function updateRecordStatus(id: string, status: string, metrics?: ReleaseRecordMetrics) {
  return api.patch(`/api/v1/deploy-enhanced/records/${id}/status`, { status, metrics });
}

export function cancelRecord(id: string) {
  return api.post(`/api/v1/deploy-enhanced/records/${id}/cancel`);
}

// ==================== Version ====================

export interface VersionRecord {
  id: string;
  tenantId: string;
  appName: string;
  version: string;
  description: string;
  gitCommit: string;
  gitBranch: string;
  artifactUrl: string;
  status: 'draft' | 'validated' | 'released' | 'deprecated';
  changelog: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVersionInput {
  appName: string;
  version: string;
  description: string;
  gitCommit: string;
  gitBranch: string;
  artifactUrl: string;
  changelog: string[];
}

export function listVersions(params?: { page?: number; limit?: number; status?: string; search?: string }) {
  return api.get('/api/v1/deploy-enhanced/versions', { params });
}

export function getVersion(id: string) {
  return api.get(`/api/v1/deploy-enhanced/versions/${id}`);
}

export function createVersion(data: CreateVersionInput) {
  return api.post('/api/v1/deploy-enhanced/versions', data);
}

export function updateVersion(id: string, data: Partial<VersionRecord>) {
  return api.patch(`/api/v1/deploy-enhanced/versions/${id}`, data);
}

export function deleteVersion(id: string) {
  return api.delete(`/api/v1/deploy-enhanced/versions/${id}`);
}

export function listVersionsByApp(appName: string) {
  return api.get(`/api/v1/deploy-enhanced/versions/app/${appName}`);
}

export function compareVersions(id1: string, id2: string) {
  return api.post('/api/v1/deploy-enhanced/versions/compare', { id1, id2 });
}

// ==================== Rollback ====================

export interface RollbackRecord {
  id: string;
  tenantId: string;
  planId?: string;
  appName: string;
  environment: string;
  fromVersion: string;
  toVersion: string;
  status: 'pending' | 'executing' | 'success' | 'failed' | 'cancelled';
  reason: string;
  requestedBy: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

export function listRollbacks(params?: { page?: number; limit?: number; environment?: string; status?: string; search?: string }) {
  return api.get('/api/v1/deploy-enhanced/rollbacks', { params });
}

export function getRollback(id: string) {
  return api.get(`/api/v1/deploy-enhanced/rollbacks/${id}`);
}

export function createRollback(data: { planId?: string; appName: string; environment: string; fromVersion: string; toVersion: string; reason: string }) {
  return api.post('/api/v1/deploy-enhanced/rollbacks', data);
}

export function executeRollback(id: string) {
  return api.post(`/api/v1/deploy-enhanced/rollbacks/${id}/execute`);
}

export function cancelRollback(id: string) {
  return api.post(`/api/v1/deploy-enhanced/rollbacks/${id}/cancel`);
}

// ==================== Reports ====================

export interface DailyMetric {
  date: string;
  total: number;
  success: number;
  failed: number;
  rollback: number;
}

export interface ReleaseReportMetrics {
  totalReleases: number;
  successRate: number;
  averageDuration: number;
  rollbackRate: number;
  releasesByEnv: Record<string, number>;
  releasesByStatus: Record<string, number>;
  last30Days: DailyMetric[];
}

export function getReportMetrics() {
  return api.get('/api/v1/deploy-enhanced/reports/metrics');
}

export function getMetricsSummary() {
  return api.get('/api/v1/deploy-enhanced/reports/summary');
}
