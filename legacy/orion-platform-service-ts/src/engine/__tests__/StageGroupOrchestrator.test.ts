import { StageGroupOrchestrator } from '../StageGroupOrchestrator';
import { Stage, StageStatus } from '../../models/Stage';
import { PipelineExecution } from '../PipelineEngine';

describe('StageGroupOrchestrator', () => {
  let orchestrator: StageGroupOrchestrator;

  beforeEach(() => {
    orchestrator = new StageGroupOrchestrator();
  });

  describe('groupStages', () => {
    it('应该将同组stages组织在一起', () => {
      const stages = [
        createStage({ id: 's1', name: 'deploy-group-1', sequence: 1 }),
        createStage({ id: 's2', name: 'deploy-group-2', sequence: 2 }),
        createStage({ id: 's3', name: 'independent', sequence: 3 }),
      ];
      const stageGroups: Record<string, string[]> = {
        'deploy-group': ['deploy-group-1', 'deploy-group-2'],
      };

      const groups = orchestrator.groupStages(stages, stageGroups);
      expect(groups.has('deploy-group')).toBe(true);
      expect(groups.get('deploy-group')).toHaveLength(2);
      expect(groups.get('deploy-group')![0].name).toBe('deploy-group-1');
    });

    it('没有分组的stage应该各自独立', () => {
      const stages = [
        createStage({ id: 's1', name: 'standalone-1', sequence: 1 }),
        createStage({ id: 's2', name: 'standalone-2', sequence: 2 }),
      ];

      const groups = orchestrator.groupStages(stages, {});
      expect(groups.size).toBe(2);
    });
  });

  describe('executeGroup', () => {
    it('应该按批次顺序执行组内stages', async () => {
      const groupStages = [
        createStage({ id: 'g1', name: 'g1', sequence: 1, targets: ['node1', 'node2', 'node3'], executionMode: 'grayScale', batchSize: 2 }),
        createStage({ id: 'g2', name: 'g2', sequence: 2, targets: ['node1', 'node2', 'node3'], executionMode: 'grayScale', batchSize: 2 }),
      ];

      const execution = createExecution();
      const executeFn = jest.fn(async () => ({ success: true }));

      await orchestrator.executeGroup('group-1', groupStages, execution, executeFn);

      // With batchSize=2 and 3 targets, first batch: [node1, node2], second: [node3]
      // 2 stages * 2 batches = 4 calls
      expect(executeFn).toHaveBeenCalledTimes(4);
    });
  });
});

function createExecution(overrides: Partial<PipelineExecution> = {}): PipelineExecution {
  return {
    run: {} as any,
    stages: new Map(),
    pendingStages: new Set(),
    runningStages: new Set(),
    completedStages: new Set(),
    ...overrides,
  };
}

function createStage(overrides: Partial<Stage> = {}): Stage {
  return {
    id: `stage-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    runId: 'run-001',
    name: 'default',
    sequence: 0,
    status: StageStatus.PENDING,
    dependsOn: [],
    timeoutSeconds: 3600,
    retryCount: 0,
    maxRetries: 0,
    createdAt: new Date(),
    ...overrides,
  };
}
