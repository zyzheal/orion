import { StageOrchestrator } from '../StageOrchestrator';
import { MultiTargetExecutor, MultiTargetResult } from '../MultiTargetExecutor';
import { GrayScaleController } from '../GrayScaleController';
import { StageExecutor } from '../StageExecutor';
import { PipelineRun, PipelineRunStatus } from '../../models/PipelineRun';
import { PipelineExecution } from '../PipelineEngine';
import { Stage, StageStatus } from '../../models/Stage';

describe('Multi-target StageOrchestrator integration', () => {
  let orchestrator: StageOrchestrator;
  let grayscaleController: GrayScaleController;
  let mockStageExecutor: jest.Mocked<StageExecutor>;
  let mockMultiTargetExecutor: jest.Mocked<MultiTargetExecutor>;
  let mockRunService: ReturnType<typeof createMockRunService>;
  let mockEventPublisher: ReturnType<typeof createMockEventPublisher>;

  const createMockRunService = () => ({
    updateStage: jest.fn().mockResolvedValue(undefined),
    completeRun: jest.fn().mockResolvedValue(undefined),
    getTasks: jest.fn().mockResolvedValue([{
      id: 'task-1',
      stageId: 'stage-1',
      name: 'task-1',
      type: 'shell',
      sequence: 0,
      status: 'pending',
      config: {},
      parameters: {},
      retryCount: 0,
      timeoutSeconds: 300,
    }]),
  });

  const createMockEventPublisher = () => ({
    publishStageStarted: jest.fn().mockResolvedValue(undefined),
    publishStageCompleted: jest.fn().mockResolvedValue(undefined),
    publishStageFailed: jest.fn().mockResolvedValue(undefined),
    publishStageSkipped: jest.fn().mockResolvedValue(undefined),
  });

  beforeEach(() => {
    grayscaleController = new GrayScaleController();
    mockStageExecutor = {
      executeStage: jest.fn().mockResolvedValue(undefined),
      executeTask: jest.fn().mockResolvedValue({ id: 'task-1', status: 'success' } as any),
    } as any;
    mockMultiTargetExecutor = { execute: jest.fn() } as any;
    mockRunService = createMockRunService();
    mockEventPublisher = createMockEventPublisher();

    orchestrator = new StageOrchestrator({
      pipelineService: {} as any,
      runService: mockRunService,
      eventPublisher: mockEventPublisher,
      sseBridge: null,
      stageExecutor: mockStageExecutor,
      subPipelineService: null,
      artifactService: null,
      autoRetryService: null,
      expressionEvaluator: {} as any,
      checkpointManager: null,
      debugController: null,
      secretsService: null,
      grayscaleController,
      multiTargetExecutor: mockMultiTargetExecutor as any,
    });
  });

  const makeRun = (): PipelineRun => ({
    id: 'run-1',
    pipelineId: 'pipe-1',
    status: PipelineRunStatus.RUNNING,
    triggerType: 'api' as any,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const makeStage = (id: string, hasTargets = false): Stage => ({
    id,
    runId: 'run-1',
    name: id,
    sequence: 0,
    status: StageStatus.PENDING,
    dependsOn: [],
    timeoutSeconds: 3600,
    retryCount: 0,
    maxRetries: 0,
    createdAt: new Date(),
    targets: hasTargets ? ['n1', 'n2'] : undefined,
    executionMode: hasTargets ? 'oneshot' : undefined,
  } as any);

  const makeExecution = (stageIds: string[], targetFlags: boolean[] = []): PipelineExecution => {
    const stages = new Map<string, Stage>();
    const pendingStages = new Set<string>();
    for (let i = 0; i < stageIds.length; i++) {
      const id = stageIds[i];
      const hasTargets = targetFlags[i] || false;
      stages.set(id, makeStage(id, hasTargets));
      pendingStages.add(id);
    }
    return {
      run: makeRun(),
      stages,
      pendingStages,
      runningStages: new Set(),
      completedStages: new Set(),
    };
  };

  const defaultCallbacks = {
    evaluateCondition: () => true,
    checkApprovalGate: async () => 'proceed',
    checkAndExecuteDeploymentStrategy: async () => null,
    checkStageQualityGate: async () => undefined,
    checkRunCompletion: () => {},
  };

  it('delegates multi-target stage to MultiTargetExecutor, single-target to StageExecutor', async () => {
    const mockResult: MultiTargetResult = {
      stageName: 'multi-target-stage',
      executionMode: 'oneshot',
      totalTargets: 2,
      totalBatches: 1,
      batchResults: [],
      overallSuccess: true,
    };
    mockMultiTargetExecutor.execute.mockResolvedValue(mockResult);

    const execution = makeExecution(['multi-target-stage', 'single-target-stage'], [true, false]);

    await orchestrator.executePendingStages(execution, defaultCallbacks);

    // Multi-target stage delegated to MultiTargetExecutor
    expect(mockMultiTargetExecutor.execute).toHaveBeenCalledWith(
      execution.run,
      execution,
      expect.objectContaining({ name: 'multi-target-stage', targets: ['n1', 'n2'] })
    );
    // Single-target stage delegated to StageExecutor
    expect(mockStageExecutor.executeTask).toHaveBeenCalledTimes(1);
    expect(mockStageExecutor.executeTask).toHaveBeenCalledWith(
      execution.run.pipelineId,
      execution.run.id,
      expect.objectContaining({ name: 'single-target-stage' }),
      expect.objectContaining({ name: 'task-1', type: 'shell' }),
      expect.objectContaining({ stageName: 'single-target-stage' })
    );
  });

  it('marks run as FAILED when multi-target execution fails', async () => {
    const mockResult: MultiTargetResult = {
      stageName: 'multi-target-stage',
      executionMode: 'oneshot',
      totalTargets: 2,
      totalBatches: 1,
      batchResults: [],
      overallSuccess: false,
    };
    mockMultiTargetExecutor.execute.mockResolvedValue(mockResult);

    const execution = makeExecution(['multi-target-stage'], [true]);

    await orchestrator.executePendingStages(execution, defaultCallbacks);

    expect(mockRunService.completeRun).toHaveBeenCalledWith(
      expect.any(String),
      PipelineRunStatus.FAILED
    );
  });

  it('routes stages without targets to single-target path', async () => {
    mockStageExecutor.executeStage.mockResolvedValue(undefined as any);

    const execution = makeExecution(['single-target-stage'], [false]);

    await orchestrator.executePendingStages(execution, defaultCallbacks);

    // MultiTargetExecutor must NOT be called
    expect(mockMultiTargetExecutor.execute).not.toHaveBeenCalled();
    // StageExecutor MUST be called for the single-target stage
    expect(mockStageExecutor.executeTask).toHaveBeenCalledTimes(1);
  });

  it('executes only multi-target stages when no single-target stages present', async () => {
    const mockResult: MultiTargetResult = {
      stageName: 'multi-target-stage',
      executionMode: 'grayScale',
      totalTargets: 4,
      totalBatches: 2,
      batchResults: [
        { batchIndex: 0, targets: ['n1', 'n2'], targetResults: [], batchSuccess: true },
        { batchIndex: 1, targets: ['n3', 'n4'], targetResults: [], batchSuccess: true },
      ],
      overallSuccess: true,
    };
    mockMultiTargetExecutor.execute.mockResolvedValue(mockResult);

    const execution = makeExecution(['multi-target-stage'], [true]);

    await orchestrator.executePendingStages(execution, defaultCallbacks);

    expect(mockMultiTargetExecutor.execute).toHaveBeenCalledTimes(1);
    expect(mockStageExecutor.executeStage).not.toHaveBeenCalled();
  });
});
