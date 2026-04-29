/**
 * PipelineService 单元测试
 */

import { PipelineService } from '@/services/pipeline/PipelineService';
import { PipelineRepository, Pipeline, CreatePipelineInput, UpdatePipelineInput, PipelineStage, PipelineRun, StageExecution, CreatePipelineRunInput } from '@/services/pipeline/PipelineRepository';
import { PipelineStatus } from '@/models/Pipeline';
import { v4 as uuidv4 } from 'uuid';

// 内存模拟 Repository
class MockPipelineRepository {
  private pipelines: Map<string, Pipeline> = new Map();
  private stages: Map<string, PipelineStage> = new Map();
  private runs: Map<string, PipelineRun> = new Map();
  private executions: Map<string, StageExecution> = new Map();

  async findById(id: string): Promise<Pipeline | null> {
    return this.pipelines.get(id) || null;
  }

  async findAll(options?: { tenantId?: string; projectId?: string; status?: string; limit?: number; offset?: number; name?: string }): Promise<Pipeline[]> {
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
    if (options?.name) {
      results = results.filter(p => p.name === options.name);
    }
    return results.slice(options?.offset || 0, (options?.offset || 0) + (options?.limit || results.length));
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

  async create(input: CreatePipelineInput): Promise<Pipeline> {
    const id = uuidv4();
    const now = new Date();

    // Parse YAML to extract spec if provided
    let spec: Record<string, any> | undefined;
    if (input.yamlDefinition) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const yamlModule = require('js-yaml');
        const parsed = yamlModule.load(input.yamlDefinition) as any;
        spec = parsed?.spec;
      } catch {
        // Keep spec undefined if YAML parsing fails
      }
    }

    const pipeline: Pipeline = {
      id,
      tenant_id: input.tenant_id || 'default',
      project_id: input.project_id || null,
      name: input.name,
      description: input.description || null,
      trigger_type: input.trigger_type || 'manual',
      config: input.config || {},
      status: 'active',
      version: input.version || 1,
      yamlDefinition: input.yamlDefinition,
      spec: spec || input.spec,
      created_at: now,
      updated_at: now,
      created_by: input.created_by || input.createdBy || null,
    };

