/**
 * SubPipeline Integration Tests
 *
 * Verifies that PipelineEngine correctly handles sub-pipeline stages:
 * 1. Invoking child pipeline when stage has sub-pipeline type
 * 2. Waiting for child pipeline completion
 * 3. Mapping child results to parent stage outputs
 * 4. Propagating child pipeline failures to parent stage failure
 */

import { PipelineEngine } from '../PipelineEngine';
import { StageExecutor } from '../StageExecutor';
import { TaskRunner } from '../TaskRunner';
import { PipelineEventPublisher } from '../../events/PipelineEventPublisher';
import { PipelineService } from '../../services/pipeline/PipelineService';
import { PipelineRunService } from '../../services/pipeline/PipelineRunService';
import { SubPipelineService } from '../../services/pipeline/SubPipelineService';
import { Pipeline, createPipeline } from '../../models/Pipeline';
import { PipelineRun, PipelineRunStatus, TriggerType } from '../../models/PipelineRun';
import { StageStatus } from '../../models/Stage';
import { Task, TaskStatus } from '../../models/Task';

// ==================== Helpers ====================

async function waitForCondition(condition: () => boolean, timeoutMs: number, pollMs = 10): Promise<void> {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error(`Condition not met within ${timeoutMs}ms`);
    }
    await new Promise(r => setTimeout(r, pollMs));
  }
}

function buildPipelineYamlWithParams(stages: Array<{
  name: string;
  steps: Array<{ name: string; uses: string; with?: Record<string, string> }>;
}>): string {
  const stagesYaml = stages.map(s => {
    const stepsYaml = s.steps.map(step => {
      let stepYaml = `        - name: ${step.name}\n          uses: ${step.uses}`;
      if (step.with) {
        const withYaml = Object.entries(step.with)
          .map(([k, v]) => `            ${k}: "${v}"`)
          .join('\n');
        stepYaml += `\n          with:\n${withYaml}`;
      }
      return stepYaml;
    }).join('\n');
    return `    - name: ${s.name}\n      runsOn: linux\n      steps:\n${stepsYaml}`;
  }).join('\n');

  return `apiVersion: pipeline.orion/v1
kind: Pipeline
metadata:
  name: test-pipeline
spec:
  stages:
${stagesYaml}
`;
}

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

