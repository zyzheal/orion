/**
 * DebugController Integration Tests
 *
 * Verifies that DebugController.pause/resume/step actually affect
 * PipelineEngine/StageExecutor execution — not just manage state.
 *
 * Tests cover:
 * 1. StageExecutor checks shouldPause() before each task
 * 2. StageExecutor blocks on waitForSignal() when paused
 * 3. Resume unblocks execution and tasks continue
 * 4. Step mode: only one task executes then pauses again
 * 5. Zero overhead when DebugController is not injected (production mode)
 */

import { DebugController } from '../DebugController';
import { StageExecutor } from '../StageExecutor';
import { TaskRunner } from '../TaskRunner';
import { PipelineEventPublisher } from '../../events/PipelineEventPublisher';
import { Stage, StageStatus } from '../../models/Stage';
import { Task, TaskStatus, createTask } from '../../models/Task';
import { VariableContext } from '../VariableContext';

// ==================== Helpers ====================

/**
 * Wait until a condition becomes true or timeout.
 */
async function waitForCondition(condition: () => boolean, timeoutMs: number, pollMs = 10): Promise<void> {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error(`Condition not met within ${timeoutMs}ms`);
    }
    await new Promise(r => setTimeout(r, pollMs));
  }
}

// ==================== Mocks ====================

/**
 * A TaskRunner that tracks how many tasks were executed and resolves
 * each task quickly (5ms) for fast tests.
 */
class MockTaskRunner extends TaskRunner {
  public executeCount = 0;
  public executedTaskNames: string[] = [];

  constructor() {
    super();
  }

  async run(task: Task): Promise<Task> {
    this.executeCount++;
    this.executedTaskNames.push(task.name);
    // Simulate quick task execution
    await new Promise(r => setTimeout(r, 5));
    return {
      ...task,
      status: TaskStatus.SUCCESS,
      result: { simulated: true, taskName: task.name },
    };
  }
}

/**
 * A minimal mock PipelineEventPublisher that does nothing but satisfies the interface.
 */
