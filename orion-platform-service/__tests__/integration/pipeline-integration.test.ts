/**
 * Pipeline Integration Tests
 *
 * Full pipeline execution: create -> build -> test -> deploy
 * Uses mocked database and service layer to test end-to-end flow.
 */

import { PipelineService } from '@/services/pipeline/PipelineService';
import { PipelineRepository } from '@/services/pipeline/PipelineRepository';
import { PipelineRunService } from '@/services/pipeline/PipelineRunService';
import { PipelineStatus } from '@/models/Pipeline';

// ============================================================
// Mock repositories for integration testing
// ============================================================

class MockPipelineRepository {
  private pipelines: Map<string, any> = new Map();
  private runs: Map<string, any> = new Map();
  private stages: Map<string, any> = new Map();
  private executions: Map<string, any> = new Map();

  async create(input: any): Promise<any> {
    const id = `pipeline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date();
    const pipeline = {
      id,
      tenant_id: input.tenant_id || 'default',
      project_id: input.project_id || null,
      name: input.name,
      description: input.description || null,
      trigger_type: input.trigger_type || 'manual',
      config: input.config || {},
      status: 'active' as PipelineStatus,
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

  async findById(id: string): Promise<any | null> {
    return this.pipelines.get(id) || null;
  }

  async findAll(options?: any): Promise<any[]> {
    let results = Array.from(this.pipelines.values());
    if (options?.tenantId) results = results.filter(p => p.tenant_id === options.tenantId);
    return results;
  }

  async count(options?: any): Promise<number> {
    return this.findAll(options).length;
  }

  async update(id: string, input: any): Promise<any | null> {
    const pipeline = this.pipelines.get(id);
    if (!pipeline) return null;
    const updated = { ...pipeline, ...input, updated_at: new Date() };
    this.pipelines.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    return this.pipelines.delete(id);
  }

  async findByName(name: string): Promise<any | null> {
    for (const p of this.pipelines.values()) {
      if (p.name === name) return p;
    }
    return null;
  }

  async findVersions(_id: string): Promise<any[]> { return []; }
  async findStagesByPipeline(pipelineId: string): Promise<any[]> {
    return Array.from(this.stages.values()).filter(s => s.pipeline_id === pipelineId);
  }
  async createStage(pipelineId: string, input: any): Promise<any> {
    const id = `stage-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const stage = { id, pipeline_id: pipelineId, ...input, created_at: new Date() };
    this.stages.set(id, stage);
    return stage;
  }

  async createRun(input: any): Promise<any> {
    const id = `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const run = {
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

  async findRunById(id: string): Promise<any | null> {
    return this.runs.get(id) || null;
  }

  async updateRun(id: string, updates: any): Promise<any | null> {
    const run = this.runs.get(id);
    if (!run) return null;
    const updated = { ...run, ...updates };
    this.runs.set(id, updated);
    return updated;
  }

  async updateRunStatus(id: string, status: string, startedAt?: Date, completedAt?: Date, errorMessage?: string): Promise<any | null> {
    const run = this.runs.get(id);
    if (!run) return null;
    run.status = status;
    if (startedAt) run.started_at = startedAt;
    if (completedAt) run.completed_at = completedAt;
    if (errorMessage) run.error_message = errorMessage;
    if (completedAt && startedAt) run.duration_ms = completedAt.getTime() - startedAt.getTime();
    return run;
  }

  async findRunsByPipeline(pipelineId: string, options?: any): Promise<any[]> {
    let results = Array.from(this.runs.values()).filter(r => r.pipeline_id === pipelineId);
    const offset = options?.offset || 0;
    const limit = options?.limit || results.length;
    return results.slice(offset, offset + limit);
  }

  async countRuns(_pipelineId: string, _status?: string): Promise<number> { return 0; }

  async createStageExecution(runId: string, stageId: string | null, stageName: string): Promise<any> {
    const id = `exec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const exec = {
      id, run_id: runId, stage_id: stageId, stage_name: stageName,
      status: 'pending', started_at: null, completed_at: null,
      duration_ms: null, error_message: null, logs: null, created_at: new Date(),
    };
    this.executions.set(id, exec);
    return exec;
  }

