/**
 * DataPipelineService Tests
 *
 * Covers: pipeline CRUD, execution, scheduling, status, lineage.
 */

import { DataPipelineService } from '../DataPipelineService';
import { DataPipelineInput, PipelineStage } from '../types';

describe('DataPipelineService', () => {
  let service: DataPipelineService;

  const validStages: PipelineStage[] = [
    {
      id: 'stage-1',
      name: 'Extract Data',
      type: 'extract',
      config: { source: 'postgres', table: 'users' },
    },
    {
      id: 'stage-2',
      name: 'Transform',
      type: 'transform',
      config: { mapping: 'user_v2' },
      dependsOn: ['stage-1'],
    },
    {
      id: 'stage-3',
      name: 'Load to Warehouse',
      type: 'load',
      config: { target: 'snowflake', table: 'users_v2' },
      dependsOn: ['stage-2'],
    },
  ];

  const validInput: DataPipelineInput = {
    name: 'user-sync-pipeline',
    description: 'Sync user data to warehouse',
    stages: validStages,
  };

  beforeEach(() => {
    service = new DataPipelineService();
  });

  afterEach(() => {
    service.destroy();
  });

  // ==================== createPipeline ====================

  describe('createPipeline', () => {
    it('should create a pipeline in draft status (no schedule)', () => {
      const pipeline = service.createPipeline('tenant-1', validInput);

      expect(pipeline.id).toBeDefined();
      expect(pipeline.tenantId).toBe('tenant-1');
      expect(pipeline.name).toBe('user-sync-pipeline');
      expect(pipeline.description).toBe('Sync user data to warehouse');
      expect(pipeline.status).toBe('draft');
      expect(pipeline.stages).toHaveLength(3);
      expect(pipeline.schedule).toBeUndefined();
      expect(pipeline.createdAt).toBeDefined();
      expect(pipeline.updatedAt).toBeDefined();
    });

    it('should create a pipeline in scheduled status (with schedule)', () => {
      const inputWithSchedule: DataPipelineInput = {
        ...validInput,
        schedule: '*/5 * * * *',
      };

      const pipeline = service.createPipeline('tenant-1', inputWithSchedule);
      expect(pipeline.status).toBe('scheduled');
      expect(pipeline.schedule).toBe('*/5 * * * *');
    });

    it('should work without optional description', () => {
      const minimalInput: DataPipelineInput = {
        name: 'minimal-pipeline',
        stages: [{ id: 's1', name: 'Step 1', type: 'extract', config: {} }],
      };

      const pipeline = service.createPipeline('tenant-1', minimalInput);
      expect(pipeline.name).toBe('minimal-pipeline');
      expect(pipeline.description).toBeUndefined();
    });

    it('should create pipeline with empty stages', () => {
      const pipeline = service.createPipeline('tenant-1', {
        name: 'empty-pipeline',
        stages: [],
      });

      expect(pipeline.stages).toHaveLength(0);
    });
  });

  // ==================== getPipeline ====================

  describe('getPipeline', () => {
    it('should retrieve a pipeline by ID', () => {
      const created = service.createPipeline('tenant-1', validInput);
      const found = service.getPipeline(created.id);

      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
    });

    it('should return undefined for non-existent pipeline', () => {
      expect(service.getPipeline('non-existent')).toBeUndefined();
    });
  });

  // ==================== listPipelines ====================

  describe('listPipelines', () => {
    it('should list all pipelines for a tenant', () => {
      service.createPipeline('tenant-1', { ...validInput, name: 'pipeline-1', stages: [] });
      service.createPipeline('tenant-1', { ...validInput, name: 'pipeline-2', stages: [] });
      service.createPipeline('tenant-2', { ...validInput, name: 'pipeline-3', stages: [] });

      const tenant1Pipelines = service.listPipelines('tenant-1');
      expect(tenant1Pipelines.length).toBe(2);

      const tenant2Pipelines = service.listPipelines('tenant-2');
      expect(tenant2Pipelines.length).toBe(1);
    });

    it('should return empty array when no pipelines exist', () => {
      expect(service.listPipelines('tenant-empty')).toEqual([]);
    });

    it('should enforce tenant isolation', () => {
      service.createPipeline('tenant-1', { ...validInput, name: 'p1', stages: [] });

      const tenant2Pipelines = service.listPipelines('tenant-2');
      expect(tenant2Pipelines).toEqual([]);
    });
  });

  // ==================== updatePipeline ====================

  describe('updatePipeline', () => {
    it('should update pipeline name', () => {
      const created = service.createPipeline('tenant-1', validInput);

      const updated = service.updatePipeline(created.id, { name: 'updated-name' });
      expect(updated).toBeDefined();
      expect(updated?.name).toBe('updated-name');
    });

    it('should update pipeline description', () => {
      const created = service.createPipeline('tenant-1', validInput);

      const updated = service.updatePipeline(created.id, { description: 'New description' });
      expect(updated?.description).toBe('New description');
    });

    it('should update pipeline stages', () => {
      const created = service.createPipeline('tenant-1', validInput);

      const newStages: PipelineStage[] = [
        { id: 'new-1', name: 'New Stage', type: 'extract', config: {} },
      ];
      const updated = service.updatePipeline(created.id, { stages: newStages });
      expect(updated?.stages).toHaveLength(1);
      expect(updated?.stages[0].name).toBe('New Stage');
    });

    it('should update pipeline status', () => {
      const created = service.createPipeline('tenant-1', validInput);

      const updated = service.updatePipeline(created.id, { status: 'paused' });
      expect(updated?.status).toBe('paused');
    });

    it('should update updatedAt timestamp', () => {
      const created = service.createPipeline('tenant-1', validInput);
      const oldUpdatedAt = created.updatedAt;

      // Advance time to ensure timestamp changes
      jest.useFakeTimers();
      jest.advanceTimersByTime(1000);
      const updated = service.updatePipeline(created.id, { name: 'new-name' });
      jest.useRealTimers();

      expect(updated?.updatedAt).not.toBe(oldUpdatedAt);
    });

    it('should return undefined for non-existent pipeline', () => {
      const updated = service.updatePipeline('non-existent', { name: 'new-name' });
      expect(updated).toBeUndefined();
    });
  });

  // ==================== deletePipeline ====================

  describe('deletePipeline', () => {
    it('should delete an existing pipeline', () => {
      const created = service.createPipeline('tenant-1', validInput);

      const deleted = service.deletePipeline(created.id);
      expect(deleted).toBe(true);
      expect(service.getPipeline(created.id)).toBeUndefined();
    });

    it('should return false for non-existent pipeline', () => {
      expect(service.deletePipeline('non-existent')).toBe(false);
    });
  });

  // ==================== executePipeline ====================

  describe('executePipeline', () => {
    it('should execute a pipeline and complete all stages', async () => {
      const created = service.createPipeline('tenant-1', validInput);
      const execution = await service.executePipeline(created.id);

      expect(execution.id).toBeDefined();
      expect(execution.pipelineId).toBe(created.id);
      expect(execution.tenantId).toBe('tenant-1');
      expect(execution.status).toBe('completed');
      expect(execution.stagesResults).toHaveLength(3);
      expect(execution.startedAt).toBeDefined();
      expect(execution.completedAt).toBeDefined();
    });

    it('should execute stages sequentially', async () => {
      const created = service.createPipeline('tenant-1', validInput);
      const execution = await service.executePipeline(created.id);

      // All stages should be completed
      execution.stagesResults.forEach(result => {
        expect(result.status).toBe('completed');
        expect(result.recordsProcessed).toBeGreaterThan(0);
        expect(result.startedAt).toBeDefined();
        expect(result.completedAt).toBeDefined();
      });
    });

    it('should throw for non-existent pipeline', async () => {
      await expect(
        service.executePipeline('non-existent')
      ).rejects.toThrow('Pipeline non-existent not found');
    });

    it('should update pipeline status to completed after execution', async () => {
      const created = service.createPipeline('tenant-1', validInput);
      await service.executePipeline(created.id);

      const pipeline = service.getPipeline(created.id);
      expect(pipeline?.status).toBe('completed');
    });

    it('should respect stage dependencies', async () => {
      const stagesWithDeps: PipelineStage[] = [
        { id: 's1', name: 'First', type: 'extract', config: {} },
        { id: 's2', name: 'Second', type: 'transform', config: {}, dependsOn: ['s1'] },
        { id: 's3', name: 'Third', type: 'load', config: {}, dependsOn: ['s2'] },
      ];

      const created = service.createPipeline('tenant-1', {
        name: 'dep-pipeline',
        stages: stagesWithDeps,
      });

      const execution = await service.executePipeline(created.id);
      expect(execution.status).toBe('completed');
      execution.stagesResults.forEach(r => {
        expect(r.status).toBe('completed');
      });
    });

    it('should fail when dependency is not met', async () => {
      // Create a pipeline where a stage depends on a non-existent stage
      const stagesWithBadDep: PipelineStage[] = [
        { id: 's1', name: 'First', type: 'extract', config: {} },
        { id: 's2', name: 'Second', type: 'transform', config: {}, dependsOn: ['non-existent'] },
      ];

      const created = service.createPipeline('tenant-1', {
        name: 'bad-dep-pipeline',
        stages: stagesWithBadDep,
      });

      const execution = await service.executePipeline(created.id);
      expect(execution.status).toBe('failed');

      const failedStage = execution.stagesResults.find(r => r.stageId === 's2');
      expect(failedStage?.status).toBe('failed');
      expect(failedStage?.error).toBe('Dependency not met');
    });

    it('should record multiple executions for a pipeline', async () => {
      const created = service.createPipeline('tenant-1', {
        name: 'multi-exec',
        stages: [{ id: 's1', name: 'Step', type: 'extract', config: {} }],
      });

      await service.executePipeline(created.id);
      await service.executePipeline(created.id);

      const executions = service.getExecutions(created.id);
      expect(executions.length).toBe(2);
    });
  });

  // ==================== getExecutions ====================

  describe('getExecutions', () => {
    it('should return all executions for a pipeline', async () => {
      const created = service.createPipeline('tenant-1', {
        name: 'exec-test',
        stages: [{ id: 's1', name: 'Step', type: 'extract', config: {} }],
      });

      await service.executePipeline(created.id);
      await service.executePipeline(created.id);

      const executions = service.getExecutions(created.id);
      expect(executions.length).toBe(2);
    });

    it('should return empty array when no executions exist', () => {
      const created = service.createPipeline('tenant-1', {
        name: 'no-exec',
        stages: [{ id: 's1', name: 'Step', type: 'extract', config: {} }],
      });

      expect(service.getExecutions(created.id)).toEqual([]);
    });
  });

  // ==================== schedule/unschedule ====================

  describe('schedulePipeline', () => {
    it('should schedule a pipeline', () => {
      const created = service.createPipeline('tenant-1', {
        name: 'schedule-test',
        stages: [{ id: 's1', name: 'Step', type: 'extract', config: {} }],
      });

      const scheduled = service.schedulePipeline(created.id, '*/5 * * * *');
      expect(scheduled).toBeDefined();
      expect(scheduled?.status).toBe('scheduled');
      expect(scheduled?.schedule).toBe('*/5 * * * *');
    });

    it('should return undefined for non-existent pipeline', () => {
      const scheduled = service.schedulePipeline('non-existent', '*/5 * * * *');
      expect(scheduled).toBeUndefined();
    });
  });

  describe('unschedulePipeline', () => {
    it('should unschedule a scheduled pipeline', () => {
      const created = service.createPipeline('tenant-1', {
        name: 'unschedule-test',
        stages: [{ id: 's1', name: 'Step', type: 'extract', config: {} }],
        schedule: '*/5 * * * *',
      });

      service.unschedulePipeline(created.id);
      const pipeline = service.getPipeline(created.id);
      expect(pipeline?.status).toBe('draft');
      expect(pipeline?.schedule).toBeUndefined();
    });

    it('should not throw for non-existent pipeline', () => {
      expect(() => service.unschedulePipeline('non-existent')).not.toThrow();
    });
  });

  // ==================== getPipelineStatus ====================

  describe('getPipelineStatus', () => {
    it('should return pipeline with recent executions', async () => {
      const created = service.createPipeline('tenant-1', {
        name: 'status-test',
        stages: [{ id: 's1', name: 'Step', type: 'extract', config: {} }],
      });

      await service.executePipeline(created.id);
      await service.executePipeline(created.id);

      const status = service.getPipelineStatus(created.id);
      expect(status).toBeDefined();
      expect(status?.pipeline.id).toBe(created.id);
      expect(status?.recentExecutions.length).toBe(2);
    });

    it('should limit recent executions to 10', async () => {
      const created = service.createPipeline('tenant-1', {
        name: 'limit-test',
        stages: [{ id: 's1', name: 'Step', type: 'extract', config: {} }],
      });

      for (let i = 0; i < 15; i++) {
        await service.executePipeline(created.id);
      }

      const status = service.getPipelineStatus(created.id);
      expect(status?.recentExecutions.length).toBeLessThanOrEqual(10);
    });

    it('should return undefined for non-existent pipeline', () => {
      expect(service.getPipelineStatus('non-existent')).toBeUndefined();
    });
  });

  // ==================== getDataLineage ====================

  describe('getDataLineage', () => {
    it('should generate lineage with explicit dependencies', () => {
      const created = service.createPipeline('tenant-1', validInput);
      const lineage = service.getDataLineage(created.id);

      expect(lineage).toBeDefined();
      expect(lineage?.pipelineId).toBe(created.id);
      expect(lineage?.nodes).toHaveLength(3);
      expect(lineage?.edges).toHaveLength(2);

      // Node types should match stage types
      const sourceNode = lineage?.nodes.find(n => n.stageId === 'stage-1');
      expect(sourceNode?.type).toBe('source');

      const transformNode = lineage?.nodes.find(n => n.stageId === 'stage-2');
      expect(transformNode?.type).toBe('transform');

      const sinkNode = lineage?.nodes.find(n => n.stageId === 'stage-3');
      expect(sinkNode?.type).toBe('sink');
    });

    it('should create linear chain when no explicit dependencies', () => {
      const linearStages: PipelineStage[] = [
        { id: 's1', name: 'A', type: 'extract', config: {} },
        { id: 's2', name: 'B', type: 'transform', config: {} },
        { id: 's3', name: 'C', type: 'load', config: {} },
      ];

      const created = service.createPipeline('tenant-1', {
        name: 'linear',
        stages: linearStages,
      });

      const lineage = service.getDataLineage(created.id);
      expect(lineage?.edges).toHaveLength(2);
      expect(lineage?.edges[0].from).toBe('node_s1');
      expect(lineage?.edges[0].to).toBe('node_s2');
      expect(lineage?.edges[1].from).toBe('node_s2');
      expect(lineage?.edges[1].to).toBe('node_s3');
    });

    it('should return undefined for non-existent pipeline', () => {
      expect(service.getDataLineage('non-existent')).toBeUndefined();
    });

    it('should handle single stage pipeline (no edges)', () => {
      const created = service.createPipeline('tenant-1', {
        name: 'single-stage',
        stages: [{ id: 's1', name: 'Only', type: 'extract', config: {} }],
      });

      const lineage = service.getDataLineage(created.id);
      expect(lineage?.nodes).toHaveLength(1);
      expect(lineage?.edges).toHaveLength(0);
    });
  });

  // ==================== destroy ====================

  describe('destroy', () => {
    it('should clear all data', () => {
      service.createPipeline('tenant-1', {
        name: 'destroy-test',
        stages: [{ id: 's1', name: 'Step', type: 'extract', config: {} }],
        schedule: '*/5 * * * *',
      });

      service.destroy();
      expect(service.listPipelines('tenant-1')).toEqual([]);
    });
  });
});
