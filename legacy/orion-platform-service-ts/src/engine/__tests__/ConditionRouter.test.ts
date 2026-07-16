/**
 * ConditionRouter Tests
 *
 * Tests for stage condition evaluation with execution context:
 * - stages.<name>.status == 'success' | 'failed' | 'skipped'
 * - stages.<name>.result.<key> <op> <value>
 * - tasks.<name>.outputs.<key> <op> <value>
 * - Complex && || logic
 * - No condition returns true (safe default)
 */

import { ConditionRouter } from '../ConditionRouter';
import { VariableContext } from '../VariableContext';
import { Stage, StageStatus } from '../../models/Stage';
import { PipelineExecution } from '../PipelineEngine';

describe('ConditionRouter', () => {
  let router: ConditionRouter;
  let variableCtx: VariableContext;

  beforeEach(() => {
    variableCtx = new VariableContext('run-001');
    router = new ConditionRouter(variableCtx);
  });

  describe('evaluate', () => {
    it('应该支持 stages.<name>.status == success 条件', () => {
      const execution = createExecution({
        stages: {
          'build': createStage({ name: 'build', status: StageStatus.SUCCESS }),
          'test': createStage({ name: 'test', status: StageStatus.SUCCESS }),
        },
      });

      const stage = createStage({
        name: 'deploy',
        condition: "stages.build.status == 'success'",
      });

      expect(router.evaluate(stage.condition!, execution)).toBe(true);
    });

    it('应该在条件为false时跳过stage', () => {
      const execution = createExecution({
        stages: {
          'build': createStage({ name: 'build', status: StageStatus.FAILED }),
        },
      });

      const stage = createStage({
        name: 'deploy',
        condition: "stages.build.status == 'success'",
      });

      expect(router.evaluate(stage.condition!, execution)).toBe(false);
    });

    it('应该支持 stages.<name>.result.<key> 条件', () => {
      variableCtx.setTaskOutput('test', 'passRate', '0.95');
      const execution = createExecution({
        stages: {
          'test': createStage({
            name: 'test',
            status: StageStatus.SUCCESS,
            result: { passRate: 0.95 },
          }),
        },
      });

      const stage = createStage({
        name: 'promote',
        condition: 'stages.test.result.passRate >= 0.9',
      });

      expect(router.evaluate(stage.condition!, execution)).toBe(true);
    });

    it('无condition的stage应该返回true', () => {
      const stage = createStage({ name: 'always-run' });
      const execution = createExecution({});
      expect(router.evaluate(stage.condition!, execution)).toBe(true);
    });

    it('复杂逻辑条件应该正确求值', () => {
      const execution = createExecution({
        stages: {
          'build': createStage({ name: 'build', status: StageStatus.SUCCESS }),
          'test': createStage({ name: 'test', status: StageStatus.SUCCESS }),
        },
      });

      const stage = createStage({
        name: 'deploy',
        condition: "stages.build.status == 'success' && stages.test.status == 'success'",
      });

      expect(router.evaluate(stage.condition!, execution)).toBe(true);
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
    id: `stage-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
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
