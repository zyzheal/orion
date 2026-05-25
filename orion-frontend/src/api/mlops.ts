/**
 * MLOps API Service (Phase 4 Batch 2)
 * Experiment tracking, model registry, training jobs
 */
import { api } from './client';

export interface MLExperiment {
  id: string;
  name: string;
  project?: string;
  status: 'draft' | 'running' | 'completed' | 'failed';
  modelType?: string;
  metrics?: Record<string, number>;
  hyperparams?: Record<string, any>;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

export interface MLModel {
  id: string;
  name: string;
  version: number;
  experimentId?: string;
  status: 'draft' | 'staging' | 'production' | 'archived';
  artifactPath?: string;
  metrics?: Record<string, number>;
  createdAt: string;
  updatedAt: string;
}

export interface TrainingJob {
  id: string;
  experimentId?: string;
  dataset?: string;
  config?: Record<string, any>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  logs?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

// Experiments
export function createExperiment(data: { name: string; project?: string; modelType?: string; hyperparams?: Record<string, any> }) {
  return api.post('/mlops/experiments', data);
}

export function listExperiments(params?: { status?: string; project?: string }) {
  return api.get<{ data: MLExperiment[] }>('/mlops/experiments', { params });
}

export function getExperiment(id: string) {
  return api.get<{ data: MLExperiment }>(`/mlops/experiments/${id}`);
}

export function updateExperimentStatus(id: string, status: MLExperiment['status']) {
  return api.post(`/mlops/experiments/${id}/status`, { status });
}

// Models
export function registerModel(data: { name: string; experimentId?: string; artifactPath?: string; metrics?: Record<string, number> }) {
  return api.post('/mlops/models', data);
}

export function listModels(params?: { status?: string }) {
  return api.get<{ data: MLModel[] }>('/mlops/models', { params });
}

export function updateModelStatus(id: string, status: MLModel['status']) {
  return api.post(`/mlops/models/${id}/status`, { status });
}

// Training Jobs
export function createTrainingJob(data: { experimentId?: string; dataset?: string; config?: Record<string, any> }) {
  return api.post('/mlops/training-jobs', data);
}

export function listTrainingJobs(params?: { status?: string }) {
  return api.get<{ data: TrainingJob[] }>('/mlops/training-jobs', { params });
}

export function updateJobStatus(id: string, status: TrainingJob['status']) {
  return api.post(`/mlops/training-jobs/${id}/status`, { status });
}