function createMockEventPublisher(): jest.Mocked<PipelineEventPublisher> {
  return {
    publishTaskStarted: jest.fn().mockResolvedValue(undefined),
    publishTaskCompleted: jest.fn().mockResolvedValue(undefined),
    publishTaskFailed: jest.fn().mockResolvedValue(undefined),
    publishStageStarted: jest.fn().mockResolvedValue(undefined),
    publishStageCompleted: jest.fn().mockResolvedValue(undefined),
    publishStageFailed: jest.fn().mockResolvedValue(undefined),
    publishStageSkipped: jest.fn().mockResolvedValue(undefined),
    publishRunStarted: jest.fn().mockResolvedValue(undefined),
    publishRunCompleted: jest.fn().mockResolvedValue(undefined),
    publishRunFailed: jest.fn().mockResolvedValue(undefined),
    publishRunCancelled: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<PipelineEventPublisher>;
}

/**
 * Create a test Stage with default values.
 */
function createTestStage(overrides?: Partial<Stage>): Stage {
  const now = new Date();
  return {
    id: 'stage-test',
    runId: 'run-test',
    name: 'test-stage',
    sequence: 0,
    status: StageStatus.RUNNING,
    dependsOn: [],
    timeoutSeconds: 3600,
    retryCount: 0,
    maxRetries: 0,
    startedAt: now,
    createdAt: now,
    ...overrides,
  };
}

/**
 * Create test Tasks.
 */
function createTestTasks(count: number, runId: string, stageId: string): Task[] {
  const tasks: Task[] = [];
  for (let i = 0; i < count; i++) {
    tasks.push(
      createTask({
        stageId,
        name: `task-${i + 1}`,
        type: 'shell',
        sequence: i,
        parameters: {},
        timeoutSeconds: 60,
      })
    );
  }
  return tasks;
}

// ==================== Tests ====================

describe('DebugController Integration with StageExecutor', () => {
  let debugController: DebugController;
  let mockRunner: MockTaskRunner;
  let mockPublisher: jest.Mocked<PipelineEventPublisher>;
  let executor: StageExecutor;

  beforeEach(() => {
    DebugController.resetForTesting();
    debugController = DebugController.getInstance();
    mockRunner = new MockTaskRunner();
    mockPublisher = createMockEventPublisher();
    executor = new StageExecutor(mockRunner, mockPublisher, undefined, undefined, debugController);
  });

  // ==================== 1. No DebugController (production mode) ====================

  describe('production mode (no DebugController)', () => {
    let prodExecutor: StageExecutor;

    beforeEach(() => {
      // Create executor WITHOUT DebugController — this is production mode
      prodExecutor = new StageExecutor(mockRunner, mockPublisher);
    });

    it('should execute all tasks normally without debug overhead', async () => {
      const stage = createTestStage();
      const tasks = createTestTasks(3, 'run-prod', 'stage-prod');

      const result = await prodExecutor.executeStage('run-prod', stage, tasks);

      expect(result.success).toBe(true);
      expect(mockRunner.executeCount).toBe(3);
    });

    it('should not call shouldPause when DebugController is not injected', async () => {
      const stage = createTestStage();
      const tasks = createTestTasks(2, 'run-prod2', 'stage-prod2');

      // Spy on DebugController to verify it's never called
      const spy = jest.spyOn(debugController, 'shouldPause');

      await prodExecutor.executeStage('run-prod2', stage, tasks);

      expect(spy).not.toHaveBeenCalled();
    });
  });

  // ==================== 2. Pause/Resume at task boundary ====================

  describe('pause/resume at task boundary', () => {
    it('should block before a task when paused, then resume and continue', async () => {
      const runId = 'run-pause-resume';
      const stage = createTestStage({ runId, id: 'stage-pr' });
      const tasks = createTestTasks(3, runId, 'stage-pr');

      // Register the debug session before starting execution
      debugController.registerRun(runId, { status: 'running' });

      // Start executing stage — this will run all 3 tasks sequentially
      // We use a promise to track when execution completes
      const executionPromise = executor.executeStage(runId, stage, tasks);

      // Give the first task a moment to start
      await new Promise(r => setTimeout(r, 10));

      // Pause at the next task boundary
      await debugController.pause(runId);

      // Wait a bit to ensure we're blocked
      await new Promise(r => setTimeout(r, 50));

      // At this point, we should NOT have executed all 3 tasks yet
      // (we're blocked waiting for resume)
      const beforeResume = mockRunner.executeCount;
      expect(beforeResume).toBeLessThan(3);

      // Resume execution
      await debugController.resume(runId);

      // Now wait for execution to complete
      const result = await executionPromise;

      expect(result.success).toBe(true);
      expect(mockRunner.executeCount).toBe(3);
    });

    it('should not block when debug session is in running state', async () => {
      const runId = 'run-running';
      const stage = createTestStage({ runId, id: 'stage-running' });
      const tasks = createTestTasks(2, runId, 'stage-running');

      // Register with running status — should not pause
      debugController.registerRun(runId, { status: 'running' });

      const result = await executor.executeStage(runId, stage, tasks);

      expect(result.success).toBe(true);
      expect(mockRunner.executeCount).toBe(2);
    });
  });

  // ==================== 3. Step mode ====================

  describe('step mode', () => {
    it('should execute one task then pause again after step', async () => {
      const runId = 'run-step';
      const stage = createTestStage({ runId, id: 'stage-step' });
      const tasks = createTestTasks(3, runId, 'stage-step');

      // Start in paused state
      await debugController.pause(runId);

      // Set to step mode
      await debugController.step(runId);

      // executeStage will check shouldPause -> true -> waitForSignal
      // waitForSignal in step mode returns true and sets status back to paused
      // BUT the tasks haven't started executing yet because executeStage loops
      // through tasks and each task calls shouldPause at the start

      // The first task should execute (step mode allows one), then the second
      // task should see paused status and block
      const executionPromise = executor.executeStage(runId, stage, tasks);

      // Wait for step execution to complete and second task to pause
      await new Promise(r => setTimeout(r, 100));

      // Only 1 task should have executed (the step)
      expect(mockRunner.executeCount).toBe(1);
      expect(mockRunner.executedTaskNames).toContain('task-1');

      // Debug state should be back to paused after the step
      const state = debugController.getState(runId);
      expect(state?.status).toBe('paused');

      // Resume to let remaining tasks complete
      await debugController.resume(runId);
      const result = await executionPromise;

      expect(result.success).toBe(true);
      expect(mockRunner.executeCount).toBe(3);
    });

    it('should allow multiple steps to execute tasks one at a time', async () => {
      const runId = 'run-multi-step';
      const stage = createTestStage({ runId, id: 'stage-ms' });
      const tasks = createTestTasks(3, runId, 'stage-ms');

      // Start in paused state
      await debugController.pause(runId);

      // Step 1: execute first task
      await debugController.step(runId);
      const execPromise = executor.executeStage(runId, stage, tasks);

      await waitForCondition(() => mockRunner.executeCount === 1, 500);
      expect(mockRunner.executeCount).toBe(1);

      // Step 2: execute second task
      await debugController.step(runId);
      await waitForCondition(() => mockRunner.executeCount === 2, 500);
      expect(mockRunner.executeCount).toBe(2);

      // Step 3: execute third task
      await debugController.step(runId);
      await waitForCondition(() => mockRunner.executeCount === 3, 500);
      expect(mockRunner.executeCount).toBe(3);

      // All tasks done, resume to finish
      await debugController.resume(runId);
      const result = await execPromise;
      expect(result.success).toBe(true);
    });
  });

  // ==================== 4. VariableContext compatibility ====================

  describe('with VariableContext', () => {
    it('should work with both VariableContext and DebugController', async () => {
      const runId = 'run-with-vars';
      const stage = createTestStage({ runId, id: 'stage-vars' });
      const tasks = createTestTasks(2, runId, 'stage-vars');
      const variableCtx = new VariableContext(runId);
      variableCtx.setVariable('branch', 'main');

      // Create executor with both VariableContext and DebugController
      const executorWithBoth = new StageExecutor(
        mockRunner,
        mockPublisher,
        undefined,
        variableCtx,
        debugController
      );

      debugController.registerRun(runId, { status: 'running' });

      const result = await executorWithBoth.executeStage(runId, stage, tasks);

      expect(result.success).toBe(true);
      expect(mockRunner.executeCount).toBe(2);
    });
  });

  // ==================== 5. Task failure during debug ====================

  describe('task failure during debug', () => {
    it('should propagate task failure even when debug session is active', async () => {
      const runId = 'run-fail-debug';
      const stage = createTestStage({ runId, id: 'stage-fail' });
      const tasks = createTestTasks(2, runId, 'stage-fail');

      // Make the mock runner fail on the second task
      mockRunner.executeCount = 0;
      mockRunner.executedTaskNames = [];
      const originalRun = mockRunner.run.bind(mockRunner);
      mockRunner.run = async (task: Task): Promise<Task> => {
        mockRunner.executeCount++;
        mockRunner.executedTaskNames.push(task.name);
        await new Promise(r => setTimeout(r, 5));
        if (task.name === 'task-2') {
          throw new Error('simulated failure');
        }
        return {
          ...task,
          status: TaskStatus.SUCCESS,
          result: { simulated: true, taskName: task.name },
        };
      };

      debugController.registerRun(runId, { status: 'running' });

      // executeTask wraps the runner in try/catch and returns a failed task
      // executeStage returns { success: false } when a task fails
      const result = await executor.executeStage(runId, stage, tasks);

      expect(result.success).toBe(false);
      expect(mockRunner.executeCount).toBe(2);
    });
  });
});
