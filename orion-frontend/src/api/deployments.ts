/**
 * Deployment API Service
 * Deployment CRUD operations and execution management
 */
import { api } from './client';

export interface Deployment {
  id: string;
  appName: string;
  version: string;
  environment: 'dev' | 'staging' | 'prod';
  status: 'pending' | 'deploying' | 'success' | 'failed' | 'rolled_back';
  strategy: 'blue-green' | 'canary' | 'rolling' | 'recreate';
  triggeredBy: string;
  commit?: string;
  startTime?: string;
  endTime?: string;
  duration?: number;
  stages?: DeploymentStage[];
}

export interface DeploymentStage {
  id: string;
  name: string;
  status: string;
  startTime?: string;
  endTime?: string;
  duration?: number;
  logs?: string[];
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
}

// ---- Deployment CRUD ----

export function getDeployments(params?: DeploymentListParams) {
  return api.get('/v1/deployments', { params });
}

export function getDeployment(id: string) {
  return api.get(`/v1/deployments/${id}`);
}

export function createDeployment(data: CreateDeploymentInput) {
  return api.post('/v1/deployments', data);
}

export function cancelDeployment(id: string) {
  return api.post(`/v1/deployments/${id}/cancel`);
}

// ---- Smart Deploy API ----

export function smartDeploy(data: {
  appName: string;
  environment: string;
  version: string;
  strategy?: string;
}) {
  return api.post('/v1/deploy/deploy', data);
}

export function getDeploymentStatus(id: string) {
  return api.get(`/v1/deploy/${id}`);
}

export function getDeploymentHistory(appName?: string) {
  return api.get('/v1/deploy/history', { params: { appName } });
}

export function getDeploymentMetrics() {
  return api.get('/v1/deploy/metrics');
}

export function rollbackDeployment(id: string, data?: { targetVersion?: string }) {
  return api.post(`/v1/deploy/${id}/rollback`, data);
}
