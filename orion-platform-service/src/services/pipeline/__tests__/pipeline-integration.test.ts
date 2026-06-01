/**
 * Pipeline Integration Tests
 *
 * Tests complete pipeline execution workflow:
 * - Pipeline creation with stages
 * - Pipeline run triggering
 * - Stage execution lifecycle
 * - Status transitions
 */

import { PipelineService, PipelineServiceError } from '../PipelineService';
import {
  PipelineRepository,
  Pipeline,
  PipelineStage,
  PipelineRun,
  StageExecution,
  CreatePipelineInput,
  CreatePipelineRunInput,
} from '../PipelineRepository';
import { v4 as uuidv4 } from 'uuid';

// Mock PipelineRepository for integration testing
class MockPipelineRepository implements PipelineRepository {
  private pipelines: Map<string, Pipeline> = new Map();
  private stages: Map<string, PipelineStage> = new Map();
  private runs: Map<string, PipelineRun> = new Map();
  private executions: Map<string, StageExecution> = new Map();

  // Pipeline CRUD
  async create(input: CreatePipelineInput): Promise<Pipeline> {
    const id = `pipeline-${uuidv4()}`;
    const now = new Date();
    const pipeline: Pipeline = {
      id,
      tenant_id: input.tenant_id,
      project_id: input.project_id || null,
      name: input.name,
      description: input.description || null,
      trigger_type: input.trigger_type || 'manual',
      config: input.config || {},
      status: input.status || 'active', // Accept status from input
      version: input.version || 1,
      yamlDefinition: input.yamlDefinition,
      spec: input.spec,
      created_at: now,
      updated_at: now,
      created_by: input.created_by || null,
    };
    this.pipelines.set(id, pipeline);
    return pipeline;
  }

  async findById(id: string): Promise<Pipeline | null> {
    return this.pipelines.get(id) || null;
  }