  async findStageExecutions(runId: string): Promise<any[]> {
    return Array.from(this.executions.values()).filter(e => e.run_id === runId);
  }

  async updateStageExecutionStatus(id: string, status: string, startedAt?: Date, completedAt?: Date, errorMessage?: string): Promise<any | null> {
    const exec = this.executions.get(id);
    if (!exec) return null;
    exec.status = status;
    if (startedAt) exec.started_at = startedAt;
    if (completedAt) exec.completed_at = completedAt;
    if (errorMessage) exec.error_message = errorMessage;
    return exec;
  }

  async getPipelineStats(pipelineId: string): Promise<any> {
    const runs = Array.from(this.runs.values()).filter(r => r.pipeline_id === pipelineId);
    return {
      totalRuns: runs.length,
      successRuns: runs.filter(r => r.status === 'success').length,
      failedRuns: runs.filter(r => r.status === 'failed').length,
      runningRuns: runs.filter(r => r.status === 'running').length,
      avgDuration: 0,
    };
  }

  clear(): void {
    this.pipelines.clear();
    this.runs.clear();
    this.stages.clear();
    this.executions.clear();
  }
}

describe('Pipeline Integration - Full Execution Flow', () => {
  let pipelineRepo: MockPipelineRepository;
  let pipelineService: PipelineService;

  const validYaml = `
apiVersion: orion.io/v1
kind: Pipeline
metadata:
  name: integration-pipeline
  version: "1.0.0"
  description: Integration Test Pipeline
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
    - name: deploy
      runsOn: linux
      dependsOn: [test]
      steps:
        - name: deploy-staging
          uses: k8s/deploy@v1
          with:
            environment: staging
`;

  beforeEach(async () => {
    pipelineRepo = new MockPipelineRepository();
    pipelineService = new PipelineService(pipelineRepo as any);
  });

  afterEach(async () => {
    pipelineRepo.clear();
  });

  describe('E2E: Create Pipeline -> Trigger Run -> Track Status', () => {
    it('should create a pipeline and trigger a run', async () => {
      // Step 1: Create pipeline
      const pipeline = await pipelineService.create({
        tenant_id: 'tenant-1',
        name: 'e2e-pipeline',
        description: 'End-to-end test pipeline',
        yamlDefinition: validYaml,
        created_by: 'test-user',
      });

      expect(pipeline.id).toBeDefined();
      expect(pipeline.name).toBe('e2e-pipeline');
      expect(pipeline.status).toBe('active');

      // Step 2: Trigger run
      const run = await pipelineService.triggerRun(pipeline.id, {
        triggerType: 'manual',
        triggerBy: 'test-user',
      });

      expect(run.id).toBeDefined();
      expect(run.pipeline_id).toBe(pipeline.id);
      // Run status is 'running' (implementation starts immediately)
      expect(run.status === 'pending' || run.status === 'running').toBe(true);
    });

    it('should list pipelines and verify count', async () => {
      await pipelineService.create({
        tenant_id: 'tenant-1',
        name: 'pipeline-1',
        yamlDefinition: validYaml.replace('integration-pipeline', 'pipeline-1'),
      });
      await pipelineService.create({
        tenant_id: 'tenant-1',
        name: 'pipeline-2',
        yamlDefinition: validYaml.replace('integration-pipeline', 'pipeline-2'),
      });

      const pipelines = await pipelineService.list('tenant-1');
      expect(pipelines.length).toBeGreaterThanOrEqual(2);
    });

    it('should get pipeline by id after creation', async () => {
      const created = await pipelineService.create({
        tenant_id: 'tenant-1',
        name: 'findable-pipeline',
        yamlDefinition: validYaml.replace('integration-pipeline', 'findable-pipeline'),
      });

      const found = await pipelineService.getById(created.id);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
    });

    it('should trigger multiple runs for same pipeline', async () => {
      const pipeline = await pipelineService.create({
        tenant_id: 'tenant-1',
        name: 'multi-run-pipeline',
        yamlDefinition: validYaml.replace('integration-pipeline', 'multi-run-pipeline'),
      });

      const run1 = await pipelineService.triggerRun(pipeline.id);
      const run2 = await pipelineService.triggerRun(pipeline.id);

      expect(run1.id).not.toBe(run2.id);
      expect(run1.pipeline_id).toBe(pipeline.id);
      expect(run2.pipeline_id).toBe(pipeline.id);
    });

    it('should reject trigger for non-existent pipeline', async () => {
      await expect(pipelineService.triggerRun('non-existent-id'))
        .rejects
        .toThrow('Pipeline not found');
    });
  });

  describe('E2E: Pipeline Validation Flow', () => {
    it('should validate good YAML', async () => {
      const result = await pipelineService.validate(validYaml);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject YAML with missing stages', async () => {
      const badYaml = `
apiVersion: orion.io/v1
kind: Pipeline
metadata:
  name: bad
  version: "1.0.0"
spec: {}
`;
      const result = await pipelineService.validate(badYaml);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject YAML with invalid stage dependencies', async () => {
      const badDeps = `
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
    - name: deploy
      runsOn: linux
      dependsOn: [nonexistent-stage]
      steps:
        - name: deploy
          uses: k8s/deploy@v1
`;
      const result = await pipelineService.validate(badDeps);
      expect(result.valid).toBe(false);
    });
  });

  describe('E2E: Pipeline CRUD Operations', () => {
    it('should create, update, and delete pipeline', async () => {
      // Create
      const pipeline = await pipelineService.create({
        tenant_id: 'tenant-1',
        name: 'crud-pipeline',
        description: 'Original description',
        yamlDefinition: validYaml.replace('integration-pipeline', 'crud-pipeline'),
      });
      expect(pipeline.description).toBe('Original description');

      // Update
      const updated = await pipelineService.update(pipeline.id, {
        description: 'Updated description',
      });
      expect(updated?.description).toBe('Updated description');

      // Delete
      const deleted = await pipelineService.delete(pipeline.id);
      expect(deleted).toBe(true);

      // Verify deleted
      const found = await pipelineService.getById(pipeline.id);
      expect(found).toBeNull();
    });

    it('should update pipeline with new YAML definition', async () => {
      const pipeline = await pipelineService.create({
        tenant_id: 'tenant-1',
        name: 'yaml-update',
        yamlDefinition: validYaml.replace('integration-pipeline', 'yaml-update'),
      });

      const newYaml = validYaml.replace('integration-pipeline', 'yaml-update')
        .replace('version: "1.0.0"', 'version: "2.0.0"');
      const updated = await pipelineService.update(pipeline.id, {
        yamlDefinition: newYaml,
      });

      expect(updated).toBeDefined();
    });
  });

  describe('E2E: Pipeline Run Lifecycle', () => {
    it('should create pipeline, trigger run, and check status', async () => {
      const pipeline = await pipelineService.create({
        tenant_id: 'tenant-1',
        name: 'lifecycle-test',
        yamlDefinition: validYaml.replace('integration-pipeline', 'lifecycle-test'),
      });

      const run = await pipelineService.triggerRun(pipeline.id);
      // Run starts as 'pending' or 'running' (async execution starts immediately)
      expect(run.status === 'pending' || run.status === 'running').toBe(true);

      // After async execution completes, run should be 'success'
      // Wait for stages to complete (3 stages * ~100ms each)
      await new Promise(resolve => setTimeout(resolve, 500));

      const updatedRun = await pipelineService.getRun(run.id);
      expect(updatedRun.status).toBe('success');
    });

    it('should return run stats', async () => {
      const pipeline = await pipelineService.create({
        tenant_id: 'tenant-1',
        name: 'stats-test',
        yamlDefinition: validYaml.replace('integration-pipeline', 'stats-test'),
      });

      await pipelineService.triggerRun(pipeline.id);
      await pipelineService.triggerRun(pipeline.id);

      const stats = await pipelineService.getPipelineStats(pipeline.id);
      expect(stats.totalRuns).toBeGreaterThanOrEqual(2);
    });
  });
});
