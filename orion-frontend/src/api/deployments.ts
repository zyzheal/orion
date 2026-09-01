/**
 * Deployment API Service - FIXED P0-2
 * Deployment CRUD operations and execution management
 * Aligned with backend routes: /deployments/* (ci-cd/deploy handler)
 */
import { api } from './client';

export interface Deployment {
  id: string;
  appName: string;
  version: string;
  environment: 'dev' | 'staging' | 'prod';
  status: 'pending' | 'deploying' | 'success' | 'failed' | 'rolled_back' | 'cancelled';
  strategy: 'blue-green' | 'canary' | 'rolling' | 'recreate';
  triggeredBy: string;
  commit?: string;
  startTime?: string;
  endTime?: string;
  duration?: number;
  stages?: DeploymentStage[];
  healthChecks?: HealthCheckResult[];
  pipelineRunId?: string;
  rollbackFrom?: string;
}

export interface DeploymentStage {
  id: string;
  name: string;
  status: string;
  startTime?: string;
  endTime?: string;
  duration?: number;
  details?: string;
  logs?: string[];
}

export interface HealthCheckResult {
  name: string;
  status: 'healthy' | 'unhealthy' | 'degraded' | 'unknown';
  message?: string;
  latency?: number;
}

export interface DeploymentListParams {
  appName?: string;
  environment?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export interface CreateDeploymentInput {
  appName: string;
  version: string;
  environment: string;
  strategy?: string;
  commit?: string;
  pipelineRunId?: string;
  isEmergency?: boolean;
  reason?: string;
}

// ---- Deployment CRUD ----

export function getDeployments(params?: DeploymentListParams) {
  return api.get('/deployments', { params });
}

export function getDeployment(id: string) {
  return api.get(`/deployments/${id}`);
}

export function createDeployment(data: CreateDeploymentInput) {
  return api.post('/deployments', data);
}

export function cancelDeployment(id: string) {
  return api.post(`/deployments/${id}/cancel`);
}

// ---- Smart Deploy API ----

export function smartDeploy(data: {
  appName: string;
  environment: string;
  version: string;
  strategy?: string;
}) {
  return api.post('/deployments', data);
}

export function getDeploymentStatus(id: string) {
  return api.get(`/deployments/${id}`);
}

export function getDeploymentHistory(appName?: string) {
  return api.get('/deployments', { params: { appName } });
}

export function getDeploymentMetrics() {
  return api.get('/deployments/stats');
}

export function getDeploymentEvents(id: string) {
  return api.get(`/deployments/${id}/events`);
}

export function getDeploymentCount() {
  return api.get('/deployments/count');
}

export function getLatestDeployment(params?: { environment?: string }) {
  return api.get('/deployments/latest', { params });
}

export function getEnvironments() {
  return api.get('/deployments/environments');
}

export function startDeployment(id: string) {
  return api.post(`/deployments/${id}/start`);
}

export function completeDeployment(id: string) {
  return api.post(`/deployments/${id}/complete`);
}

export function rollbackDeployment(id: string, data?: { targetVersion?: string }) {
  return api.post(`/deployments/${id}/rollback`, data);
}