  async findAll(options?: {
    tenantId?: string;
    projectId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<Pipeline[]> {
    let results = Array.from(this.pipelines.values());

    if (options?.tenantId) {
      results = results.filter(p => p.tenant_id === options.tenantId);
    }
    if (options?.projectId) {
      results = results.filter(p => p.project_id === options.projectId);
    }
    if (options?.status) {
      results = results.filter(p => p.status === options.status);
    }

    const offset = options?.offset || 0;
    const limit = options?.limit || 100;
    return results.slice(offset, offset + limit);
  }

  async count(options?: { tenantId?: string; status?: string }): Promise<number> {
    let results = Array.from(this.pipelines.values());
    if (options?.tenantId) {
      results = results.filter(p => p.tenant_id === options.tenantId);
    }
    if (options?.status) {
      results = results.filter(p => p.status === options.status);
    }
    return results.length;
  }

  async update(id: string, input: Partial<Pipeline>): Promise<Pipeline | null> {
    const pipeline = this.pipelines.get(id);
    if (!pipeline) return null;

    const updated: Pipeline = {
      ...pipeline,
      ...input,
      updated_at: new Date(),
    };
    this.pipelines.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    return this.pipelines.delete(id);
  }

  async findVersions(pipelineId: string): Promise<Pipeline[]> {
    return Array.from(this.pipelines.values()).filter(p => p.id === pipelineId);
  }

  // Stage operations
  async createStage(pipelineId: string, input: Omit<PipelineStage, 'id' | 'pipeline_id' | 'created_at'>): Promise<PipelineStage> {
    const id = `stage-${uuidv4()}`;
    const stage: PipelineStage = {
      id,
      pipeline_id: pipelineId,
      name: input.name,
      type: input.type,
      config: input.config,
      order_index: input.order_index,
      timeout: input.timeout || null,
      retry_count: input.retry_count || 0,
      parallel: input.parallel || false,
      conditions: input.conditions || {},
      created_at: new Date(),
    };
    this.stages.set(id, stage);
    return stage;
  }

  async findStagesByPipeline(pipelineId: string): Promise<PipelineStage[]> {
    return Array.from(this.stages.values())
      .filter(s => s.pipeline_id === pipelineId)
      .sort((a, b) => a.order_index - b.order_index);
  }

  // Run operations
  async createRun(input: CreatePipelineRunInput): Promise<PipelineRun> {
    const id = `run-${uuidv4()}`;
    const run: PipelineRun = {
      id,
      tenant_id: input.tenant_id,
      pipeline_id: input.pipeline_id,
      trigger_type: input.trigger_type || 'manual',
      trigger_by: input.trigger_by || null,
      status: 'pending',
      config_snapshot: input.config_snapshot || {},
      started_at: null,
      completed_at: null,
      duration_ms: null,
      error_message: null,
      created_at: new Date(),
    };
    this.runs.set(id, run);
    return run;
  }

  async findRunById(id: string): Promise<PipelineRun | null> {
    return this.runs.get(id) || null;
  }

  async findRunsByPipeline(pipelineId: string, options?: { limit?: number; offset?: number }): Promise<PipelineRun[]> {
    let results = Array.from(this.runs.values())
      .filter(r => r.pipeline_id === pipelineId)
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime());

    const offset = options?.offset || 0;
    const limit = options?.limit || 100;
    return results.slice(offset, offset + limit);
  }

  async countRuns(pipelineId: string, status?: string): Promise<number> {
    let results = Array.from(this.runs.values()).filter(r => r.pipeline_id === pipelineId);
    if (status) {
      results = results.filter(r => r.status === status);
    }
    return results.length;
  }

  async updateRunStatus(id: string, status: string, startedAt?: Date, completedAt?: Date): Promise<PipelineRun | null> {
    const run = this.runs.get(id);
    if (!run) return null;

    const updated: PipelineRun = {
      ...run,
      status,
      started_at: startedAt || run.started_at,
      completed_at: completedAt || run.completed_at,
    };

    if (completedAt && run.started_at) {
      updated.duration_ms = completedAt.getTime() - run.started_at.getTime();
    }

    this.runs.set(id, updated);
    return updated;
  }

  // Stage execution operations
  async createExecution(input: Omit<StageExecution, 'id' | 'created_at'>): Promise<StageExecution> {
    const id = `exec-${uuidv4()}`;
    const execution: StageExecution = {
      id,
      run_id: input.run_id,
      stage_id: input.stage_id,
      stage_name: input.stage_name,
      status: input.status,
      started_at: input.started_at,
      completed_at: input.completed_at,
      duration_ms: input.duration_ms,
      error_message: input.error_message,
      logs: input.logs,
      created_at: new Date(),
    };
    this.executions.set(id, execution);
    return execution;
  }

  async findExecutionsByRun(runId: string): Promise<StageExecution[]> {
    return Array.from(this.executions.values())
      .filter(e => e.run_id === runId)
      .sort((a, b) => a.created_at.getTime() - b.created_at.getTime());
  }

  async updateExecutionStatus(id: string, status: string, completedAt?: Date, errorMessage?: string): Promise<StageExecution | null> {
    const execution = this.executions.get(id);
    if (!execution) return null;

    const updated: StageExecution = {
      ...execution,
      status,
      completed_at: completedAt || execution.completed_at,
      error_message: errorMessage || execution.error_message,
    };

    if (completedAt && execution.started_at) {
      updated.duration_ms = completedAt.getTime() - execution.started_at.getTime();
    }

    this.executions.set(id, updated);
    return updated;
  }
}

describe('Pipeline Integration Tests', () => {
  let service: PipelineService;
  let repository: MockPipelineRepository;

  beforeEach(async () => {
    repository = new MockPipelineRepository();
    service = new PipelineService(repository);
  });

  describe('Complete Pipeline Workflow', () => {
    it('should create pipeline with multiple stages and trigger run', async () => {
      // Step 1: Create pipeline
      const pipeline = await service.create({
        tenant_id: 'tenant-1',
        name: 'CI/CD Pipeline',
        description: 'Build, test, and deploy',
        trigger_type: 'manual',
        config: {
          environment: 'production',
        },
      });

      expect(pipeline).toBeDefined();
      expect(pipeline.id).toBeDefined();
      expect(pipeline.name).toBe('CI/CD Pipeline');
      expect(pipeline.status).toBe('active');

      // Step 2: Add stages
      const stage1 = await service.addStage(pipeline.id, {
        name: 'Build',
        type: 'build',
        config: { dockerfile: 'Dockerfile' },
        order_index: 1,
        timeout: 600,
      });

      expect(stage1).toBeDefined();
      expect(stage1.name).toBe('Build');
      expect(stage1.order_index).toBe(1);

      const stage2 = await service.addStage(pipeline.id, {
        name: 'Test',
        type: 'test',
        config: { framework: 'jest' },
        order_index: 2,
        timeout: 300,
      });

      expect(stage2).toBeDefined();
      expect(stage2.order_index).toBe(2);

      const stage3 = await service.addStage(pipeline.id, {
        name: 'Deploy',
        type: 'deploy',
        config: { environment: 'production' },
        order_index: 3,
        timeout: 900,
      });

      expect(stage3).toBeDefined();
      expect(stage3.order_index).toBe(3);

      // Step 3: Get all stages
      const stages = await service.getPipelineStages(pipeline.id);
      expect(stages).toHaveLength(3);
      expect(stages[0].name).toBe('Build');
      expect(stages[1].name).toBe('Test');
      expect(stages[2].name).toBe('Deploy');

      // Step 4: Trigger pipeline run
      const run = await service.triggerRun(pipeline.id, {
        trigger_type: 'manual',
        trigger_by: 'user-1',
      });

      expect(run).toBeDefined();
      expect(run.pipeline_id).toBe(pipeline.id);
      expect(run.status).toBe('pending');
      expect(run.trigger_type).toBe('manual');
      expect(run.trigger_by).toBe('user-1');

      // Step 5: Get run details
      const runDetails = await service.getRun(run.id);
      expect(runDetails).toBeDefined();
      expect(runDetails.id).toBe(run.id);

      // Step 6: List runs
      const runs = await service.listRuns(pipeline.id);
      expect(runs.data).toHaveLength(1);
      expect(runs.data[0].id).toBe(run.id);
      expect(runs.total).toBe(1);
    });

    it('should handle pipeline lifecycle (create, update, delete)', async () => {
      // Create
      const pipeline = await service.create({
        tenant_id: 'tenant-1',
        name: 'Test Pipeline',
      });

      expect(pipeline.status).toBe('active');

      // Update
      const updated = await service.update(pipeline.id, {
        name: 'Updated Pipeline',
        description: 'Updated description',
      });

      expect(updated).toBeDefined();
      expect(updated?.name).toBe('Updated Pipeline');
      expect(updated?.description).toBe('Updated description');

      // Delete
      const deleted = await service.delete(pipeline.id);
      expect(deleted).toBe(true);

      // Verify deletion
      const notFound = await service.getById(pipeline.id);
      expect(notFound).toBeNull();
    });

    it('should list pipelines with pagination', async () => {
      // Create multiple pipelines
      for (let i = 0; i < 15; i++) {
        await service.create({
          tenant_id: 'tenant-1',
          name: `Pipeline ${i + 1}`,
          status: i % 2 === 0 ? 'active' : 'inactive',
        });
      }

      // Test pagination
      const page1 = await service.listPipelines({ tenantId: 'tenant-1', page: 1, limit: 10 });
      expect(page1.data).toHaveLength(10);
      expect(page1.total).toBe(15);
      expect(page1.page).toBe(1);
      expect(page1.totalPages).toBe(2);

      const page2 = await service.listPipelines({ tenantId: 'tenant-1', page: 2, limit: 10 });
      expect(page2.data).toHaveLength(5);
      expect(page2.page).toBe(2);

      // Filter by status
      const activePipelines = await service.listPipelines({
        tenantId: 'tenant-1',
        status: 'active',
      });
      expect(activePipelines.total).toBe(8); // 0, 2, 4, 6, 8, 10, 12, 14
    });

    it('should not trigger run on inactive pipeline', async () => {
      const pipeline = await service.create({
        tenant_id: 'tenant-1',
        name: 'Inactive Pipeline',
      });

      // Update to inactive
      await service.update(pipeline.id, { status: 'inactive' });

      // Try to trigger run
      await expect(service.triggerRun(pipeline.id)).rejects.toThrow(PipelineServiceError);
      await expect(service.triggerRun(pipeline.id)).rejects.toThrow('Pipeline is not active');
    });

    it('should handle multiple runs for same pipeline', async () => {
      const pipeline = await service.create({
        tenant_id: 'tenant-1',
        name: 'Multi-Run Pipeline',
      });

      // Trigger multiple runs
      const run1 = await service.triggerRun(pipeline.id, { trigger_by: 'user-1' });
      const run2 = await service.triggerRun(pipeline.id, { trigger_by: 'user-2' });
      const run3 = await service.triggerRun(pipeline.id, { trigger_by: 'user-1' });

      // List all runs
      const runs = await service.listRuns(pipeline.id);
      expect(runs.data).toHaveLength(3);
      expect(runs.total).toBe(3);

      // Verify each run is independent
      expect(run1.id).not.toBe(run2.id);
      expect(run2.id).not.toBe(run3.id);
      expect(run1.trigger_by).toBe('user-1');
      expect(run2.trigger_by).toBe('user-2');
      expect(run3.trigger_by).toBe('user-1');
    });
  });

  describe('Error Handling', () => {
    it('should throw error when creating pipeline without tenant_id', async () => {
      await expect(
        service.createPipeline({
          name: 'Invalid Pipeline',
        } as any)
      ).rejects.toThrow(PipelineServiceError);
    });

    it('should throw error when creating pipeline without name', async () => {
      await expect(
        service.createPipeline({
          tenant_id: 'tenant-1',
          name: '',
        })
      ).rejects.toThrow(PipelineServiceError);
    });

    it('should throw error when getting non-existent pipeline', async () => {
      await expect(service.getPipeline('non-existent-id')).rejects.toThrow(PipelineServiceError);
      await expect(service.getPipeline('non-existent-id')).rejects.toThrow('Pipeline not found');
    });

    it('should throw error when triggering run on non-existent pipeline', async () => {
      await expect(service.triggerRun('non-existent-id')).rejects.toThrow(PipelineServiceError);
      await expect(service.triggerRun('non-existent-id')).rejects.toThrow('Pipeline not found');
    });

    it('should throw error when adding stage to non-existent pipeline', async () => {
      await expect(
        service.addStage('non-existent-id', {
          name: 'Test Stage',
          type: 'test',
          order_index: 1,
        })
      ).rejects.toThrow(PipelineServiceError);
    });
  });

  describe('Tenant Isolation', () => {
    it('should isolate pipelines by tenant', async () => {
      // Create pipelines for different tenants
      const tenant1Pipeline = await service.create({
        tenant_id: 'tenant-1',
        name: 'Tenant 1 Pipeline',
      });

      const tenant2Pipeline = await service.create({
        tenant_id: 'tenant-2',
        name: 'Tenant 2 Pipeline',
      });

      // List pipelines by tenant
      const tenant1Pipelines = await service.list('tenant-1');
      expect(tenant1Pipelines).toHaveLength(1);
      expect(tenant1Pipelines[0].id).toBe(tenant1Pipeline.id);

      const tenant2Pipelines = await service.list('tenant-2');
      expect(tenant2Pipelines).toHaveLength(1);
      expect(tenant2Pipelines[0].id).toBe(tenant2Pipeline.id);

      // Verify cross-tenant access doesn't happen
      const allPipelines = await service.listPipelines({ tenantId: 'tenant-1' });
      expect(allPipelines.data).toHaveLength(1);
      expect(allPipelines.data[0].tenant_id).toBe('tenant-1');
    });
  });

  describe('Pipeline Versioning', () => {
    it('should track pipeline versions', async () => {
      const pipeline = await service.create({
        tenant_id: 'tenant-1',
        name: 'Versioned Pipeline',
        version: 1,
      });

      expect(pipeline.version).toBe(1);

      // Update pipeline (in real implementation, this might create a new version)
      const updated = await service.update(pipeline.id, {
        name: 'Versioned Pipeline v2',
      });

      // Get versions
      const versions = await service.getVersions('tenant-1', pipeline.id);
      expect(versions).toBeDefined();
    });
  });
});