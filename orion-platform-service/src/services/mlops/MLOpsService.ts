/**
 * MLOps Service (Phase 4 Batch 2)
 * Experiment tracking, model registry, training jobs, model deployment, metrics
 */

import { v4 as uuidv4 } from 'uuid';

// Types
export interface MLExperiment {
  id: string;
  tenantId: string;
  name: string;
  project?: string;
  status: 'draft' | 'running' | 'completed' | 'failed';
  modelType?: string;
  description?: string;
  metrics?: Record<string, number>;
  hyperparams?: Record<string, any>;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface MLExperimentRun {
  id: string;
  experimentId: string;
  tenantId: string;
  iteration: number;
  metrics?: Record<string, number>;
  status: 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
}

export interface MLModel {
  id: string;
  tenantId: string;
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
  tenantId: string;
  experimentId?: string;
  modelId?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  dataset?: string;
  config?: Record<string, any>;
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

// In-memory storage
const experiments = new Map<string, MLExperiment>();
const experimentRuns = new Map<string, MLExperimentRun[]>();
const models = new Map<string, MLModel>();
const trainingJobs = new Map<string, TrainingJob>();

export class MLOpsService {
  // ==================== Experiments ====================

  async createExperiment(input: { name: string; project?: string; modelType?: string; description?: string; hyperparams?: Record<string, any> }, tenantId: string): Promise<MLExperiment> {
    const exp: MLExperiment = {
      id: uuidv4(), tenantId, name: input.name, project: input.project,
      status: 'draft', modelType: input.modelType, description: input.description,
      hyperparams: input.hyperparams,
      createdAt: new Date().toISOString(),
    };
    experiments.set(exp.id, exp);
    return exp;
  }

