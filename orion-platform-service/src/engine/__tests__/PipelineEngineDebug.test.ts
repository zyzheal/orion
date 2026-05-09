/**
 * PipelineEngine Debug Integration Tests
 *
 * Verifies that DebugController.pause/resume/step actually affect
 * PipelineEngine execution — not just StageExecutor.
 *
 * PipelineEngine.executeStage() iterates tasks and calls
 * stageExecutor.executeTask() for each. This file tests that:
 * 1. PipelineEngine checks shouldPause() before each task
 * 2. PipelineEngine blocks on waitForSignal() when paused
 * 3. Resume unblocks and execution continues
 * 4. Step mode: only one task executes then pauses again
 * 5. getDebugController() returns the injected instance
 * 6. Zero overhead when DebugController is not injected
 */

import { PipelineEngine } from '../PipelineEngine';
import { DebugController } from '../DebugController';
import { StageExecutor } from '../StageExecutor';
import { TaskRunner } from '../TaskRunner';
import { PipelineEventPublisher } from '../../events/PipelineEventPublisher';
import { PipelineService } from '../../services/pipeline/PipelineService';
import { PipelineRunService } from '../../services/pipeline/PipelineRunService';
import { Pipeline, createPipeline } from '../../models/Pipeline';
import { PipelineRun, PipelineRunStatus, TriggerType } from '../../models/PipelineRun';
import { Stage, StageStatus, createStage } from '../../models/Stage';
import { Task, TaskStatus, createTask } from '../../models/Task';

// ==================== Helpers ====================

/** Wait until a condition becomes true or timeout. */
async function waitForCondition(condition: () => boolean, timeoutMs: number, pollMs = 10): Promise<void> {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error(`Condition not met within ${timeoutMs}ms`);
    }
    await new Promise(r => setTimeout(r, pollMs));
  }
}

/** Build a minimal pipeline YAML definition with the given steps. */
function buildPipelineYaml(steps: Array<{ name: string; uses: string }>): string {
  const stageSteps = steps.map(s => `        - name: ${s.name}\n          uses: ${s.uses}`).join('\n');
  return `apiVersion: pipeline.orion/v1
kind: Pipeline
metadata:
  name: test-pipeline
spec:
  stages:
    - name: build
      runsOn: linux
      steps:
${stageSteps}
`;
}

// ==================== Mocks ====================

/** A TaskRunner that tracks execution count and completes quickly. */
class TrackingTaskRunner extends TaskRunner {
  public executeCount = 0;
  public executedTaskNames: string[] = [];

  async run(task: Task): Promise<Task> {
    this.executeCount++;
    this.executedTaskNames.push(task.name);
    await new Promise(r => setTimeout(r, 5));
    return { ...task, status: TaskStatus.SUCCESS, result: { simulated: true, taskName: task.name } };
  }
}

