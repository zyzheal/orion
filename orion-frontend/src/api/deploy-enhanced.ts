/**
 * Deploy Enhanced API Service
 * Matches backend routes under /deploy/ (wired from internal/deploy-enhanced/handler)
 * Resources: windows, progressive deploys, emergencies
 */
import { api } from './client';

// ==================== Deploy Window ====================

export interface DeployWindow {
  id: string;
  tenantId: string;
  name: string;
  environmentId?: string;
  type: string;
  cronExpression?: string;
  startTime?: string;
  endTime?: string;
  durationMinutes: number;
  timezone: string;
  status: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDeployWindowInput {
  name: string;
  cronExpression: string;
  environmentId: string;
  durationMinutes?: number;
  timezone?: string;
}

export interface UpdateDeployWindowInput {
  name?: string;
  cronExpression?: string;
  durationMinutes?: number;
  timezone?: string;
  status?: string;
}

export interface WindowCheckResult {
  isActive: boolean;
  window?: DeployWindow;
  reason: string;
}

export function listWindows(params?: { environmentId?: string; status?: string }) {
  return api.get<DeployWindow[]>('/deploy/windows', { params });
}

export function getWindow(id: string) {
  return api.get<DeployWindow>(`/deploy/windows/${id}`);
}

export function createWindow(data: CreateDeployWindowInput) {
  return api.post<DeployWindow>('/deploy/windows', data);
}

export function updateWindow(id: string, data: UpdateDeployWindowInput) {
  return api.put<DeployWindow>(`/deploy/windows/${id}`, data);
}

export function deleteWindow(id: string) {
  return api.delete<void>(`/deploy/windows/${id}`);
}

export function checkWindow(id: string) {
  return api.get<WindowCheckResult>(`/deploy/windows/${id}/check`);
}

// ==================== Progressive Deploy ====================

export interface DeployStage {
  name: string;
  trafficPct: number;
  durationSec: number;
  status: string;
  startedAt?: string;
  completedAt?: string;
  validationResult?: string;
}

export interface ProgressiveDeploy {
  id: string;
  tenantId: string;
  deploymentId: string;
  strategy: string;
  stages: string;
  currentStage: number;
  status: string;
  rollbackEnabled: boolean;
  rollbackStage?: string;
  rollbackReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProgressiveDeployInput {
  stages: DeployStage[];
}

export interface AdvanceStageInput {
  stageId: string;
  validationResult?: string;
}

export interface RollbackStageInput {
  stageId: string;
  reason: string;
}

export function createProgressiveDeploy(deploymentId: string, data: CreateProgressiveDeployInput) {
  return api.post<ProgressiveDeploy>(`/deploy/${deploymentId}/progressive`, data);
}

export function getProgress(deployId: string) {
  return api.get<ProgressiveDeploy>(`/deploy/progressive/${deployId}`);
}

export function advanceStage(deployId: string, data: AdvanceStageInput) {
  return api.post<ProgressiveDeploy>(`/deploy/progressive/${deployId}/advance`, data);
}

export function rollbackStage(deployId: string, data: RollbackStageInput) {
  return api.post<ProgressiveDeploy>(`/deploy/progressive/${deployId}/rollback`, data);
}

// ==================== Emergency Deploy ====================

export interface EmergencyDeploy {
  id: string;
  tenantId: string;
  deploymentId: string;
  reason: string;
  requestedBy: string;
  approvedBy?: string;
  urgency: string;
  status: string;
  postMortem?: string;
  executedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEmergencyDeployInput {
  deploymentId: string;
  reason: string;
  requestedBy: string;
}

export interface ApproveEmergencyInput {
  approvedBy: string;
}

export interface CompleteEmergencyInput {
  postMortem?: string;
}

export function requestEmergencyDeploy(data: CreateEmergencyDeployInput) {
  return api.post<EmergencyDeploy>('/deploy/emergencies', data);
}

export function listEmergencies(params?: { status?: string }) {
  return api.get<EmergencyDeploy[]>('/deploy/emergencies', { params });
}

export function approveEmergency(id: string, data: ApproveEmergencyInput) {
  return api.post<EmergencyDeploy>(`/deploy/emergencies/${id}/approve`, data);
}

export function completeEmergency(id: string, data?: CompleteEmergencyInput) {
  return api.post<EmergencyDeploy>(`/deploy/emergencies/${id}/complete`, data || {});
}

export function rejectEmergency(id: string) {
  return api.post<EmergencyDeploy>(`/deploy/emergencies/${id}/reject`);
}