    this.pipelines.set(id, pipeline);
    return pipeline;
  }

  async update(id: string, input: UpdatePipelineInput): Promise<Pipeline | null> {
    const pipeline = this.pipelines.get(id);
    if (!pipeline) return null;

    const updated = {
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

  async findByName(name: string, tenantId?: string): Promise<Pipeline | null> {
    for (const p of this.pipelines.values()) {
      if (p.name === name && (!tenantId || p.tenant_id === tenantId)) {
        return p;
      }
    }
    return null;
  }

  async findVersions(pipelineId: string): Promise<Pipeline[]> {
    return Array.from(this.pipelines.values()).filter(p => p.id === pipelineId);
  }

  // Stage methods
  async findStagesByPipeline(pipelineId: string): Promise<PipelineStage[]> {
    return Array.from(this.stages.values()).filter(s => s.pipeline_id === pipelineId);
  }

  async createStage(pipelineId: string, input: any): Promise<PipelineStage> {
    const id = uuidv4();
    const stage: PipelineStage = {
      id,
      pipeline_id: pipelineId,
      name: input.name,
      type: input.type,
      config: input.config || {},
      order_index: input.order_index,
      timeout: input.timeout,
      retry_count: input.retry_count || 0,
      parallel: input.parallel || false,
      conditions: input.conditions || {},
      created_at: new Date(),
    };
    this.stages.set(id, stage);
    return stage;
  }

  // Run methods
  async createRun(input: CreatePipelineRunInput): Promise<PipelineRun> {
    const id = uuidv4();
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

  async updateRun(id: string, updates: Partial<PipelineRun>): Promise<PipelineRun | null> {
    const run = this.runs.get(id);
    if (!run) return null;
    const updated = { ...run, ...updates };
    this.runs.set(id, updated);
    return updated;
  }

  async updateRunStatus(id: string, status: string, startedAt?: Date, completedAt?: Date, errorMessage?: string): Promise<PipelineRun | null> {
    const run = this.runs.get(id);
    if (!run) return null;
    const updated = {
      ...run,
      status,
      started_at: startedAt || run.started_at,
      completed_at: completedAt,
      error_message: errorMessage,
      duration_ms: completedAt && startedAt ? completedAt.getTime() - startedAt.getTime() : null,
    };
    this.runs.set(id, updated);
    return updated;
  }

  async findRunsByPipeline(pipelineId: string, options?: { limit?: number; offset?: number }): Promise<PipelineRun[]> {
    let results = Array.from(this.runs.values()).filter(r => r.pipeline_id === pipelineId);
    return results.slice(options?.offset || 0, (options?.offset || 0) + (options?.limit || results.length));
  }

  async countRuns(pipelineId: string, status?: string): Promise<number> {
    let results = Array.from(this.runs.values()).filter(r => r.pipeline_id === pipelineId);
    if (status) {
      results = results.filter(r => r.status === status);
    }
    return results.length;
  }

  // Stage execution methods
  async createStageExecution(runId: string, stageId: string | null, stageName: string): Promise<StageExecution> {
    const id = uuidv4();
    const execution: StageExecution = {
      id,
      run_id: runId,
      stage_id: stageId,
      stage_name: stageName,
      status: 'pending',
      started_at: null,
      completed_at: null,
      duration_ms: null,
      error_message: null,
      logs: null,
      created_at: new Date(),
    };
    this.executions.set(id, execution);
    return execution;
  }

  async findStageExecutions(runId: string): Promise<StageExecution[]> {
    return Array.from(this.executions.values()).filter(e => e.run_id === runId);
  }

  async updateStageExecutionStatus(id: string, status: string, startedAt?: Date, completedAt?: Date, errorMessage?: string): Promise<StageExecution | null> {
    const execution = this.executions.get(id);
    if (!execution) return null;
    const updated = {
      ...execution,
      status,
      started_at: startedAt || execution.started_at,
      completed_at: completedAt,
      error_message: errorMessage,
      duration_ms: completedAt && startedAt ? completedAt.getTime() - startedAt.getTime() : null,
    };
    this.executions.set(id, updated);
    return updated;
  }

  async getPipelineStats(pipelineId: string): Promise<{ totalRuns: number; successRuns: number; failedRuns: number; runningRuns: number; avgDuration: number }> {
    const runs = Array.from(this.runs.values()).filter(r => r.pipeline_id === pipelineId);
    return {
      totalRuns: runs.length,
      successRuns: runs.filter(r => r.status === 'success').length,
      failedRuns: runs.filter(r => r.status === 'failed').length,
      runningRuns: runs.filter(r => r.status === 'running').length,
      avgDuration: runs.reduce((sum, r) => sum + (r.duration_ms || 0), 0) / runs.length || 0,
    };
  }

  // Clear for testing
  clear(): void {
    this.pipelines.clear();
    this.stages.clear();
    this.runs.clear();
    this.executions.clear();
  }
}

describe('PipelineService', () => {
  let service: PipelineService;
  let mockRepository: MockPipelineRepository;

  const validPipelineYaml = `
apiVersion: orion.io/v1
kind: Pipeline
metadata:
  name: test-pipeline
  version: "1.0.0"
  description: Test Pipeline
spec:
  triggers:
    - type: api
  stages:
    - name: build
      runsOn: linux
      steps:
        - name: checkout
          uses: git/checkout@v1
        - name: compile
          uses: npm/run@v1
          with:
            command: build
    - name: test
      runsOn: linux
      dependsOn: [build]
      steps:
        - name: unit-test
          uses: npm/test@v1
  `;

  const invalidPipelineYaml = `
apiVersion: orion.io/v1
kind: Pipeline
metadata:
  name: invalid-pipeline
  version: "1.0.0"
spec:
  # Missing stages
  `;

  beforeEach(() => {
    mockRepository = new MockPipelineRepository();
    service = new PipelineService(mockRepository as any);
  });

  afterEach(() => {
    mockRepository.clear();
  });

  describe('create', () => {
    it('should create a valid pipeline', async () => {
      const pipeline = await service.create({
        tenant_id: 'tenant-001',
        name: 'test-pipeline',
        description: 'Test Pipeline',
        yamlDefinition: validPipelineYaml,
        created_by: 'test-user',
      });

      expect(pipeline.id).toBeDefined();
      expect(pipeline.name).toBe('test-pipeline');
      expect(pipeline.status).toBe('active');
      expect(pipeline.spec).toBeDefined();
    });

    it('should create pipeline with tenant_id', async () => {
      const pipeline = await service.create({
        tenant_id: 'tenant-001',
        name: 'tenant-pipeline',
        yamlDefinition: validPipelineYaml.replace('test-pipeline', 'tenant-pipeline'),
      });

      expect(pipeline.tenant_id).toBe('tenant-001');
    });
  });

  describe('getById', () => {
    it('should get pipeline by id', async () => {
      const created = await service.create({
        tenant_id: 'tenant-001',
        name: 'get-test-pipeline',
        yamlDefinition: validPipelineYaml.replace('test-pipeline', 'get-test-pipeline'),
      });

      const found = await service.getById(created.id);

      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
      expect(found?.spec).toBeDefined();
    });

    it('should return null for deleted pipeline', async () => {
      const created = await service.create({
        tenant_id: 'tenant-001',
        name: 'delete-test-pipeline',
        yamlDefinition: validPipelineYaml.replace('test-pipeline', 'delete-test-pipeline'),
      });

      await service.delete(created.id);

      const found = await service.getById(created.id);
      expect(found).toBeNull();
    });
  });

  describe('list', () => {
    it('should list all pipelines', async () => {
      await service.create({
        tenant_id: 'tenant-001',
        name: 'list-test-1',
        yamlDefinition: validPipelineYaml.replace('test-pipeline', 'list-test-1'),
      });

      await service.create({
        tenant_id: 'tenant-001',
        name: 'list-test-2',
        yamlDefinition: validPipelineYaml.replace('test-pipeline', 'list-test-2'),
      });

      const pipelines = await service.list('tenant-001');

      expect(pipelines.length).toBeGreaterThanOrEqual(2);
    });

    it('should return empty list when no repository', async () => {
      const emptyService = new PipelineService(null);
      const pipelines = await emptyService.list('tenant-001');
      expect(pipelines.length).toBe(0);
    });
  });

  describe('listPipelines', () => {
    it('should list pipelines with pagination', async () => {
      await service.create({
        tenant_id: 'tenant-001',
        name: 'paginated-test-1',
        yamlDefinition: validPipelineYaml.replace('test-pipeline', 'paginated-test-1'),
      });

      await service.create({
        tenant_id: 'tenant-001',
        name: 'paginated-test-2',
        yamlDefinition: validPipelineYaml.replace('test-pipeline', 'paginated-test-2'),
      });

      const result = await service.listPipelines({ tenantId: 'tenant-001', limit: 10 });

      expect(result.data.length).toBeGreaterThanOrEqual(2);
      expect(result.total).toBeGreaterThanOrEqual(2);
    });
  });

  describe('update', () => {
    it('should update pipeline description', async () => {
      const pipeline = await service.create({
        tenant_id: 'tenant-001',
        name: 'update-test',
        yamlDefinition: validPipelineYaml.replace('test-pipeline', 'update-test'),
      });

      const updated = await service.update(pipeline.id, {
        description: 'Updated description',
      });

      expect(updated?.description).toBe('Updated description');
    });
  });

  describe('delete', () => {
    it('should delete pipeline', async () => {
      const pipeline = await service.create({
        tenant_id: 'tenant-001',
        name: 'delete-final-test',
        yamlDefinition: validPipelineYaml.replace('test-pipeline', 'delete-final-test'),
      });

      const deleted = await service.delete(pipeline.id);
      expect(deleted).toBe(true);

      const found = await service.getById(pipeline.id);
      expect(found).toBeNull();
    });
  });

  describe('validate', () => {
    it('should validate correct pipeline YAML', async () => {
      const result = await service.validate(validPipelineYaml);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing stages', async () => {
      const result = await service.validate(invalidPipelineYaml);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should detect invalid stage dependencies', async () => {
      const yamlWithBadDeps = `
apiVersion: orion.io/v1
kind: Pipeline
metadata:
  name: bad-deps
  version: "1.0.0"
spec:
  stages:
    - name: build
      runsOn: linux
      steps:
        - name: checkout
          uses: git/checkout@v1
    - name: test
      runsOn: linux
      dependsOn: [nonexistent]
      steps:
        - name: unit-test
          uses: npm/test@v1
      `;

      const result = await service.validate(yamlWithBadDeps);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e: string) => e.includes('unknown stage'))).toBe(true);
    });
  });

  describe('triggerRun', () => {
    it('should trigger a new pipeline run', async () => {
      const pipeline = await service.create({
        tenant_id: 'tenant-001',
        name: 'run-test',
        yamlDefinition: validPipelineYaml.replace('test-pipeline', 'run-test'),
      });

      const run = await service.triggerRun(pipeline.id);

      expect(run.id).toBeDefined();
      expect(run.pipeline_id).toBe(pipeline.id);
      expect(run.status).toBe('pending');
    });

    it('should reject trigger for non-existent pipeline', async () => {
      await expect(
        service.triggerRun('non-existent-id')
      ).rejects.toThrow('Pipeline not found');
    });
  });

  describe('getRun', () => {
    it('should get run by id', async () => {
      const pipeline = await service.create({
        tenant_id: 'tenant-001',
        name: 'get-run-test',
        yamlDefinition: validPipelineYaml.replace('test-pipeline', 'get-run-test'),
      });

      const run = await service.triggerRun(pipeline.id);

      const found = await service.getRun(run.id);
      expect(found).toBeDefined();
      expect(found.id).toBe(run.id);
    });

    it('should throw for non-existent run', async () => {
      await expect(service.getRun('non-existent-run')).rejects.toThrow('Pipeline run not found');
    });
  });

  describe('cancelRun', () => {
    it('should cancel a pending run', async () => {
      const pipeline = await service.create({
        tenant_id: 'tenant-001',
        name: 'cancel-test',
        yamlDefinition: validPipelineYaml.replace('test-pipeline', 'cancel-test'),
      });

      const run = await service.triggerRun(pipeline.id);

      const cancelled = await service.cancelRun(run.id);
      expect(cancelled.status).toBe('cancelled');
    });
  });

  describe('getPipelineStats', () => {
    it('should return pipeline stats', async () => {
      const pipeline = await service.create({
        tenant_id: 'tenant-001',
        name: 'stats-test',
        yamlDefinition: validPipelineYaml.replace('test-pipeline', 'stats-test'),
      });

      const stats = await service.getPipelineStats(pipeline.id);
      expect(stats.totalRuns).toBeDefined();
      expect(stats.successRuns).toBeDefined();
      expect(stats.failedRuns).toBeDefined();
    });
  });
});