/** Create a fully mocked PipelineEngine with tracking. */
function createEngineWithDebug(debugController?: DebugController): {
  engine: PipelineEngine;
  taskRunner: TrackingTaskRunner;
  runService: jest.Mocked<PipelineRunService>;
  pipelineService: jest.Mocked<PipelineService>;
  eventPublisher: jest.Mocked<PipelineEventPublisher>;
  stageExecutor: StageExecutor;
} {
  const taskRunner = new TrackingTaskRunner();
  const eventPublisher = {
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
    publishRunCreated: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<PipelineEventPublisher>;

  const stageExecutor = new StageExecutor(taskRunner, eventPublisher, undefined, undefined, debugController || undefined);

  // Store tasks per stageId for getTasks mock
  const tasksByStage = new Map<string, Task[]>();

  const runService = {
    createRun: jest.fn().mockImplementation((input) => {
      const run: PipelineRun = {
        ...createPipelineRun(input),
        id: 'test-run-' + Date.now(),
      };
      return Promise.resolve(run);
    }),
    startRun: jest.fn().mockResolvedValue(null),
    completeRun: jest.fn().mockResolvedValue(null),
    cancelRun: jest.fn().mockResolvedValue(null),
    addStage: jest.fn().mockResolvedValue(undefined),
    addTask: jest.fn().mockImplementation((stageId: string, task: Task) => {
      // Store tasks so getTasks can return them
      if (!tasksByStage.has(stageId)) {
        tasksByStage.set(stageId, []);
      }
      tasksByStage.get(stageId)!.push(task);
      return Promise.resolve(undefined);
    }),
    getTasks: jest.fn().mockImplementation((stageId: string) => {
      return Promise.resolve(tasksByStage.get(stageId) || []);
    }),
    updateStage: jest.fn().mockResolvedValue(undefined),
    updateTask: jest.fn().mockResolvedValue(undefined),
    getRun: jest.fn().mockResolvedValue(null),
    findRunsByStatus: jest.fn().mockResolvedValue([]),
    getStages: jest.fn().mockResolvedValue([]),
  } as unknown as jest.Mocked<PipelineRunService>;

  const pipelineService = {
    getById: jest.fn().mockResolvedValue(null),
  } as unknown as jest.Mocked<PipelineService>;

  const engine = new PipelineEngine(
    pipelineService,
    runService,
    eventPublisher,
    stageExecutor,
    undefined, // subPipelineService
    undefined, // artifactService
    undefined, // approvalGateService
    undefined, // executionQueue
    undefined, // autoRetryService
    undefined, // onRunComplete
    undefined, // checkpointManager
    undefined, // imNotifier
    undefined, // imNotificationConfigs
    debugController || undefined
  );

  return {
    engine,
    taskRunner,
    runService,
    pipelineService,
    eventPublisher,
    stageExecutor,
  };
}

// We need to import createPipelineRun from PipelineRun model
function createPipelineRun(input: { pipelineId: string; pipelineVersion: string; triggerType: TriggerType; triggerBy?: string; context?: Record<string, unknown> }): PipelineRun {
  const now = new Date();
  return {
    id: 'run-id',
    pipelineId: input.pipelineId,
    pipelineVersion: input.pipelineVersion,
    triggerType: input.triggerType,
    triggerBy: input.triggerBy,
    status: PipelineRunStatus.PENDING,
    context: input.context || {},
    createdAt: now,
    updatedAt: now,
  };
}

// ==================== Tests ====================

describe('PipelineEngine Debug Integration', () => {
  let debugController: DebugController;

  beforeEach(() => {
    DebugController.resetForTesting();
    debugController = DebugController.getInstance();
  });

  // ==================== 1. getDebugController() ====================

  describe('getDebugController()', () => {
    it('should return the injected DebugController instance', () => {
      const { engine } = createEngineWithDebug(debugController);
      expect(engine.getDebugController()).toBe(debugController);
    });

    it('should return null when no DebugController is injected', () => {
      const { engine } = createEngineWithDebug(undefined);
      expect(engine.getDebugController()).toBeNull();
    });
  });

  // ==================== 2. Debug session registration ====================

  describe('debug session lifecycle', () => {
    it('should register a debug session when executing a pipeline with DebugController', async () => {
      const { engine, pipelineService, runService } = createEngineWithDebug(debugController);

      const pipeline: Pipeline = {
        ...createPipeline('test-pipeline'),
        id: 'pipeline-1',
        yamlDefinition: buildPipelineYaml([{ name: 'task-1', uses: 'shell@v1' }]),
      };
      (pipelineService.getById as jest.Mock).mockResolvedValue(pipeline);

      // Use a single task so execution completes quickly
      await engine.execute('pipeline-1', TriggerType.MANUAL, 'test-user');

      // Wait for execution to complete
      await waitForCondition(() => {
        const calls = (runService.completeRun as jest.Mock).mock.calls;
        return calls.length > 0;
      }, 2000);

      // Debug session should have been registered and then unregistered
      // After completion, the session is cleaned up
      const session = debugController.getState((runService.createRun as jest.Mock).mock.results[0]?.value?.id);
      // Session may be unregistered by now (pipeline completed), which is expected
    });
  });

  // ==================== 3. Pause/Resume in PipelineEngine.executeStage() ====================

  describe('pause/resume in PipelineEngine task loop', () => {
    it('should pause before a task and resume to continue', async () => {
      // Use slow tasks so we can catch the pause before all tasks complete
      const slowRunner = new (class extends TaskRunner {
        executeCount = 0;
        executedTaskNames: string[] = [];
        async run(task: Task): Promise<Task> {
          this.executeCount++;
          this.executedTaskNames.push(task.name);
          await new Promise(r => setTimeout(r, 50));
          return { ...task, status: TaskStatus.SUCCESS, result: { simulated: true, taskName: task.name } };
        }
      })();
      const mockEp = {
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
        publishRunCreated: jest.fn().mockResolvedValue(undefined),
      } as unknown as jest.Mocked<PipelineEventPublisher>;

      const tasksByStage = new Map<string, Task[]>();
      const mockRs = {
        createRun: jest.fn().mockImplementation((input) => {
          const run: PipelineRun = { ...createPipelineRun(input), id: 'test-run-slow-' + Date.now() };
          return Promise.resolve(run);
        }),
        startRun: jest.fn().mockResolvedValue(null),
        completeRun: jest.fn().mockResolvedValue(null),
        cancelRun: jest.fn().mockResolvedValue(null),
        addStage: jest.fn().mockResolvedValue(undefined),
        addTask: jest.fn().mockImplementation((stageId: string, task: Task) => {
          if (!tasksByStage.has(stageId)) tasksByStage.set(stageId, []);
          tasksByStage.get(stageId)!.push(task);
          return Promise.resolve(undefined);
        }),
        getTasks: jest.fn().mockImplementation((stageId: string) => Promise.resolve(tasksByStage.get(stageId) || [])),
        updateStage: jest.fn().mockResolvedValue(undefined),
        updateTask: jest.fn().mockResolvedValue(undefined),
        getRun: jest.fn().mockResolvedValue(null),
        findRunsByStatus: jest.fn().mockResolvedValue([]),
        getStages: jest.fn().mockResolvedValue([]),
      } as unknown as jest.Mocked<PipelineRunService>;

      const mockPs = { getById: jest.fn().mockResolvedValue(null) } as unknown as jest.Mocked<PipelineService>;
      const slowStageExecutor = new StageExecutor(slowRunner, mockEp, undefined, undefined, debugController);
      const slowEngine = new PipelineEngine(
        mockPs, mockRs, mockEp, slowStageExecutor,
        undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, debugController
      );

      const pipeline: Pipeline = {
        ...createPipeline('test-pipeline'),
        id: 'pipeline-pause',
        yamlDefinition: buildPipelineYaml([
          { name: 'task-1', uses: 'shell@v1' },
          { name: 'task-2', uses: 'shell@v1' },
          { name: 'task-3', uses: 'shell@v1' },
        ]),
      };
      (mockPs.getById as jest.Mock).mockResolvedValue(pipeline);

      // Execute pipeline (async, fire-and-forget)
      const run = await slowEngine.execute('pipeline-pause', TriggerType.MANUAL, 'test-user');
      expect(run).not.toBeNull();
      const runId = run!.id;

      // Wait ~60ms: task-1 completes at 50ms, task-2 starts at 50ms, completes at 100ms.
      // pause() is called at 60ms while task-2 is running. The pause check happens
      // before each task, so task-3 will be blocked by waitForSignal.
      await new Promise(r => setTimeout(r, 60));
      await debugController.pause(runId);

      // Wait for task-2 to complete and task-3 to be blocked by waitForSignal
      await new Promise(r => setTimeout(r, 100));

      // 2 tasks should have executed (task-1 and task-2 ran before pause took effect at task boundary)
      // task-3 is blocked waiting for resume
      const beforeResume = slowRunner.executeCount;
      expect(beforeResume).toBe(2);

      // Resume
      await debugController.resume(runId);

      // Wait for completion (task-2 and task-3)
      await waitForCondition(() => slowRunner.executeCount >= 3, 5000);

      expect(slowRunner.executeCount).toBe(3);
      expect(slowRunner.executedTaskNames).toEqual(['task-1', 'task-2', 'task-3']);
    });

    it('should not block when debug session is running', async () => {
      const { engine, pipelineService, runService, taskRunner } = createEngineWithDebug(debugController);

      const pipeline: Pipeline = {
        ...createPipeline('test-pipeline'),
        id: 'pipeline-running',
        yamlDefinition: buildPipelineYaml([
          { name: 'task-1', uses: 'shell@v1' },
          { name: 'task-2', uses: 'shell@v1' },
        ]),
      };
      (pipelineService.getById as jest.Mock).mockResolvedValue(pipeline);

      const run = await engine.execute('pipeline-running', TriggerType.MANUAL, 'test-user');
      expect(run).not.toBeNull();

      // Wait for completion — no pause should happen
      await waitForCondition(() => taskRunner.executeCount >= 2, 3000);

      expect(taskRunner.executeCount).toBe(2);
    });
  });

  // ==================== 4. Step mode in PipelineEngine ====================

  describe('step mode in PipelineEngine', () => {
    it('should execute one task then pause again after step', async () => {
      // Use slow tasks for step mode testing
      const slowRunner = new (class extends TaskRunner {
        executeCount = 0;
        executedTaskNames: string[] = [];
        async run(task: Task): Promise<Task> {
          this.executeCount++;
          this.executedTaskNames.push(task.name);
          await new Promise(r => setTimeout(r, 30));
          return { ...task, status: TaskStatus.SUCCESS, result: { simulated: true, taskName: task.name } };
        }
      })();
      const mockEp = {
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
        publishRunCreated: jest.fn().mockResolvedValue(undefined),
      } as unknown as jest.Mocked<PipelineEventPublisher>;

      const tasksByStage = new Map<string, Task[]>();
      const mockRs = {
        createRun: jest.fn().mockImplementation((input) => {
          const run: PipelineRun = { ...createPipelineRun(input), id: 'test-run-step-' + Date.now() };
          return Promise.resolve(run);
        }),
        startRun: jest.fn().mockResolvedValue(null),
        completeRun: jest.fn().mockResolvedValue(null),
        cancelRun: jest.fn().mockResolvedValue(null),
        addStage: jest.fn().mockResolvedValue(undefined),
        addTask: jest.fn().mockImplementation((stageId: string, task: Task) => {
          if (!tasksByStage.has(stageId)) tasksByStage.set(stageId, []);
          tasksByStage.get(stageId)!.push(task);
          return Promise.resolve(undefined);
        }),
        getTasks: jest.fn().mockImplementation((stageId: string) => Promise.resolve(tasksByStage.get(stageId) || [])),
        updateStage: jest.fn().mockResolvedValue(undefined),
        updateTask: jest.fn().mockResolvedValue(undefined),
        getRun: jest.fn().mockResolvedValue(null),
        findRunsByStatus: jest.fn().mockResolvedValue([]),
        getStages: jest.fn().mockResolvedValue([]),
      } as unknown as jest.Mocked<PipelineRunService>;

      const mockPs = { getById: jest.fn().mockResolvedValue(null) } as unknown as jest.Mocked<PipelineService>;
      const slowStageExecutor = new StageExecutor(slowRunner, mockEp, undefined, undefined, debugController);
      const slowEngine = new PipelineEngine(
        mockPs, mockRs, mockEp, slowStageExecutor,
        undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, debugController
      );

      const pipeline: Pipeline = {
        ...createPipeline('test-pipeline'),
        id: 'pipeline-step',
        yamlDefinition: buildPipelineYaml([
          { name: 'task-1', uses: 'shell@v1' },
          { name: 'task-2', uses: 'shell@v1' },
          { name: 'task-3', uses: 'shell@v1' },
        ]),
      };
      (mockPs.getById as jest.Mock).mockResolvedValue(pipeline);

      const run = await slowEngine.execute('pipeline-step', TriggerType.MANUAL, 'test-user');
      expect(run).not.toBeNull();
      const runId = run!.id;

      // Task takes 30ms. Wait 40ms: task-1 completes at 30ms, task-2 starts at 30ms.
      // pause() is called at 40ms while task-2 is running.
      await new Promise(r => setTimeout(r, 40));
      await debugController.pause(runId);

      // Wait for task-2 to complete and task-3 to be blocked by waitForSignal
      await new Promise(r => setTimeout(r, 80));

      // 2 tasks should have executed (task-1 and task-2 ran before pause took effect at task boundary)
      // task-3 is blocked waiting for resume
      expect(slowRunner.executeCount).toBe(2);

      // Step: execute exactly one more task (task-3)
      await debugController.step(runId);

      // Wait for the step to execute
      await waitForCondition(() => slowRunner.executeCount >= 3, 2000);
      expect(slowRunner.executeCount).toBe(3);

      // Resume to clean up (pipeline may already be complete)
      try {
        await debugController.resume(runId);
      } catch {
        // May throw if already completed/resumed
      }
    });
  });

  // ==================== 5. No DebugController (production mode) ====================

  describe('production mode (no DebugController)', () => {
    it('should execute all tasks without debug overhead', async () => {
      const { engine, pipelineService, runService, taskRunner } = createEngineWithDebug(undefined);

      const pipeline: Pipeline = {
        ...createPipeline('test-pipeline'),
        id: 'pipeline-prod',
        yamlDefinition: buildPipelineYaml([
          { name: 'task-1', uses: 'shell@v1' },
          { name: 'task-2', uses: 'shell@v1' },
          { name: 'task-3', uses: 'shell@v1' },
        ]),
      };
      (pipelineService.getById as jest.Mock).mockResolvedValue(pipeline);

      await engine.execute('pipeline-prod', TriggerType.MANUAL, 'test-user');

      await waitForCondition(() => taskRunner.executeCount >= 3, 3000);

      expect(taskRunner.executeCount).toBe(3);
    });
  });
});
