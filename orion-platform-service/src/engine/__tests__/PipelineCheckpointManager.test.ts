/**
 * PipelineCheckpointManager Tests
 *
 * Tests for the pipeline execution checkpoint manager using an in-memory
 * mock database. Covers Repository CRUD, serialization/deserialization,
 * save/load, cleanup, running checkpoint discovery, and orphaned run recovery.
 */

import { PipelineCheckpointManager, CheckpointData, RecoveryResult } from '../PipelineCheckpointManager';
import { PipelineCheckpointRepository } from '../../repositories/PipelineCheckpointRepository';
import { PipelineExecution } from '../PipelineEngine';
import { PipelineRun, PipelineRunStatus, TriggerType } from '../../models/PipelineRun';
import { Stage, StageStatus } from '../../models/Stage';

// ==================== In-Memory Mock DB ====================
// Simulates the PostgreSQL query interface for pipeline_checkpoints table.

class MockDB {
  private tables = new Map<string, any[]>();

  async query(text: string, params?: any[]): Promise<{ rows: any[]; rowCount: number | null }> {
    // INSERT / UPSERT
    if (text.includes('INSERT INTO pipeline_checkpoints')) {
      const row = {
        id: params![0],
        run_id: params![1],
        pipeline_id: params![2],
        checkpoint_data: typeof params![3] === 'string' ? JSON.parse(params![3]) : params![3],
        status: params![4],
        last_stage_name: params![5],
        last_task_name: params![6],
        created_at: new Date(),
        updated_at: new Date(),
      };
      let table = this.tables.get('pipeline_checkpoints') || [];
      const existing = table.find(r => r.run_id === row.run_id);
      if (existing) {
        Object.assign(existing, row);
        return { rows: [existing], rowCount: 1 };
      }
      table.push(row);
      this.tables.set('pipeline_checkpoints', table);
      return { rows: [row], rowCount: 1 };
    }

    // SELECT by run_id
    if (text.includes('SELECT * FROM pipeline_checkpoints WHERE run_id = $1')) {
      const table = this.tables.get('pipeline_checkpoints') || [];
      const found = table.filter(r => r.run_id === params![0]);
      return { rows: found, rowCount: found.length };
    }

    // SELECT by status
    if (text.includes('SELECT * FROM pipeline_checkpoints WHERE status = $1')) {
      const table = this.tables.get('pipeline_checkpoints') || [];
      const found = table.filter(r => r.status === params![0]);
      return { rows: found, rowCount: found.length };
    }

    // DELETE by run_id
    if (text.includes('DELETE FROM pipeline_checkpoints WHERE run_id = $1')) {
      const table = this.tables.get('pipeline_checkpoints') || [];
      const before = table.length;
      const filtered = table.filter(r => r.run_id !== params![0]);
      this.tables.set('pipeline_checkpoints', filtered);
      return { rows: [], rowCount: before - filtered.length };
    }

    return { rows: [], rowCount: 0 };
  }
}

// ==================== Test Helpers ====================

function createTestExecution(overrides?: {
  runId?: string;
  pipelineId?: string;
  stages?: Stage[];
  pendingStages?: string[];
  runningStages?: string[];
  completedStages?: string[];
  runStatus?: PipelineRunStatus;
}): PipelineExecution {
  const runId = overrides?.runId || 'run-1';
  const pipelineId = overrides?.pipelineId || 'pipe-1';
  const now = new Date();

  const stages = new Map<string, Stage>();
  const defaultStages: Stage[] = [
    {
      id: 'stage-1',
      runId,
      name: 'build',
      sequence: 0,
      status: StageStatus.SUCCESS,
      dependsOn: [],
      timeoutSeconds: 3600,
      retryCount: 0,
      maxRetries: 0,
      startedAt: now,
      completedAt: new Date(now.getTime() + 1000),
      durationMs: 1000,
      createdAt: now,
    },
    {
      id: 'stage-2',
      runId,
      name: 'test',
      sequence: 1,
      status: StageStatus.RUNNING,
      dependsOn: ['build'],
      timeoutSeconds: 3600,
      retryCount: 0,
      maxRetries: 0,
      startedAt: now,
      createdAt: now,
    },
    {
      id: 'stage-3',
      runId,
      name: 'deploy',
      sequence: 2,
      status: StageStatus.PENDING,
      dependsOn: ['test'],
      timeoutSeconds: 3600,
      retryCount: 0,
      maxRetries: 0,
      createdAt: now,
    },
  ];

  const stagesToUse = overrides?.stages || defaultStages;
  for (const s of stagesToUse) {
    stages.set(s.id, s);
  }

  const run: PipelineRun = {
    id: runId,
    pipelineId,
    pipelineVersion: '1',
    triggerType: TriggerType.MANUAL,
    triggerBy: 'user-1',
    status: overrides?.runStatus || PipelineRunStatus.RUNNING,
    startedAt: now,
    context: { branch: 'main' },
    createdAt: now,
    updatedAt: now,
  };

  return {
    run,
    stages,
    pendingStages: new Set(overrides?.pendingStages || ['stage-3']),
    runningStages: new Set(overrides?.runningStages || ['stage-2']),
    completedStages: new Set(overrides?.completedStages || ['stage-1']),
  };
}