describe('SubPipeline Integration', () => {
  let mockSubPipelineService: jest.Mocked<SubPipelineService>;
  let mockEventPublisher: jest.Mocked<PipelineEventPublisher>;
  let tasksByStage: Map<string, Task[]>;
  let mockRunService: jest.Mocked<PipelineRunService>;
  let mockPipelineService: jest.Mocked<PipelineService>;
  let taskRunner: TaskRunner;
  let stageExecutor: StageExecutor;
  let runId = 'test-run-1';

  beforeEach(() => {
    runId = 'test-run-' + Date.now();
    tasksByStage = new Map();

    mockSubPipelineService = {
      invoke: jest.fn(),
      waitForCompletion: jest.fn(),
      getResults: jest.fn(),
      cancel: jest.fn(),
      markCompleted: jest.fn(),
      markFailed: jest.fn(),
      getByParentRunId: jest.fn(),
      getById: jest.fn(),
      getByPipelineId: jest.fn(),
    } as unknown as jest.Mocked<SubPipelineService>;

    mockEventPublisher = {
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

    taskRunner = new (class extends TaskRunner {
      executeCount = 0;
      async run(task: Task): Promise<Task> {
        this.executeCount++;
        await new Promise(r => setTimeout(r, 5));
        return { ...task, status: TaskStatus.SUCCESS, result: { simulated: true } };
      }
    })();
    stageExecutor = new StageExecutor(taskRunner, mockEventPublisher);

    mockRunService = {
      createRun: jest.fn().mockImplementation((input) => {
        const run: PipelineRun = { ...createPipelineRun(input), id: runId };
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
      getTasks: jest.fn().mockImplementation((stageId: string) => {
        return Promise.resolve(tasksByStage.get(stageId) || []);
      }),
      updateStage: jest.fn().mockResolvedValue(undefined),
      updateTask: jest.fn().mockResolvedValue(undefined),
      getRun: jest.fn().mockResolvedValue(null),
      findRunsByStatus: jest.fn().mockResolvedValue([]),
      getStages: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<PipelineRunService>;

    mockPipelineService = {
      getById: jest.fn().mockResolvedValue(null),
    } as unknown as jest.Mocked<PipelineService>;
  });

  function createEngine(subPipelineService?: SubPipelineService | null): PipelineEngine {
    return new PipelineEngine(
      mockPipelineService,
      mockRunService,
      mockEventPublisher,
      stageExecutor,
      subPipelineService || null,
      undefined, undefined, undefined, undefined,
      undefined, undefined, undefined, undefined,
      undefined, undefined, undefined,
    );
  }

  // ==================== 1. Sub-pipeline stage invocation ====================

  describe('sub-pipeline stage invocation', () => {
    it('should invoke child pipeline when stage has sub-pipeline task type', async () => {
      const pipeline: Pipeline = {
        ...createPipeline('test-pipeline'),
        id: 'pipeline-parent',
        yamlDefinition: buildPipelineYamlWithParams([
          {
            name: 'deploy-staging',
            steps: [{ name: 'invoke-child', uses: 'sub-pipeline@v1', with: { pipelineId: 'pipeline-child' } }],
          },
        ]),
      };
      (mockPipelineService.getById as jest.Mock).mockResolvedValue(pipeline);

      mockSubPipelineService.invoke.mockResolvedValue({
        invocation: {
          id: 'inv-1', parentRunId: runId, childPipelineId: 'pipeline-child',
          childRunId: 'run-child-1', status: 'running', inputParams: {},
          outputResults: {}, stageName: 'deploy-staging', outputMapping: {},
          createdAt: new Date(),
        },
        childRunId: 'run-child-1',
      });
      mockSubPipelineService.waitForCompletion.mockResolvedValue({
        id: 'inv-1', parentRunId: runId, childPipelineId: 'pipeline-child',
        childRunId: 'run-child-1', status: 'completed', inputParams: {},
        outputResults: { url: 'https://staging.example.com' },
        stageName: 'deploy-staging', outputMapping: {}, createdAt: new Date(), completedAt: new Date(),
      });
      mockSubPipelineService.getResults.mockResolvedValue({ url: 'https://staging.example.com' });

      const engine = createEngine(mockSubPipelineService);
      const run = await engine.execute('pipeline-parent', TriggerType.MANUAL, 'test-user');
      expect(run).not.toBeNull();

      // Wait for stage SUCCESS
      await waitForCondition(() => {
        const calls = (mockRunService.updateStage as jest.Mock).mock.calls;
        return calls.some((c: any[]) => c[0]?.status === StageStatus.SUCCESS);
      }, 5000);

      expect(mockSubPipelineService.invoke).toHaveBeenCalledWith(
        expect.objectContaining({
          childPipelineId: 'pipeline-child',
          stageName: 'deploy-staging',
        })
      );
    });

    it('should pass input parameters to child pipeline', async () => {
      const pipeline: Pipeline = {
        ...createPipeline('test-pipeline'),
        id: 'pipeline-parent',
        yamlDefinition: buildPipelineYamlWithParams([
          {
            name: 'deploy-prod',
            steps: [{
              name: 'invoke-child',
              uses: 'sub-pipeline@v1',
              with: { pipelineId: 'pipeline-child', env: 'production', version: '2.0.0' },
            }],
          },
        ]),
      };
      (mockPipelineService.getById as jest.Mock).mockResolvedValue(pipeline);

      mockSubPipelineService.invoke.mockResolvedValue({
        invocation: {
          id: 'inv-1', parentRunId: runId, childPipelineId: 'pipeline-child',
          childRunId: 'run-child-1', status: 'running',
          inputParams: { env: 'production', version: '2.0.0' },
          outputResults: {}, stageName: 'deploy-prod', outputMapping: { deployUrl: 'url' },
          createdAt: new Date(),
        },
        childRunId: 'run-child-1',
      });
      mockSubPipelineService.waitForCompletion.mockResolvedValue({
        id: 'inv-1', parentRunId: runId, childPipelineId: 'pipeline-child',
        childRunId: 'run-child-1', status: 'completed',
        inputParams: { env: 'production', version: '2.0.0' },
        outputResults: { url: 'https://prod.example.com' },
        stageName: 'deploy-prod', outputMapping: { deployUrl: 'url' },
        createdAt: new Date(), completedAt: new Date(),
      });
      mockSubPipelineService.getResults.mockResolvedValue({ url: 'https://prod.example.com' });

      const engine = createEngine(mockSubPipelineService);
      await engine.execute('pipeline-parent', TriggerType.MANUAL, 'test-user');

      await waitForCondition(() => {
        const calls = (mockRunService.updateStage as jest.Mock).mock.calls;
        return calls.some((c: any[]) => c[0]?.status === StageStatus.SUCCESS);
      }, 5000);

      expect(mockSubPipelineService.invoke).toHaveBeenCalledWith(
        expect.objectContaining({
          inputParams: expect.objectContaining({ env: 'production', version: '2.0.0' }),
        })
      );
    });
  });

  // ==================== 2. Output mapping ====================

  describe('output mapping', () => {
    it('should map child results to parent stage outputs', async () => {
      const pipeline: Pipeline = {
        ...createPipeline('test-pipeline'),
        id: 'pipeline-parent',
        yamlDefinition: buildPipelineYamlWithParams([
          {
            name: 'build-and-deploy',
            steps: [{ name: 'invoke-deploy', uses: 'sub-pipeline@v1', with: { pipelineId: 'pipeline-deploy' } }],
          },
        ]),
      };
      (mockPipelineService.getById as jest.Mock).mockResolvedValue(pipeline);

      mockSubPipelineService.invoke.mockResolvedValue({
        invocation: {
          id: 'inv-1', parentRunId: runId, childPipelineId: 'pipeline-deploy',
          childRunId: 'run-child-1', status: 'running', inputParams: {},
          outputResults: {}, stageName: 'build-and-deploy',
          outputMapping: { deployUrl: 'url', deployVersion: 'version' },
          createdAt: new Date(),
        },
        childRunId: 'run-child-1',
      });
      mockSubPipelineService.waitForCompletion.mockResolvedValue({
        id: 'inv-1', parentRunId: runId, childPipelineId: 'pipeline-deploy',
        childRunId: 'run-child-1', status: 'completed', inputParams: {},
        outputResults: { url: 'https://example.com', version: '1.0.0', status: 'ok' },
        stageName: 'build-and-deploy',
        outputMapping: { deployUrl: 'url', deployVersion: 'version' },
        createdAt: new Date(), completedAt: new Date(),
      });
      mockSubPipelineService.getResults.mockResolvedValue({
        url: 'https://example.com', version: '1.0.0', status: 'ok',
      });

      const engine = createEngine(mockSubPipelineService);
      await engine.execute('pipeline-parent', TriggerType.MANUAL, 'test-user');

      await waitForCondition(() => {
        const calls = (mockRunService.updateStage as jest.Mock).mock.calls;
        return calls.some((c: any[]) => c[0]?.status === StageStatus.SUCCESS);
      }, 5000);

      const updateCalls = (mockRunService.updateStage as jest.Mock).mock.calls;
      const finalStageCall = updateCalls.find((c: any[]) => c[0]?.status === StageStatus.SUCCESS);
      expect(finalStageCall).toBeDefined();
      expect(finalStageCall[0].result).toHaveProperty('subPipeline');
      expect(finalStageCall[0].result.subPipeline.childRunId).toBe('run-child-1');
    });
  });

  // ==================== 3. Failure propagation ====================

  describe('failure propagation', () => {
    it('should propagate child pipeline failure to parent stage failure', async () => {
      const pipeline: Pipeline = {
        ...createPipeline('test-pipeline'),
        id: 'pipeline-parent',
        yamlDefinition: buildPipelineYamlWithParams([
          {
            name: 'deploy-stage',
            steps: [{ name: 'invoke-child', uses: 'sub-pipeline@v1', with: { pipelineId: 'pipeline-child' } }],
          },
        ]),
      };
      (mockPipelineService.getById as jest.Mock).mockResolvedValue(pipeline);

      mockSubPipelineService.invoke.mockResolvedValue({
        invocation: {
          id: 'inv-1', parentRunId: runId, childPipelineId: 'pipeline-child',
          childRunId: 'run-child-1', status: 'running', inputParams: {},
          outputResults: {}, stageName: 'deploy-stage', outputMapping: {},
          createdAt: new Date(),
        },
        childRunId: 'run-child-1',
      });
      mockSubPipelineService.waitForCompletion.mockRejectedValue(
        new Error('Child pipeline failed: test step failed')
      );
      mockSubPipelineService.markFailed.mockResolvedValue({
        id: 'inv-1', parentRunId: runId, childPipelineId: 'pipeline-child',
        childRunId: 'run-child-1', status: 'failed', inputParams: {},
        outputResults: {}, stageName: 'deploy-stage', outputMapping: {},
        createdAt: new Date(), completedAt: new Date(),
        error: 'Child pipeline failed: test step failed',
      });

      const engine = createEngine(mockSubPipelineService);
      await engine.execute('pipeline-parent', TriggerType.MANUAL, 'test-user');

      await waitForCondition(() => {
        const calls = (mockRunService.updateStage as jest.Mock).mock.calls;
        return calls.some((c: any[]) => c[0]?.status === StageStatus.FAILED);
      }, 5000);

      const updateCalls = (mockRunService.updateStage as jest.Mock).mock.calls;
      const failedCall = updateCalls.find((c: any[]) => c[0]?.status === StageStatus.FAILED);
      expect(failedCall).toBeDefined();
      expect(failedCall[0].error).toContain('Sub-pipeline');

      expect(mockSubPipelineService.markFailed).toHaveBeenCalled();
    });
  });

  // ==================== 4. SubPipelineService not configured ====================

  describe('SubPipelineService not configured', () => {
    it('should throw error when sub-pipeline stage used without SubPipelineService', async () => {
      const pipeline: Pipeline = {
        ...createPipeline('test-pipeline'),
        id: 'pipeline-parent',
        yamlDefinition: buildPipelineYamlWithParams([
          {
            name: 'deploy',
            steps: [{ name: 'invoke-child', uses: 'sub-pipeline@v1', with: { pipelineId: 'pipeline-child' } }],
          },
        ]),
      };
      (mockPipelineService.getById as jest.Mock).mockResolvedValue(pipeline);

      const engine = createEngine(null);
      await engine.execute('pipeline-parent', TriggerType.MANUAL, 'test-user');

      await waitForCondition(() => {
        const calls = (mockRunService.updateStage as jest.Mock).mock.calls;
        return calls.some((c: any[]) => c[0]?.status === StageStatus.FAILED);
      }, 5000);

      const updateCalls = (mockRunService.updateStage as jest.Mock).mock.calls;
      const failedCall = updateCalls.find((c: any[]) => c[0]?.status === StageStatus.FAILED);
      expect(failedCall).toBeDefined();
      expect(failedCall[0].error).toContain('SubPipelineService not configured');
    });
  });

  // ==================== 5. Normal stages should not be affected ====================

  describe('normal stages (non-sub-pipeline)', () => {
    it('should execute normal stages without involving SubPipelineService', async () => {
      const pipeline: Pipeline = {
        ...createPipeline('test-pipeline'),
        id: 'pipeline-normal',
        yamlDefinition: buildPipelineYamlWithParams([
          {
            name: 'build',
            steps: [{ name: 'compile', uses: 'shell@v1' }],
          },
        ]),
      };
      (mockPipelineService.getById as jest.Mock).mockResolvedValue(pipeline);

      const engine = createEngine(mockSubPipelineService);
      await engine.execute('pipeline-normal', TriggerType.MANUAL, 'test-user');

      await waitForCondition(() => {
        const calls = (mockRunService.updateStage as jest.Mock).mock.calls;
        return calls.some((c: any[]) => c[0]?.status === StageStatus.SUCCESS);
      }, 5000);

      expect(mockSubPipelineService.invoke).not.toHaveBeenCalled();
      expect(mockSubPipelineService.waitForCompletion).not.toHaveBeenCalled();
    });
  });
});