  async listExperiments(tenantId: string, params?: { status?: string; project?: string }): Promise<MLExperiment[]> {
    let result = Array.from(experiments.values()).filter((e) => e.tenantId === tenantId);
    if (params?.status) result = result.filter((e) => e.status === params.status);
    if (params?.project) result = result.filter((e) => e.project === params.project);
    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getExperiment(id: string): Promise<MLExperiment | undefined> {
    return experiments.get(id);
  }

  async updateExperiment(id: string, input: { name?: string; project?: string; modelType?: string; description?: string; hyperparams?: Record<string, any> }, tenantId: string): Promise<MLExperiment | undefined> {
    const exp = experiments.get(id);
    if (!exp || exp.tenantId !== tenantId) return undefined;
    if (input.name !== undefined) exp.name = input.name;
    if (input.project !== undefined) exp.project = input.project;
    if (input.modelType !== undefined) exp.modelType = input.modelType;
    if (input.description !== undefined) exp.description = input.description;
    if (input.hyperparams !== undefined) exp.hyperparams = input.hyperparams;
    exp.updatedAt = new Date().toISOString();
    experiments.set(id, exp);
    return exp;
  }

  async deleteExperiment(id: string, tenantId: string): Promise<boolean> {
    const exp = experiments.get(id);
    if (!exp || exp.tenantId !== tenantId) return false;
    // Also delete associated runs and jobs
    const runs = experimentRuns.get(id) || [];
    for (const run of runs) {
      experimentRuns.delete(run.id);
    }
    experiments.delete(id);
    return true;
  }

  async updateExperimentStatus(id: string, status: MLExperiment['status']): Promise<MLExperiment | undefined> {
    const exp = experiments.get(id);
    if (!exp) return undefined;
    exp.status = status;
    if (status === 'running') exp.startedAt = new Date().toISOString();
    if (status === 'completed' || status === 'failed') exp.completedAt = new Date().toISOString();
    experiments.set(id, exp);
    return exp;
  }

  // ==================== Experiment Runs ====================

  async getExperimentRuns(experimentId: string, tenantId: string): Promise<MLExperimentRun[]> {
    return (experimentRuns.get(experimentId) || []).filter((r) => r.tenantId === tenantId);
  }

  async createExperimentRun(experimentId: string, tenantId: string): Promise<MLExperimentRun> {
    const runs = experimentRuns.get(experimentId) || [];
    const run: MLExperimentRun = {
      id: uuidv4(), experimentId, tenantId,
      iteration: runs.length + 1,
      status: 'running',
      startedAt: new Date().toISOString(),
    };
    runs.push(run);
    experimentRuns.set(experimentId, runs);
    return run;
  }

  async updateExperimentRunStatus(runId: string, status: MLExperimentRun['status'], metrics?: Record<string, number>): Promise<MLExperimentRun | undefined> {
    for (const [expId, runs] of Array.from(experimentRuns.entries())) {
      const run = runs.find((r) => r.id === runId);
      if (run) {
        run.status = status;
        if (metrics) run.metrics = metrics;
        if (status !== 'running') run.completedAt = new Date().toISOString();
        return run;
      }
    }
    return undefined;
  }

  // ==================== Model Registry ====================

  async registerModel(input: { name: string; experimentId?: string; artifactPath?: string; metrics?: Record<string, number>; description?: string }, tenantId: string): Promise<MLModel> {
    const existingModels = Array.from(models.values()).filter((m) => m.name === input.name && m.tenantId === tenantId);
    const version = existingModels.length > 0 ? Math.max(...existingModels.map((m) => m.version)) + 1 : 1;

    const model: MLModel = {
      id: uuidv4(), tenantId, name: input.name, version,
      experimentId: input.experimentId, status: 'draft',
      artifactPath: input.artifactPath, metrics: input.metrics,
      description: input.description,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    models.set(model.id, model);
    return model;
  }

  async listModels(tenantId: string, params?: { status?: string }): Promise<MLModel[]> {
    let result = Array.from(models.values()).filter((m) => m.tenantId === tenantId);
    if (params?.status) result = result.filter((m) => m.status === params.status);
    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getModel(id: string): Promise<MLModel | undefined> {
    return models.get(id);
  }

  async updateModelStatus(id: string, status: MLModel['status']): Promise<MLModel | undefined> {
    const model = models.get(id);
    if (!model) return undefined;
    model.status = status;
    model.updatedAt = new Date().toISOString();
    models.set(id, model);
    return model;
  }

  async deployModel(id: string, tenantId: string, input?: { endpoint?: string }): Promise<MLModel | undefined> {
    const model = models.get(id);
    if (!model || model.tenantId !== tenantId) return undefined;
    model.status = 'production';
    model.deployedEndpoint = input?.endpoint || `http://mlops-model-serving.internal/${model.name}-v${model.version}`;
    model.updatedAt = new Date().toISOString();
    models.set(id, model);
    return model;
  }

  // ==================== Training Jobs ====================

  async createTrainingJob(input: { experimentId?: string; dataset?: string; config?: Record<string, any> }, tenantId: string): Promise<TrainingJob> {
    const job: TrainingJob = {
      id: uuidv4(), tenantId, experimentId: input.experimentId,
      status: 'pending', dataset: input.dataset, config: input.config,
      createdAt: new Date().toISOString(),
    };
    trainingJobs.set(job.id, job);
    return job;
  }

  async listTrainingJobs(tenantId: string, params?: { status?: string }): Promise<TrainingJob[]> {
    let result = Array.from(trainingJobs.values()).filter((j) => j.tenantId === tenantId);
    if (params?.status) result = result.filter((j) => j.status === params.status);
    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async updateJobStatus(id: string, status: TrainingJob['status']): Promise<TrainingJob | undefined> {
    const job = trainingJobs.get(id);
    if (!job) return undefined;
    job.status = status;
    if (status === 'running') job.startedAt = new Date().toISOString();
    if (status === 'completed' || status === 'failed') job.completedAt = new Date().toISOString();
    trainingJobs.set(id, job);
    return job;
  }

  // ==================== Metrics ====================

  async getMetrics(tenantId: string): Promise<MLOpsMetrics> {
    const allExps = Array.from(experiments.values()).filter((e) => e.tenantId === tenantId);
    const allModels = Array.from(models.values()).filter((m) => m.tenantId === tenantId);
    const allJobs = Array.from(trainingJobs.values()).filter((j) => j.tenantId === tenantId);

    return {
      totalExperiments: allExps.length,
      runningExperiments: allExps.filter((e) => e.status === 'running').length,
      completedExperiments: allExps.filter((e) => e.status === 'completed').length,
      failedExperiments: allExps.filter((e) => e.status === 'failed').length,
      totalModels: allModels.length,
      productionModels: allModels.filter((m) => m.status === 'production').length,
      totalJobs: allJobs.length,
      runningJobs: allJobs.filter((j) => j.status === 'running').length,
      failedJobs: allJobs.filter((j) => j.status === 'failed').length,
      recentExperiments: allExps.slice(0, 5),
      recentModels: allModels.slice(0, 5),
      recentJobs: allJobs.slice(0, 5),
    };
  }
}
