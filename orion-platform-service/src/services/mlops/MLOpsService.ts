/**
 * MLOps Service (Phase 4 Batch 2)
 * Experiment tracking, model registry, training jobs, model deployment, metrics
 *
 * Uses PostgreSQL Repository with graceful degradation to in-memory Map when DB unavailable.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  MLOpsExperimentRepository,
  MLOpsExperimentRunRepository,
  MLOpsModelRepository,
  MLOpsTrainingJobRepository,
  type MLOpsExperimentEntity,
  type MLOpsExperimentRunEntity,
  type MLOpsModelEntity,
  type MLOpsTrainingJobEntity,
} from '../../repositories/MLOpsRepository';

// In-memory fallback storage
const experiments = new Map<string, MLOpsExperimentEntity>();
const experimentRuns = new Map<string, MLOpsExperimentRunEntity[]>();
const models = new Map<string, MLOpsModelEntity>();
const trainingJobs = new Map<string, MLOpsTrainingJobEntity>();

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

/** Convert entity to API response */
function entityToExperiment(e: MLOpsExperimentEntity): MLExperiment {
  return {
    id: e.id, tenantId: e.tenantId, name: e.name, project: e.project,
    status: e.status, modelType: e.modelType, description: e.description,
    metrics: e.metrics, hyperparams: e.hyperparams,
    startedAt: e.startedAt?.toISOString(),
    completedAt: e.completedAt?.toISOString(),
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt?.toISOString(),
  };
}

function entityToExperimentRun(e: MLOpsExperimentRunEntity): MLExperimentRun {
  return {
    id: e.id, experimentId: e.experimentId, tenantId: e.tenantId,
    iteration: e.iteration, metrics: e.metrics, status: e.status,
    startedAt: e.startedAt.toISOString(),
    completedAt: e.completedAt?.toISOString(),
  };
}

function entityToModel(m: MLOpsModelEntity): MLModel {
  return {
    id: m.id, tenantId: m.tenantId, name: m.name, version: m.version,
    experimentId: m.experimentId, status: m.status,
    artifactPath: m.artifactPath, metrics: m.metrics,
    description: m.description, deployedEndpoint: m.deployedEndpoint,
    createdAt: m.createdAt.toISOString(), updatedAt: m.updatedAt.toISOString(),
  };
}

function entityToJob(j: MLOpsTrainingJobEntity): TrainingJob {
  return {
    id: j.id, tenantId: j.tenantId, experimentId: j.experimentId,
    modelId: j.modelId, status: j.status, dataset: j.dataset,
    config: j.config, logs: j.logs,
    startedAt: j.startedAt?.toISOString(),
    completedAt: j.completedAt?.toISOString(),
    createdAt: j.createdAt.toISOString(),
  };
}

export class MLOpsService {
  private experimentRepo?: MLOpsExperimentRepository;
  private runRepo?: MLOpsExperimentRunRepository;
  private modelRepo?: MLOpsModelRepository;
  private jobRepo?: MLOpsTrainingJobRepository;

  constructor(db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    if (db) {
      this.experimentRepo = new MLOpsExperimentRepository(db);
      this.runRepo = new MLOpsExperimentRunRepository(db);
      this.modelRepo = new MLOpsModelRepository(db);
      this.jobRepo = new MLOpsTrainingJobRepository(db);
    }
  }

  // ==================== Experiments ====================

  async createExperiment(input: { name: string; project?: string; modelType?: string; description?: string; hyperparams?: Record<string, any> }, tenantId: string): Promise<MLExperiment> {
    const now = new Date();
    const exp: MLOpsExperimentEntity = {
      id: uuidv4(), tenantId, name: input.name, project: input.project,
      status: 'draft', modelType: input.modelType, description: input.description,
      hyperparams: input.hyperparams,
      createdAt: now,
    };
    if (this.experimentRepo) {
      const saved = await this.experimentRepo.create(exp);
      return entityToExperiment(saved);
    }
    experiments.set(exp.id, exp);
    return entityToExperiment(exp);
  }

