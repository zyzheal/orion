/**
 * MLOps API Service (Phase 4 P0)
 * Experiment tracking, model registry, training jobs, model deployment, metrics
 */
import { api } from './client';

export interface MLExperiment {
  id: string;
  name: string;
  project?: string;
  description?: string;
  status: 'draft' | 'running' | 'completed' | 'failed';
  modelType?: string;
  metrics?: Record<string, number>;
  hyperparams?: Record<string, unknown>;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface MLExperimentRun {
  id: string;
  experimentId: string;
  iteration: number;
  metrics?: Record<string, number>;
  status: 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
}

export interface MLModel {
  id: string;
  name: string;
  version: number;
  experimentId?: string;
  status: 'draft' | 'staging' | 'production' | 'archived';
  artifactPath?: string;
  metrics?: Record<string, number>;
  description?: string;
  deployedEndpoint?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TrainingJob {
  id: string;
  experimentId?: string;
  dataset?: string;
  config?: Record<string, unknown>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  logs?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

export interface MLOpsMetrics {
  totalExperiments: number;
  runningExperiments: number;
  completedExperiments: number;
  failedExperiments: number;
  totalModels: number;
  productionModels: number;
  totalJobs: number;
  runningJobs: number;
  failedJobs: number;
  recentExperiments: MLExperiment[];
  recentModels: MLModel[];
  recentJobs: TrainingJob[];
}

// ==================== Experiments ====================

export function createExperiment(data: {
  name: string; project?: string; modelType?: string;
  description?: string; hyperparams?: Record<string, unknown>;
}) {
  return api.post('/mlops/experiments', data);
}

export function listExperiments(params?: { status?: string; project?: string }) {
  return api.get<{ data: MLExperiment[] }>('/mlops/experiments', { params });
}

export function getExperiment(id: string) {
  return api.get<{ data: MLExperiment }>(`/mlops/experiments/${id}`);
}

export function updateExperiment(id: string, data: {
  name?: string; project?: string; modelType?: string;
  description?: string; hyperparams?: Record<string, unknown>;
}) {
  return api.put(`/mlops/experiments/${id}`, data);
}

export function deleteExperiment(id: string) {
  return api.delete(`/mlops/experiments/${id}`);
}

export function updateExperimentStatus(id: string, status: MLExperiment['status']) {
  return api.post(`/mlops/experiments/${id}/status`, { status });
}

export function getExperimentRuns(experimentId: string) {
  return api.get<{ data: MLExperimentRun[] }>(`/mlops/experiments/${experimentId}/runs`);
}

// ==================== Models ====================

export function registerModel(data: {
  name: string; experimentId?: string; artifactPath?: string;
  metrics?: Record<string, number>; description?: string;
}) {
  return api.post('/mlops/models', data);
}

export function listModels(params?: { status?: string }) {
  return api.get<{ data: MLModel[] }>('/mlops/models', { params });
}

export function getModel(id: string) {
  return api.get<{ data: MLModel }>(`/mlops/models/${id}`);
}

export function deployModel(id: string, data?: { endpoint?: string }) {
  return api.post(`/mlops/models/${id}/deploy`, data);
}

export function updateModelStatus(id: string, status: MLModel['status']) {
  return api.post(`/mlops/models/${id}/status`, { status });
}

// ==================== Training Jobs ====================

export function createTrainingJob(data: {
  experimentId?: string; dataset?: string; config?: Record<string, unknown>;
}) {
  return api.post('/mlops/training-jobs', data);
}

export function listTrainingJobs(params?: { status?: string }) {
  return api.get<{ data: TrainingJob[] }>('/mlops/training-jobs', { params });
}

export function updateJobStatus(id: string, status: TrainingJob['status']) {
  return api.post(`/mlops/training-jobs/${id}/status`, { status });
}

// ==================== Metrics ====================

export function getMLOpsMetrics() {
  return api.get<{ data: MLOpsMetrics }>('/mlops/metrics');
}
