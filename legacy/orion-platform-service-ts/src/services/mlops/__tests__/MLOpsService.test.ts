/**
 * Comprehensive tests for MLOpsService
 * Covers: Experiments, Experiment Runs, Model Registry, Training Jobs, Metrics
 */

// Re-import fresh module in each beforeEach to reset module-level Maps
let MLOpsService: any;

const TENANT_A = 'tenant-a';
const TENANT_B = 'tenant-b';

beforeEach(() => {
  jest.resetModules();
  MLOpsService = require('../MLOpsService').MLOpsService;
});

// ==================== Experiments ====================

describe('MLOpsService', () => {
  describe('createExperiment', () => {
    it('should create an experiment with required fields', async () => {
      const svc = new MLOpsService();
      const exp = await svc.createExperiment({ name: 'exp-1' }, TENANT_A);

      expect(exp.id).toBeDefined();
      expect(exp.name).toBe('exp-1');
      expect(exp.tenantId).toBe(TENANT_A);
      expect(exp.status).toBe('draft');
      expect(exp.createdAt).toBeDefined();
    });

    it('should create an experiment with all optional fields', async () => {
      const svc = new MLOpsService();
      const exp = await svc.createExperiment(
        {
          name: 'exp-full',
          project: 'ml-project',
          modelType: 'classification',
          description: 'A test experiment',
          hyperparams: { lr: 0.01, epochs: 10 },
        },
        TENANT_A,
      );

      expect(exp.project).toBe('ml-project');
      expect(exp.modelType).toBe('classification');
      expect(exp.description).toBe('A test experiment');
      expect(exp.hyperparams).toEqual({ lr: 0.01, epochs: 10 });
    });

    it('should assign unique ids to different experiments', async () => {
      const svc = new MLOpsService();
      const exp1 = await svc.createExperiment({ name: 'exp-1' }, TENANT_A);
      const exp2 = await svc.createExperiment({ name: 'exp-2' }, TENANT_A);

      expect(exp1.id).not.toBe(exp2.id);
    });
  });

  describe('listExperiments', () => {
    it('should list experiments for a tenant', async () => {
      const svc = new MLOpsService();
      await svc.createExperiment({ name: 'exp-1' }, TENANT_A);
      await svc.createExperiment({ name: 'exp-2' }, TENANT_A);
      await svc.createExperiment({ name: 'exp-other' }, TENANT_B);

      const result = await svc.listExperiments(TENANT_A);
      expect(result).toHaveLength(2);
      expect(result.every((e: any) => e.tenantId === TENANT_A)).toBe(true);
    });

    it('should return empty array when no experiments exist', async () => {
      const svc = new MLOpsService();
      const result = await svc.listExperiments(TENANT_A);
      expect(result).toEqual([]);
    });

    it('should filter by status', async () => {
      const svc = new MLOpsService();
      const exp1 = await svc.createExperiment({ name: 'draft-exp' }, TENANT_A);
      const exp2 = await svc.createExperiment({ name: 'running-exp' }, TENANT_A);
      await svc.updateExperimentStatus(exp2.id, 'running');

      const drafts = await svc.listExperiments(TENANT_A, { status: 'draft' });
      expect(drafts).toHaveLength(1);
      expect(drafts[0].name).toBe('draft-exp');

      const running = await svc.listExperiments(TENANT_A, { status: 'running' });
      expect(running).toHaveLength(1);
      expect(running[0].name).toBe('running-exp');
    });

    it('should filter by project', async () => {
      const svc = new MLOpsService();
      await svc.createExperiment({ name: 'exp-a', project: 'project-x' }, TENANT_A);
      await svc.createExperiment({ name: 'exp-b', project: 'project-y' }, TENANT_A);
      await svc.createExperiment({ name: 'exp-c' }, TENANT_A);

      const result = await svc.listExperiments(TENANT_A, { project: 'project-x' });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('exp-a');
    });

    it('should sort by createdAt descending', async () => {
      const svc = new MLOpsService();
      const exp1 = await svc.createExperiment({ name: 'first' }, TENANT_A);
      // Small delay to ensure different timestamps
      await new Promise((r) => setTimeout(r, 10));
      const exp2 = await svc.createExperiment({ name: 'second' }, TENANT_A);

      const result = await svc.listExperiments(TENANT_A);
      expect(result[0].name).toBe('second');
      expect(result[1].name).toBe('first');
    });
  });

  describe('getExperiment', () => {
    it('should return an experiment by id', async () => {
      const svc = new MLOpsService();
      const created = await svc.createExperiment({ name: 'exp-1' }, TENANT_A);
      const found = await svc.getExperiment(created.id);

      expect(found).toBeDefined();
      expect(found!.id).toBe(created.id);
      expect(found!.name).toBe('exp-1');
    });

    it('should return undefined for non-existent id', async () => {
      const svc = new MLOpsService();
      const found = await svc.getExperiment('non-existent-id');
      expect(found).toBeUndefined();
    });
  });

  describe('updateExperiment', () => {
    it('should update experiment fields', async () => {
      const svc = new MLOpsService();
      const created = await svc.createExperiment({ name: 'old-name' }, TENANT_A);

      const updated = await svc.updateExperiment(
        created.id,
        { name: 'new-name', description: 'updated description' },
        TENANT_A,
      );

      expect(updated).toBeDefined();
      expect(updated!.name).toBe('new-name');
      expect(updated!.description).toBe('updated description');
      expect(updated!.updatedAt).toBeDefined();
    });

    it('should do partial update without overwriting unset fields', async () => {
      const svc = new MLOpsService();
      const created = await svc.createExperiment(
        { name: 'orig', project: 'my-project' },
        TENANT_A,
      );

      const updated = await svc.updateExperiment(created.id, { name: 'changed' }, TENANT_A);

      expect(updated!.name).toBe('changed');
      expect(updated!.project).toBe('my-project');
    });

    it('should return undefined for non-existent experiment', async () => {
      const svc = new MLOpsService();
      const result = await svc.updateExperiment('fake-id', { name: 'x' }, TENANT_A);
      expect(result).toBeUndefined();
    });

    it('should return undefined when tenant does not match', async () => {
      const svc = new MLOpsService();
      const created = await svc.createExperiment({ name: 'exp-1' }, TENANT_A);

      const result = await svc.updateExperiment(created.id, { name: 'hack' }, TENANT_B);
      expect(result).toBeUndefined();
    });
  });

  describe('deleteExperiment', () => {
    it('should delete an experiment', async () => {
      const svc = new MLOpsService();
      const created = await svc.createExperiment({ name: 'to-delete' }, TENANT_A);

      const deleted = await svc.deleteExperiment(created.id, TENANT_A);
      expect(deleted).toBe(true);

      const found = await svc.getExperiment(created.id);
      expect(found).toBeUndefined();
    });

    it('should return false for non-existent experiment', async () => {
      const svc = new MLOpsService();
      const result = await svc.deleteExperiment('fake-id', TENANT_A);
      expect(result).toBe(false);
    });

    it('should return false when tenant does not match', async () => {
      const svc = new MLOpsService();
      const created = await svc.createExperiment({ name: 'exp-1' }, TENANT_A);

      const result = await svc.deleteExperiment(created.id, TENANT_B);
      expect(result).toBe(false);
      // Verify it still exists
      const found = await svc.getExperiment(created.id);
      expect(found).toBeDefined();
    });
  });

  describe('updateExperimentStatus', () => {
    it('should update status to running and set startedAt', async () => {
      const svc = new MLOpsService();
      const created = await svc.createExperiment({ name: 'exp-1' }, TENANT_A);

      const updated = await svc.updateExperimentStatus(created.id, 'running');

      expect(updated).toBeDefined();
      expect(updated!.status).toBe('running');
      expect(updated!.startedAt).toBeDefined();
    });

    it('should update status to completed and set completedAt', async () => {
      const svc = new MLOpsService();
      const created = await svc.createExperiment({ name: 'exp-1' }, TENANT_A);
      await svc.updateExperimentStatus(created.id, 'running');

      const completed = await svc.updateExperimentStatus(created.id, 'completed');

      expect(completed!.status).toBe('completed');
      expect(completed!.completedAt).toBeDefined();
    });

    it('should update status to failed and set completedAt', async () => {
      const svc = new MLOpsService();
      const created = await svc.createExperiment({ name: 'exp-1' }, TENANT_A);

      const failed = await svc.updateExperimentStatus(created.id, 'failed');

      expect(failed!.status).toBe('failed');
      expect(failed!.completedAt).toBeDefined();
    });

    it('should return undefined for non-existent experiment', async () => {
      const svc = new MLOpsService();
      const result = await svc.updateExperimentStatus('fake-id', 'running');
      expect(result).toBeUndefined();
    });
  });

  // ==================== Experiment Runs ====================

  describe('Experiment Runs', () => {
    describe('createExperimentRun', () => {
      it('should create a run with iteration 1', async () => {
        const svc = new MLOpsService();
        const exp = await svc.createExperiment({ name: 'exp-1' }, TENANT_A);

        const run = await svc.createExperimentRun(exp.id, TENANT_A);

        expect(run.id).toBeDefined();
        expect(run.experimentId).toBe(exp.id);
        expect(run.tenantId).toBe(TENANT_A);
        expect(run.iteration).toBe(1);
        expect(run.status).toBe('running');
        expect(run.startedAt).toBeDefined();
      });

      it('should increment iteration for subsequent runs', async () => {
        const svc = new MLOpsService();
        const exp = await svc.createExperiment({ name: 'exp-1' }, TENANT_A);

        const run1 = await svc.createExperimentRun(exp.id, TENANT_A);
        const run2 = await svc.createExperimentRun(exp.id, TENANT_A);
        const run3 = await svc.createExperimentRun(exp.id, TENANT_A);

        expect(run1.iteration).toBe(1);
        expect(run2.iteration).toBe(2);
        expect(run3.iteration).toBe(3);
      });
    });

    describe('getExperimentRuns', () => {
      it('should return runs for an experiment filtered by tenant', async () => {
        const svc = new MLOpsService();
        const exp = await svc.createExperiment({ name: 'exp-1' }, TENANT_A);
        await svc.createExperimentRun(exp.id, TENANT_A);
        await svc.createExperimentRun(exp.id, TENANT_A);

        const runs = await svc.getExperimentRuns(exp.id, TENANT_A);
        expect(runs).toHaveLength(2);
      });

      it('should not return runs from another tenant', async () => {
        const svc = new MLOpsService();
        const exp = await svc.createExperiment({ name: 'exp-1' }, TENANT_A);
        await svc.createExperimentRun(exp.id, TENANT_A);

        const runs = await svc.getExperimentRuns(exp.id, TENANT_B);
        expect(runs).toHaveLength(0);
      });

      it('should return empty array for experiment with no runs', async () => {
        const svc = new MLOpsService();
        const exp = await svc.createExperiment({ name: 'exp-1' }, TENANT_A);

        const runs = await svc.getExperimentRuns(exp.id, TENANT_A);
        expect(runs).toEqual([]);
      });
    });

    describe('updateExperimentRunStatus', () => {
      it('should update run status and attach metrics', async () => {
        const svc = new MLOpsService();
        const exp = await svc.createExperiment({ name: 'exp-1' }, TENANT_A);
        const run = await svc.createExperimentRun(exp.id, TENANT_A);

        const updated = await svc.updateExperimentRunStatus(run.id, 'completed', {
          accuracy: 0.95,
          loss: 0.05,
        });

        expect(updated).toBeDefined();
        expect(updated!.status).toBe('completed');
        expect(updated!.metrics).toEqual({ accuracy: 0.95, loss: 0.05 });
        expect(updated!.completedAt).toBeDefined();
      });

      it('should not set completedAt for running status', async () => {
        const svc = new MLOpsService();
        const exp = await svc.createExperiment({ name: 'exp-1' }, TENANT_A);
        const run = await svc.createExperimentRun(exp.id, TENANT_A);

        // Already running, update with metrics only
        const updated = await svc.updateExperimentRunStatus(run.id, 'running', { acc: 0.5 });
        expect(updated!.status).toBe('running');
        expect(updated!.completedAt).toBeUndefined();
      });

      it('should return undefined for non-existent run', async () => {
        const svc = new MLOpsService();
        const result = await svc.updateExperimentRunStatus('fake-run-id', 'completed');
        expect(result).toBeUndefined();
      });
    });
  });

  // ==================== Model Registry ====================

  describe('Model Registry', () => {
    describe('registerModel', () => {
      it('should register a model with version 1', async () => {
        const svc = new MLOpsService();
        const model = await svc.registerModel({ name: 'my-model' }, TENANT_A);

        expect(model.id).toBeDefined();
        expect(model.name).toBe('my-model');
        expect(model.version).toBe(1);
        expect(model.status).toBe('draft');
        expect(model.tenantId).toBe(TENANT_A);
        expect(model.createdAt).toBeDefined();
        expect(model.updatedAt).toBeDefined();
      });

      it('should auto-increment version for same model name', async () => {
        const svc = new MLOpsService();
        const v1 = await svc.registerModel({ name: 'my-model' }, TENANT_A);
        const v2 = await svc.registerModel({ name: 'my-model' }, TENANT_A);
        const v3 = await svc.registerModel({ name: 'my-model' }, TENANT_A);

        expect(v1.version).toBe(1);
        expect(v2.version).toBe(2);
        expect(v3.version).toBe(3);
      });

      it('should keep independent version tracks for different model names', async () => {
        const svc = new MLOpsService();
        const modelA = await svc.registerModel({ name: 'model-a' }, TENANT_A);
        const modelB = await svc.registerModel({ name: 'model-b' }, TENANT_A);
        const modelA2 = await svc.registerModel({ name: 'model-a' }, TENANT_A);

        expect(modelA.version).toBe(1);
        expect(modelB.version).toBe(1);
        expect(modelA2.version).toBe(2);
      });

      it('should register with optional fields', async () => {
        const svc = new MLOpsService();
        const model = await svc.registerModel(
          {
            name: 'full-model',
            experimentId: 'exp-123',
            artifactPath: '/models/full-model',
            metrics: { accuracy: 0.98 },
            description: 'Best model',
          },
          TENANT_A,
        );

        expect(model.experimentId).toBe('exp-123');
        expect(model.artifactPath).toBe('/models/full-model');
        expect(model.metrics).toEqual({ accuracy: 0.98 });
        expect(model.description).toBe('Best model');
      });
    });

    describe('listModels', () => {
      it('should list models for a tenant', async () => {
        const svc = new MLOpsService();
        await svc.registerModel({ name: 'model-1' }, TENANT_A);
        await svc.registerModel({ name: 'model-2' }, TENANT_A);
        await svc.registerModel({ name: 'model-other' }, TENANT_B);

        const result = await svc.listModels(TENANT_A);
        expect(result).toHaveLength(2);
        expect(result.every((m: any) => m.tenantId === TENANT_A)).toBe(true);
      });

      it('should filter models by status', async () => {
        const svc = new MLOpsService();
        const model = await svc.registerModel({ name: 'model-1' }, TENANT_A);
        await svc.updateModelStatus(model.id, 'staging');

        const drafts = await svc.listModels(TENANT_A, { status: 'draft' });
        expect(drafts).toHaveLength(0);

        const staging = await svc.listModels(TENANT_A, { status: 'staging' });
        expect(staging).toHaveLength(1);
      });

      it('should return empty array when no models exist', async () => {
        const svc = new MLOpsService();
        const result = await svc.listModels(TENANT_A);
        expect(result).toEqual([]);
      });
    });

    describe('getModel', () => {
      it('should return a model by id', async () => {
        const svc = new MLOpsService();
        const created = await svc.registerModel({ name: 'model-1' }, TENANT_A);
        const found = await svc.getModel(created.id);

        expect(found).toBeDefined();
        expect(found!.id).toBe(created.id);
      });

      it('should return undefined for non-existent model', async () => {
        const svc = new MLOpsService();
        const found = await svc.getModel('non-existent');
        expect(found).toBeUndefined();
      });
    });

    describe('updateModelStatus', () => {
      it('should update model status', async () => {
        const svc = new MLOpsService();
        const model = await svc.registerModel({ name: 'model-1' }, TENANT_A);

        const updated = await svc.updateModelStatus(model.id, 'staging');
        expect(updated).toBeDefined();
        expect(updated!.status).toBe('staging');
        expect(updated!.updatedAt).toBeDefined();
      });

      it('should return undefined for non-existent model', async () => {
        const svc = new MLOpsService();
        const result = await svc.updateModelStatus('fake-id', 'production');
        expect(result).toBeUndefined();
      });
    });

    describe('deployModel', () => {
      it('should deploy model with default endpoint', async () => {
        const svc = new MLOpsService();
        const model = await svc.registerModel({ name: 'my-model' }, TENANT_A);

        const deployed = await svc.deployModel(model.id, TENANT_A);

        expect(deployed).toBeDefined();
        expect(deployed!.status).toBe('production');
        expect(deployed!.deployedEndpoint).toBe(
          'http://mlops-model-serving.internal/my-model-v1',
        );
      });

      it('should deploy model with custom endpoint', async () => {
        const svc = new MLOpsService();
        const model = await svc.registerModel({ name: 'my-model' }, TENANT_A);

        const deployed = await svc.deployModel(model.id, TENANT_A, {
          endpoint: 'https://custom.endpoint.com/predict',
        });

        expect(deployed!.deployedEndpoint).toBe('https://custom.endpoint.com/predict');
        expect(deployed!.status).toBe('production');
      });

      it('should return undefined for non-existent model', async () => {
        const svc = new MLOpsService();
        const result = await svc.deployModel('fake-id', TENANT_A);
        expect(result).toBeUndefined();
      });

      it('should return undefined when tenant does not match', async () => {
        const svc = new MLOpsService();
        const model = await svc.registerModel({ name: 'model-1' }, TENANT_A);

        const result = await svc.deployModel(model.id, TENANT_B);
        expect(result).toBeUndefined();
      });
    });
  });

  // ==================== Training Jobs ====================

  describe('Training Jobs', () => {
    describe('createTrainingJob', () => {
      it('should create a training job with pending status', async () => {
        const svc = new MLOpsService();
        const job = await svc.createTrainingJob({}, TENANT_A);

        expect(job.id).toBeDefined();
        expect(job.tenantId).toBe(TENANT_A);
        expect(job.status).toBe('pending');
        expect(job.createdAt).toBeDefined();
      });

      it('should create a training job with optional fields', async () => {
        const svc = new MLOpsService();
        const job = await svc.createTrainingJob(
          {
            experimentId: 'exp-123',
            dataset: '/data/training.csv',
            config: { lr: 0.001, batch_size: 32 },
          },
          TENANT_A,
        );

        expect(job.experimentId).toBe('exp-123');
        expect(job.dataset).toBe('/data/training.csv');
        expect(job.config).toEqual({ lr: 0.001, batch_size: 32 });
      });
    });

    describe('listTrainingJobs', () => {
      it('should list jobs for a tenant', async () => {
        const svc = new MLOpsService();
        await svc.createTrainingJob({}, TENANT_A);
        await svc.createTrainingJob({}, TENANT_A);
        await svc.createTrainingJob({}, TENANT_B);

        const result = await svc.listTrainingJobs(TENANT_A);
        expect(result).toHaveLength(2);
      });

      it('should filter jobs by status', async () => {
        const svc = new MLOpsService();
        const job = await svc.createTrainingJob({}, TENANT_A);
        await svc.updateJobStatus(job.id, 'running');

        const pending = await svc.listTrainingJobs(TENANT_A, { status: 'pending' });
        expect(pending).toHaveLength(0);

        const running = await svc.listTrainingJobs(TENANT_A, { status: 'running' });
        expect(running).toHaveLength(1);
      });

      it('should return empty array when no jobs exist', async () => {
        const svc = new MLOpsService();
        const result = await svc.listTrainingJobs(TENANT_A);
        expect(result).toEqual([]);
      });

      it('should sort jobs by createdAt descending', async () => {
        const svc = new MLOpsService();
        const job1 = await svc.createTrainingJob({}, TENANT_A);
        await new Promise((r) => setTimeout(r, 10));
        const job2 = await svc.createTrainingJob({}, TENANT_A);

        const result = await svc.listTrainingJobs(TENANT_A);
        expect(result[0].id).toBe(job2.id);
        expect(result[1].id).toBe(job1.id);
      });
    });

    describe('updateJobStatus', () => {
      it('should update job status to running and set startedAt', async () => {
        const svc = new MLOpsService();
        const job = await svc.createTrainingJob({}, TENANT_A);

        const updated = await svc.updateJobStatus(job.id, 'running');

        expect(updated).toBeDefined();
        expect(updated!.status).toBe('running');
        expect(updated!.startedAt).toBeDefined();
      });

      it('should update job status to completed and set completedAt', async () => {
        const svc = new MLOpsService();
        const job = await svc.createTrainingJob({}, TENANT_A);
        await svc.updateJobStatus(job.id, 'running');

        const completed = await svc.updateJobStatus(job.id, 'completed');

        expect(completed!.status).toBe('completed');
        expect(completed!.completedAt).toBeDefined();
      });

      it('should update job status to failed and set completedAt', async () => {
        const svc = new MLOpsService();
        const job = await svc.createTrainingJob({}, TENANT_A);

        const failed = await svc.updateJobStatus(job.id, 'failed');

        expect(failed!.status).toBe('failed');
        expect(failed!.completedAt).toBeDefined();
      });

      it('should return undefined for non-existent job', async () => {
        const svc = new MLOpsService();
        const result = await svc.updateJobStatus('fake-id', 'running');
        expect(result).toBeUndefined();
      });
    });
  });

  // ==================== Metrics ====================

  describe('getMetrics', () => {
    it('should return zero metrics when nothing exists', async () => {
      const svc = new MLOpsService();
      const metrics = await svc.getMetrics(TENANT_A);

      expect(metrics.totalExperiments).toBe(0);
      expect(metrics.runningExperiments).toBe(0);
      expect(metrics.completedExperiments).toBe(0);
      expect(metrics.failedExperiments).toBe(0);
      expect(metrics.totalModels).toBe(0);
      expect(metrics.productionModels).toBe(0);
      expect(metrics.totalJobs).toBe(0);
      expect(metrics.runningJobs).toBe(0);
      expect(metrics.failedJobs).toBe(0);
      expect(metrics.recentExperiments).toEqual([]);
      expect(metrics.recentModels).toEqual([]);
      expect(metrics.recentJobs).toEqual([]);
    });

    it('should aggregate experiment counts by status', async () => {
      const svc = new MLOpsService();
      const exp1 = await svc.createExperiment({ name: 'draft' }, TENANT_A);
      const exp2 = await svc.createExperiment({ name: 'running' }, TENANT_A);
      const exp3 = await svc.createExperiment({ name: 'completed' }, TENANT_A);
      const exp4 = await svc.createExperiment({ name: 'failed' }, TENANT_A);
      await svc.updateExperimentStatus(exp2.id, 'running');
      await svc.updateExperimentStatus(exp3.id, 'completed');
      await svc.updateExperimentStatus(exp4.id, 'failed');

      const metrics = await svc.getMetrics(TENANT_A);

      expect(metrics.totalExperiments).toBe(4);
      expect(metrics.runningExperiments).toBe(1);
      expect(metrics.completedExperiments).toBe(1);
      expect(metrics.failedExperiments).toBe(1);
    });

    it('should aggregate model counts', async () => {
      const svc = new MLOpsService();
      const m1 = await svc.registerModel({ name: 'model-1' }, TENANT_A);
      const m2 = await svc.registerModel({ name: 'model-2' }, TENANT_A);
      await svc.deployModel(m1.id, TENANT_A);

      const metrics = await svc.getMetrics(TENANT_A);

      expect(metrics.totalModels).toBe(2);
      expect(metrics.productionModels).toBe(1);
    });

    it('should aggregate job counts by status', async () => {
      const svc = new MLOpsService();
      const j1 = await svc.createTrainingJob({}, TENANT_A);
      const j2 = await svc.createTrainingJob({}, TENANT_A);
      const j3 = await svc.createTrainingJob({}, TENANT_A);
      await svc.updateJobStatus(j1.id, 'running');
      await svc.updateJobStatus(j2.id, 'failed');

      const metrics = await svc.getMetrics(TENANT_A);

      expect(metrics.totalJobs).toBe(3);
      expect(metrics.runningJobs).toBe(1);
      expect(metrics.failedJobs).toBe(1);
    });

    it('should isolate metrics between tenants', async () => {
      const svc = new MLOpsService();
      await svc.createExperiment({ name: 'a-exp' }, TENANT_A);
      await svc.createExperiment({ name: 'b-exp' }, TENANT_B);
      await svc.createExperiment({ name: 'b-exp2' }, TENANT_B);

      const metricsA = await svc.getMetrics(TENANT_A);
      const metricsB = await svc.getMetrics(TENANT_B);

      expect(metricsA.totalExperiments).toBe(1);
      expect(metricsB.totalExperiments).toBe(2);
    });

    it('should include recent items limited to 5', async () => {
      const svc = new MLOpsService();
      for (let i = 0; i < 7; i++) {
        await svc.createExperiment({ name: `exp-${i}` }, TENANT_A);
        await svc.registerModel({ name: `model-${i}` }, TENANT_A);
        await svc.createTrainingJob({}, TENANT_A);
      }

      const metrics = await svc.getMetrics(TENANT_A);

      expect(metrics.recentExperiments).toHaveLength(5);
      expect(metrics.recentModels).toHaveLength(5);
      expect(metrics.recentJobs).toHaveLength(5);
      expect(metrics.totalExperiments).toBe(7);
    });
  });
});