// ==================== Tests ====================

describe('PipelineCheckpointManager', () => {
  let mockDB: MockDB;
  let repo: PipelineCheckpointRepository;
  let manager: PipelineCheckpointManager;

  beforeEach(() => {
    mockDB = new MockDB();
    repo = new PipelineCheckpointRepository(mockDB as any);
    manager = new PipelineCheckpointManager(repo);
  });

  // ==================== 1. PipelineCheckpointRepository CRUD ====================

  describe('PipelineCheckpointRepository CRUD (MockDB)', () => {
    test('saveCheckpoint inserts a new checkpoint record', async () => {
      const result = await repo.saveCheckpoint({
        run_id: 'run-1',
        pipeline_id: 'pipe-1',
        checkpoint_data: { stages: [] },
        status: 'running',
        last_stage_name: 'build',
      });

      expect(result.run_id).toBe('run-1');
      expect(result.pipeline_id).toBe('pipe-1');
      expect(result.status).toBe('running');
      expect(result.last_stage_name).toBe('build');
      expect(result.checkpoint_data).toEqual({ stages: [] });
    });

    test('saveCheckpoint upserts on conflict (same run_id)', async () => {
      await repo.saveCheckpoint({
        run_id: 'run-1',
        pipeline_id: 'pipe-1',
        checkpoint_data: { status: 'first' },
        status: 'running',
        last_stage_name: 'build',
      });

      const updated = await repo.saveCheckpoint({
        run_id: 'run-1',
        pipeline_id: 'pipe-1',
        checkpoint_data: { status: 'second' },
        status: 'running',
        last_stage_name: 'test',
      });

      expect(updated.last_stage_name).toBe('test');
      expect(updated.checkpoint_data).toEqual({ status: 'second' });
    });

    test('findByRunId returns the checkpoint for a given run', async () => {
      await repo.saveCheckpoint({
        run_id: 'run-1',
        pipeline_id: 'pipe-1',
        checkpoint_data: { data: 'test' },
        status: 'running',
      });

      const found = await repo.findByRunId('run-1');
      expect(found).not.toBeNull();
      expect(found!.run_id).toBe('run-1');
      expect(found!.checkpoint_data).toEqual({ data: 'test' });
    });

    test('findByRunId returns null for non-existent run', async () => {
      const found = await repo.findByRunId('nonexistent');
      expect(found).toBeNull();
    });

    test('findAllByStatus returns checkpoints matching status', async () => {
      await repo.saveCheckpoint({
        run_id: 'run-1',
        pipeline_id: 'pipe-1',
        checkpoint_data: {},
        status: 'running',
      });
      await repo.saveCheckpoint({
        run_id: 'run-2',
        pipeline_id: 'pipe-2',
        checkpoint_data: {},
        status: 'running',
      });
      await repo.saveCheckpoint({
        run_id: 'run-3',
        pipeline_id: 'pipe-1',
        checkpoint_data: {},
        status: 'success',
      });

      const running = await repo.findAllByStatus('running');
      expect(running.length).toBe(2);
      expect(running.map(r => r.run_id)).toContain('run-1');
      expect(running.map(r => r.run_id)).toContain('run-2');
    });

    test('deleteByRunId removes checkpoint and returns true', async () => {
      await repo.saveCheckpoint({
        run_id: 'run-1',
        pipeline_id: 'pipe-1',
        checkpoint_data: {},
        status: 'running',
      });

      const deleted = await repo.deleteByRunId('run-1');
      expect(deleted).toBe(true);

      const found = await repo.findByRunId('run-1');
      expect(found).toBeNull();
    });

    test('deleteByRunId returns false for non-existent run', async () => {
      const deleted = await repo.deleteByRunId('nonexistent');
      expect(deleted).toBe(false);
    });
  });

  // ==================== 2. saveCheckpoint ====================

  describe('saveCheckpoint', () => {
    test('saves checkpoint data for a running execution', async () => {
      const execution = createTestExecution();
      const result = await manager.saveCheckpoint(execution, 'build');

      expect(result).toBe(true);

      const record = await repo.findByRunId('run-1');
      expect(record).not.toBeNull();
      expect(record!.run_id).toBe('run-1');
      expect(record!.pipeline_id).toBe('pipe-1');
      expect(record!.status).toBe('running');
      expect(record!.last_stage_name).toBe('build');
    });

    test('serializes all stages into checkpoint data', async () => {
      const execution = createTestExecution();
      await manager.saveCheckpoint(execution);

      const record = await repo.findByRunId('run-1');
      const data = record!.checkpoint_data as CheckpointData;

      expect(data.stages.length).toBe(3);
      expect(data.pendingStages).toContain('stage-3');
      expect(data.runningStages).toContain('stage-2');
      expect(data.completedStages).toContain('stage-1');
      expect(data.checkpointVersion).toBe(1);
      expect(data.checkpointedAt).toBeDefined();
    });

    test('includes last_task_name when provided', async () => {
      const execution = createTestExecution();
      await manager.saveCheckpoint(execution, 'test', 'npm run test');

      const record = await repo.findByRunId('run-1');
      expect(record!.last_stage_name).toBe('test');
      expect(record!.last_task_name).toBe('npm run test');
    });

    test('returns false when repository not configured', async () => {
      const managerWithoutRepo = new PipelineCheckpointManager();
      const execution = createTestExecution();
      const result = await managerWithoutRepo.saveCheckpoint(execution);
      expect(result).toBe(false);
    });

    test('returns false on save failure', async () => {
      const brokenManager = new PipelineCheckpointManager(
        new PipelineCheckpointRepository({
          query: async () => { throw new Error('DB connection lost'); },
        } as any)
      );
      const execution = createTestExecution();
      const result = await brokenManager.saveCheckpoint(execution);
      expect(result).toBe(false);
    });
  });

  // ==================== 3. loadCheckpoint ====================

  describe('loadCheckpoint', () => {
    test('restores execution from saved checkpoint', async () => {
      const originalExecution = createTestExecution();
      await manager.saveCheckpoint(originalExecution, 'test', 'npm test');

      const restored = await manager.loadCheckpoint('run-1');

      expect(restored).not.toBeNull();
      expect(restored!.run.id).toBe('run-1');
      expect(restored!.run.pipelineId).toBe('pipe-1');
      expect(restored!.stages.size).toBe(3);
      expect(Array.from(restored!.pendingStages)).toEqual(['stage-3']);
      expect(Array.from(restored!.runningStages)).toEqual(['stage-2']);
      expect(Array.from(restored!.completedStages)).toEqual(['stage-1']);
    });

    test('restored stages have correct properties', async () => {
      const originalExecution = createTestExecution();
      await manager.saveCheckpoint(originalExecution);

      const restored = await manager.loadCheckpoint('run-1');
      const stage1 = restored!.stages.get('stage-1');

      expect(stage1?.name).toBe('build');
      expect(stage1?.status).toBe(StageStatus.SUCCESS);
      expect(stage1?.dependsOn).toEqual([]);
      expect(stage1?.sequence).toBe(0);
    });

    test('returns null when no checkpoint exists', async () => {
      const result = await manager.loadCheckpoint('nonexistent');
      expect(result).toBeNull();
    });

    test('returns null when repository not configured', async () => {
      const managerWithoutRepo = new PipelineCheckpointManager();
      const result = await managerWithoutRepo.loadCheckpoint('run-1');
      expect(result).toBeNull();
    });

    test('returns null on deserialization failure (invalid data)', async () => {
      // Manually insert a record with null checkpoint_data
      await mockDB.query(
        'INSERT INTO pipeline_checkpoints (id, run_id, pipeline_id, checkpoint_data, status, last_stage_name, last_task_name) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        ['cp-bad', 'run-bad', 'pipe-1', null, 'running', null, null]
      );

      const result = await manager.loadCheckpoint('run-bad');
      expect(result).toBeNull();
    });
  });

  // ==================== 4. cleanupCompleted ====================

  describe('cleanupCompleted', () => {
    test('removes checkpoint for given run', async () => {
      const execution = createTestExecution();
      await manager.saveCheckpoint(execution);

      const result = await manager.cleanupCompleted('run-1');
      expect(result).toBe(true);

      const record = await repo.findByRunId('run-1');
      expect(record).toBeNull();
    });

    test('returns false when repository not configured', async () => {
      const managerWithoutRepo = new PipelineCheckpointManager();
      const result = await managerWithoutRepo.cleanupCompleted('run-1');
      expect(result).toBe(false);
    });

    test('returns false on deletion error', async () => {
      const brokenManager = new PipelineCheckpointManager(
        new PipelineCheckpointRepository({
          query: async () => { throw new Error('DB error'); },
        } as any)
      );
      const result = await brokenManager.cleanupCompleted('run-1');
      expect(result).toBe(false);
    });
  });

  // ==================== 5. findRunningCheckpoints ====================

  describe('findRunningCheckpoints', () => {
    test('finds all checkpoints with running status', async () => {
      // Create three checkpoints
      await manager.saveCheckpoint(createTestExecution({ runId: 'run-1', runStatus: PipelineRunStatus.RUNNING }));
      await manager.saveCheckpoint(createTestExecution({ runId: 'run-2', runStatus: PipelineRunStatus.RUNNING }));

      // Overwrite run-1 checkpoint to be "success" status
      await mockDB.query(
        'INSERT INTO pipeline_checkpoints (id, run_id, pipeline_id, checkpoint_data, status, last_stage_name, last_task_name) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        ['cp-3', 'run-3', 'pipe-1', '{}', 'success', null, null]
      );

      const results = await manager.findRunningCheckpoints();

      // Only run-1 and run-2 should be running
      expect(results.length).toBe(2);
      const runIds = results.map(r => r.runId);
      expect(runIds).toContain('run-1');
      expect(runIds).toContain('run-2');
    });

    test('returns empty array when repository not configured', async () => {
      const managerWithoutRepo = new PipelineCheckpointManager();
      const results = await managerWithoutRepo.findRunningCheckpoints();
      expect(results).toEqual([]);
    });

    test('includes lastStageName and lastTaskName in results', async () => {
      await manager.saveCheckpoint(createTestExecution(), 'build', 'npm build');

      const results = await manager.findRunningCheckpoints();

      expect(results.length).toBe(1);
      expect(results[0].lastStageName).toBe('build');
      expect(results[0].lastTaskName).toBe('npm build');
    });

    test('returns empty array on DB error', async () => {
      const brokenManager = new PipelineCheckpointManager(
        new PipelineCheckpointRepository({
          query: async () => { throw new Error('DB connection lost'); },
        } as any)
      );

      const results = await brokenManager.findRunningCheckpoints();
      expect(results).toEqual([]);
    });
  });

  // ==================== 6. recoverOrphanedRuns ====================

  describe('recoverOrphanedRuns', () => {
    test('identifies and restores orphaned runs', async () => {
      const execution = createTestExecution({ runId: 'run-1', runStatus: PipelineRunStatus.RUNNING });
      await manager.saveCheckpoint(execution);

      const mockRunService = {
        getRun: async (id: string) => ({
          id: 'run-1',
          pipelineId: 'pipe-1',
          status: PipelineRunStatus.RUNNING,
        }),
        completeRun: async (id: string, status: PipelineRunStatus) => ({
          id,
          status,
        }),
      };

      const onRestored = jest.fn();
      const result = await manager.recoverOrphanedRuns(mockRunService, { onRestored });

      expect(result.recovered).toBe(1);
      expect(result.restored).toBe(1);
      expect(result.markedFailed).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(onRestored).toHaveBeenCalledTimes(1);
      expect(onRestored).toHaveBeenCalledWith(
        expect.objectContaining({
          run: expect.objectContaining({ id: 'run-1' }),
        })
      );
    });

    test('cleans up checkpoint when run completed elsewhere', async () => {
      await manager.saveCheckpoint(createTestExecution());

      const mockRunService = {
        getRun: async (id: string) => ({
          id,
          status: PipelineRunStatus.SUCCESS,
        }),
        completeRun: async (id: string, status: PipelineRunStatus) => ({ id, status }),
      };

      const result = await manager.recoverOrphanedRuns(mockRunService);

      expect(result.recovered).toBe(1);
      expect(result.restored).toBe(0);
      expect(result.markedFailed).toBe(0);
      expect(result.errors).toHaveLength(0);

      // Checkpoint should have been cleaned up
      const record = await repo.findByRunId('run-1');
      expect(record).toBeNull();
    });

    test('marks stale running runs as failed when cannot restore', async () => {
      // Insert a checkpoint with null data (cannot restore)
      await mockDB.query(
        'INSERT INTO pipeline_checkpoints (id, run_id, pipeline_id, checkpoint_data, status, last_stage_name, last_task_name) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        ['cp-stale', 'run-stale', 'pipe-1', null, 'running', 'build', null]
      );

      const completeRunCalls: Array<{ id: string; status: PipelineRunStatus }> = [];
      const mockRunService = {
        getRun: async (id: string) => ({
          id,
          status: PipelineRunStatus.RUNNING,
        }),
        completeRun: async (id: string, status: PipelineRunStatus) => {
          completeRunCalls.push({ id, status });
          return { id, status };
        },
      };

      const result = await manager.recoverOrphanedRuns(mockRunService, { markFailedIfStale: true });

      expect(result.recovered).toBe(1);
      expect(result.markedFailed).toBe(1);
      expect(result.restored).toBe(0);
      expect(completeRunCalls).toContainEqual({ id: 'run-stale', status: PipelineRunStatus.FAILED });
    });

    test('skips marking failed when markFailedIfStale is false', async () => {
      await mockDB.query(
        'INSERT INTO pipeline_checkpoints (id, run_id, pipeline_id, checkpoint_data, status, last_stage_name, last_task_name) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        ['cp-no-fail', 'run-nofail', 'pipe-1', null, 'running', 'build', null]
      );

      const mockRunService = {
        getRun: async (id: string) => ({
          id,
          status: PipelineRunStatus.RUNNING,
        }),
        completeRun: async (id: string, status: PipelineRunStatus) => ({ id, status }),
      };

      const result = await manager.recoverOrphanedRuns(mockRunService, { markFailedIfStale: false });

      expect(result.recovered).toBe(1);
      expect(result.markedFailed).toBe(0);
      expect(result.restored).toBe(0);
      expect(mockRunService.completeRun).not.toHaveBeenCalled();
    });

    test('cleans up checkpoint when run record does not exist', async () => {
      await manager.saveCheckpoint(createTestExecution());

      const mockRunService = {
        getRun: async (id: string) => null,
        completeRun: async (id: string, status: PipelineRunStatus) => ({ id, status }),
      };

      const result = await manager.recoverOrphanedRuns(mockRunService);

      expect(result.recovered).toBe(1);
      expect(result.restored).toBe(0);
      expect(result.markedFailed).toBe(0);

      const record = await repo.findByRunId('run-1');
      expect(record).toBeNull();
    });

    test('returns empty result when repository not configured', async () => {
      const managerWithoutRepo = new PipelineCheckpointManager();
      const result = await managerWithoutRepo.recoverOrphanedRuns({
        getRun: async (id: string) => null,
        completeRun: async (id: string, status: PipelineRunStatus) => null,
      });

      expect(result.recovered).toBe(0);
      expect(result.markedFailed).toBe(0);
      expect(result.restored).toBe(0);
    });

    test('handles recovery scan failure gracefully', async () => {
      const brokenManager = new PipelineCheckpointManager(
        new PipelineCheckpointRepository({
          query: async () => { throw new Error('DB connection lost'); },
        } as any)
      );

      const mockRunService = {
        getRun: async (id: string) => null,
        completeRun: async (id: string, status: PipelineRunStatus) => null,
      };

      const result = await brokenManager.recoverOrphanedRuns(mockRunService);

      expect(result.recovered).toBe(0);
      expect(result.markedFailed).toBe(0);
      expect(result.restored).toBe(0);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('DB connection lost');
    });

    test('handles individual checkpoint recovery error gracefully', async () => {
      await manager.saveCheckpoint(createTestExecution());

      const mockRunService = {
        getRun: async (id: string) => {
          throw new Error('getRun failed');
        },
        completeRun: async (id: string, status: PipelineRunStatus) => ({ id, status }),
      };

      const result = await manager.recoverOrphanedRuns(mockRunService);

      expect(result.recovered).toBe(1);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('getRun failed');
    });

    test('returns no errors when no running checkpoints exist', async () => {
      const mockRunService = {
        getRun: async (id: string) => null,
        completeRun: async (id: string, status: PipelineRunStatus) => null,
      };

      const result = await manager.recoverOrphanedRuns(mockRunService);

      expect(result.recovered).toBe(0);
      expect(result.markedFailed).toBe(0);
      expect(result.restored).toBe(0);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ==================== Full Serialization Round-Trip ====================

  describe('Serialization round-trip', () => {
    test('save then load preserves all execution state', async () => {
      const now = new Date();
      const stagesWithMoreData: Stage[] = [
        {
          id: 'stage-1',
          runId: 'run-rt',
          name: 'build',
          sequence: 0,
          status: StageStatus.SUCCESS,
          dependsOn: [],
          condition: "branch == 'main'",
          timeoutSeconds: 1800,
          retryCount: 0,
          maxRetries: 2,
          startedAt: now,
          completedAt: new Date(now.getTime() + 2000),
          durationMs: 2000,
          result: { artifacts: ['app.tar.gz'] },
          createdAt: now,
        },
        {
          id: 'stage-2',
          runId: 'run-rt',
          name: 'deploy',
          sequence: 1,
          status: StageStatus.RUNNING,
          dependsOn: ['build'],
          timeoutSeconds: 3600,
          retryCount: 1,
          maxRetries: 3,
          startedAt: new Date(now.getTime() + 3000),
          createdAt: now,
        },
      ];

      const originalExecution = createTestExecution({
        runId: 'run-rt',
        pipelineId: 'pipe-rt',
        stages: stagesWithMoreData,
        pendingStages: [],
        runningStages: ['stage-2'],
        completedStages: ['stage-1'],
        runStatus: PipelineRunStatus.RUNNING,
      });

      await manager.saveCheckpoint(originalExecution, 'deploy', 'kubectl apply');
      const restored = await manager.loadCheckpoint('run-rt');

      expect(restored).not.toBeNull();
      expect(restored!.run.id).toBe('run-rt');
      expect(restored!.run.pipelineId).toBe('pipe-rt');
      expect(restored!.stages.size).toBe(2);

      // Check stage 1 data preserved
      const s1 = restored!.stages.get('stage-1');
      expect(s1?.name).toBe('build');
      expect(s1?.status).toBe(StageStatus.SUCCESS);
      expect(s1?.condition).toBe("branch == 'main'");
      expect(s1?.timeoutSeconds).toBe(1800);
      expect(s1?.maxRetries).toBe(2);
      expect(s1?.result).toEqual({ artifacts: ['app.tar.gz'] });

      // Check stage 2 data preserved
      const s2 = restored!.stages.get('stage-2');
      expect(s2?.name).toBe('deploy');
      expect(s2?.status).toBe(StageStatus.RUNNING);
      expect(s2?.retryCount).toBe(1);
      expect(s2?.maxRetries).toBe(3);
      expect(s2?.dependsOn).toEqual(['build']);

      // Check Sets preserved
      expect(Array.from(restored!.completedStages)).toEqual(['stage-1']);
      expect(Array.from(restored!.runningStages)).toEqual(['stage-2']);
    });
  });
});