  async listExperiments(tenantId: string, params?: { status?: string; project?: string }): Promise<MLExperiment[]> {
    if (this.experimentRepo) {
      const entities = await this.experimentRepo.findByTenant(tenantId, params);
      return entities.map(entityToExperiment);
    }
    let result = Array.from(experiments.values()).filter((e) => e.tenantId === tenantId);
    if (params?.status) result = result.filter((e) => e.status === params.status);
    if (params?.project) result = result.filter((e) => e.project === params.project);
    return result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).map(entityToExperiment);
  }

  async getExperiment(id: string): Promise<MLExperiment | undefined> {
    if (this.experimentRepo) {
      const entity = await this.experimentRepo.findById(id);
      return entity ? entityToExperiment(entity) : undefined;
    }
    const exp = experiments.get(id);
    return exp ? entityToExperiment(exp) : undefined;
  }

  async updateExperiment(id: string, input: { name?: string; project?: string; modelType?: string; description?: string; hyperparams?: Record<string, any> }, tenantId: string): Promise<MLExperiment | undefined> {
    if (this.experimentRepo) {
      const current = await this.experimentRepo.findById(id);
      if (!current || current.tenantId !== tenantId) return undefined;
      if (input.name !== undefined) current.name = input.name;
      if (input.project !== undefined) current.project = input.project;
      if (input.modelType !== undefined) current.modelType = input.modelType;
      if (input.description !== undefined) current.description = input.description;
      if (input.hyperparams !== undefined) current.hyperparams = input.hyperparams;
      current.updatedAt = new Date();
      const saved = await this.experimentRepo.update(id, current);
      return entityToExperiment(saved);
    }
    const exp = experiments.get(id);
    if (!exp || exp.tenantId !== tenantId) return undefined;
    if (input.name !== undefined) exp.name = input.name;
    if (input.project !== undefined) exp.project = input.project;
    if (input.modelType !== undefined) exp.modelType = input.modelType;
    if (input.description !== undefined) exp.description = input.description;
    if (input.hyperparams !== undefined) exp.hyperparams = input.hyperparams;
    exp.updatedAt = new Date();
    experiments.set(id, exp);
    return entityToExperiment(exp);
  }

  async deleteExperiment(id: string, tenantId: string): Promise<boolean> {
    if (this.experimentRepo) {
      if (this.runRepo) {
        const runs = await this.runRepo.findByExperiment(id);
        for (const run of runs) {
          // Runs will be cleaned up by FK CASCADE
        }
      }
      return await this.experimentRepo.deleteByExperimentId(id);
    }
    const exp = experiments.get(id);
    if (!exp || exp.tenantId !== tenantId) return false;
    const runs = experimentRuns.get(id) || [];
    for (const run of runs) {
      experimentRuns.delete(run.id);
    }
    experiments.delete(id);
    return true;
  }

  async updateExperimentStatus(id: string, status: MLExperiment['status']): Promise<MLExperiment | undefined> {
    if (this.experimentRepo) {
      const current = await this.experimentRepo.findById(id);
      if (!current) return undefined;
      current.status = status;
      if (status === 'running') current.startedAt = new Date();
      if (status === 'completed' || status === 'failed') current.completedAt = new Date();
      const saved = await this.experimentRepo.update(id, current);
      return entityToExperiment(saved);
    }
    const exp = experiments.get(id);
    if (!exp) return undefined;
    exp.status = status;
    if (status === 'running') exp.startedAt = new Date();
    if (status === 'completed' || status === 'failed') exp.completedAt = new Date();
    experiments.set(id, exp);
    return entityToExperiment(exp);
  }

  // ==================== Experiment Runs ====================

  async getExperimentRuns(experimentId: string, tenantId: string): Promise<MLExperimentRun[]> {
    if (this.runRepo) {
      const entities = await this.runRepo.findByExperiment(experimentId);
      return entities.filter(r => r.tenantId === tenantId).map(entityToExperimentRun);
    }
    return (experimentRuns.get(experimentId) || [])
      .filter((r) => r.tenantId === tenantId)
      .map(entityToExperimentRun);
  }

  async createExperimentRun(experimentId: string, tenantId: string): Promise<MLExperimentRun> {
    const now = new Date();
    if (this.runRepo) {
      const count = await this.runRepo.countByExperiment(experimentId);
      const run: Partial<MLOpsExperimentRunEntity> = {
        id: uuidv4(), experimentId, tenantId,
        iteration: count + 1,
        status: 'running',
        startedAt: now,
      };
      const saved = await this.runRepo.create(run);
      return entityToExperimentRun(saved);
    }
    const runs = experimentRuns.get(experimentId) || [];
    const run: MLOpsExperimentRunEntity = {
      id: uuidv4(), experimentId, tenantId,
      iteration: runs.length + 1,
      status: 'running',
      startedAt: now,
      createdAt: now,
    };
    runs.push(run);
    experimentRuns.set(experimentId, runs);
    return entityToExperimentRun(run);
  }

  async updateExperimentRunStatus(runId: string, status: MLExperimentRun['status'], metrics?: Record<string, number>): Promise<MLExperimentRun | undefined> {
    if (this.runRepo) {
      const now = status !== 'running' ? new Date() : undefined;
      const updated = await this.runRepo.updateStatus(runId, status, now, metrics);
      return updated ? entityToExperimentRun(updated) : undefined;
    }
    for (const [expId, runs] of Array.from(experimentRuns.entries())) {
      const run = runs.find((r) => r.id === runId);
      if (run) {
        run.status = status;
        if (metrics) run.metrics = metrics;
        if (status !== 'running') run.completedAt = new Date();
        return entityToExperimentRun(run);
      }
    }
    return undefined;
  }

  // ==================== Model Registry ====================

  async registerModel(input: { name: string; experimentId?: string; artifactPath?: string; metrics?: Record<string, number>; description?: string }, tenantId: string): Promise<MLModel> {
    if (this.modelRepo) {
      const existing = await this.modelRepo.findByNameAndTenant(input.name, tenantId);
      const version = existing.length > 0 ? Math.max(...existing.map((m) => m.version)) + 1 : 1;
      const model: Omit<MLOpsModelEntity, 'id' | 'created_at' | 'updated_at'> = {
        tenantId, name: input.name, version,
        experimentId: input.experimentId, status: 'draft',
        artifactPath: input.artifactPath, metrics: input.metrics,
        description: input.description,
        createdAt: new Date(), updatedAt: new Date(),
      };
      const saved = await this.modelRepo.create(model);
      return entityToModel(saved);
    }
    const existingModels = Array.from(models.values()).filter((m) => m.name === input.name && m.tenantId === tenantId);
    const version = existingModels.length > 0 ? Math.max(...existingModels.map((m) => m.version)) + 1 : 1;
    const model: MLOpsModelEntity = {
      id: uuidv4(), tenantId, name: input.name, version,
      experimentId: input.experimentId, status: 'draft',
      artifactPath: input.artifactPath, metrics: input.metrics,
      description: input.description,
      createdAt: new Date(), updatedAt: new Date(),
    };
    models.set(model.id, model);
    return entityToModel(model);
  }

  async listModels(tenantId: string, params?: { status?: string }): Promise<MLModel[]> {
    if (this.modelRepo) {
      const entities = await this.modelRepo.findByTenant(tenantId, params);
      return entities.map(entityToModel);
    }
    let result = Array.from(models.values()).filter((m) => m.tenantId === tenantId);
    if (params?.status) result = result.filter((m) => m.status === params.status);
    return result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).map(entityToModel);
  }

  async getModel(id: string): Promise<MLModel | undefined> {
    if (this.modelRepo) {
      const entity = await this.modelRepo.findById(id);
      return entity ? entityToModel(entity) : undefined;
    }
    const m = models.get(id);
    return m ? entityToModel(m) : undefined;
  }

  async updateModelStatus(id: string, status: MLModel['status']): Promise<MLModel | undefined> {
    if (this.modelRepo) {
      const updated = await this.modelRepo.updateStatus(id, status);
      return updated ? entityToModel(updated) : undefined;
    }
    const model = models.get(id);
    if (!model) return undefined;
    model.status = status;
    model.updatedAt = new Date();
    models.set(id, model);
    return entityToModel(model);
  }

  async deployModel(id: string, tenantId: string, input?: { endpoint?: string }): Promise<MLModel | undefined> {
    if (this.modelRepo) {
      const current = await this.modelRepo.findById(id);
      if (!current || current.tenantId !== tenantId) return undefined;
      const endpoint = input?.endpoint || `http://mlops-model-serving.internal/${current.name}-v${current.version}`;
      const updated = await this.modelRepo.deployModel(id, endpoint);
      return updated ? entityToModel(updated) : undefined;
    }
    const model = models.get(id);
    if (!model || model.tenantId !== tenantId) return undefined;
    model.status = 'production';
    model.deployedEndpoint = input?.endpoint || `http://mlops-model-serving.internal/${model.name}-v${model.version}`;
    model.updatedAt = new Date();
    models.set(id, model);
    return entityToModel(model);
  }

  // ==================== Training Jobs ====================

  async createTrainingJob(input: { experimentId?: string; dataset?: string; config?: Record<string, any> }, tenantId: string): Promise<TrainingJob> {
    const now = new Date();
    if (this.jobRepo) {
      const job: Partial<MLOpsTrainingJobEntity> = {
        id: uuidv4(), tenantId, experimentId: input.experimentId,
        status: 'pending', dataset: input.dataset, config: input.config,
        createdAt: now,
      };
      const saved = await this.jobRepo.create(job);
      return entityToJob(saved);
    }
    const job: MLOpsTrainingJobEntity = {
      id: uuidv4(), tenantId, experimentId: input.experimentId,
      status: 'pending', dataset: input.dataset, config: input.config,
      createdAt: now,
    };
    trainingJobs.set(job.id, job);
    return entityToJob(job);
  }

  async listTrainingJobs(tenantId: string, params?: { status?: string }): Promise<TrainingJob[]> {
    if (this.jobRepo) {
      const entities = await this.jobRepo.findByTenant(tenantId, params);
      return entities.map(entityToJob);
    }
    let result = Array.from(trainingJobs.values()).filter((j) => j.tenantId === tenantId);
    if (params?.status) result = result.filter((j) => j.status === params.status);
    return result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).map(entityToJob);
  }

  async updateJobStatus(id: string, status: TrainingJob['status']): Promise<TrainingJob | undefined> {
    if (this.jobRepo) {
      const now = new Date();
      const startedAt = status === 'running' ? now : undefined;
      const completedAt = (status === 'completed' || status === 'failed') ? now : undefined;
      const updated = await this.jobRepo.updateStatus(id, status, startedAt, completedAt);
      return updated ? entityToJob(updated) : undefined;
    }
    const job = trainingJobs.get(id);
    if (!job) return undefined;
    job.status = status;
    if (status === 'running') job.startedAt = new Date();
    if (status === 'completed' || status === 'failed') job.completedAt = new Date();
    trainingJobs.set(id, job);
    return entityToJob(job);
  }

  // ==================== Metrics ====================

  async getMetrics(tenantId: string): Promise<MLOpsMetrics> {
    let allExps: MLExperiment[] = [];
    let allModels: MLModel[] = [];
    let allJobs: TrainingJob[] = [];

    if (this.experimentRepo) {
      const expEntities = await this.experimentRepo.findByTenant(tenantId);
      allExps = expEntities.map(entityToExperiment);
    } else {
      allExps = Array.from(experiments.values())
        .filter((e) => e.tenantId === tenantId)
        .map(entityToExperiment);
    }

    if (this.modelRepo) {
      const modelEntities = await this.modelRepo.findByTenant(tenantId);
      allModels = modelEntities.map(entityToModel);
    } else {
      allModels = Array.from(models.values())
        .filter((m) => m.tenantId === tenantId)
        .map(entityToModel);
    }

    if (this.jobRepo) {
      const jobEntities = await this.jobRepo.findByTenant(tenantId);
      allJobs = jobEntities.map(entityToJob);
    } else {
      allJobs = Array.from(trainingJobs.values())
        .filter((j) => j.tenantId === tenantId)
        .map(entityToJob);
    }

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
