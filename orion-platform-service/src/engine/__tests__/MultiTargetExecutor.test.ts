import { MultiTargetExecutor, MultiTargetResult, TargetResult, BatchResult } from '../MultiTargetExecutor';
import { GrayScaleController } from '../GrayScaleController';
import { StageExecutor } from '../StageExecutor';
import { PipelineRun } from '../../models/PipelineRun';
import { PipelineExecution } from '../PipelineEngine';
import { PipelineStage } from '../../models/Pipeline';

describe('MultiTargetExecutor', () => {
  let executor: MultiTargetExecutor;
  let grayscaleController: GrayScaleController;
  let mockStageExecutor: jest.Mocked<StageExecutor>;

  beforeEach(() => {
    grayscaleController = new GrayScaleController();
    mockStageExecutor = { executeStage: jest.fn() } as any;
    executor = new MultiTargetExecutor(grayscaleController, mockStageExecutor);
  });

  const makeRun = (): PipelineRun => ({
    id: 'run-1',
    pipelineId: 'pipe-1',
    pipelineVersion: '1.0',
    triggerType: 'api',
    status: 'running' as any,
    createdAt: new Date(),
    updatedAt: new Date(),
    context: {},
  });

  const makeExecution = (): PipelineExecution => ({
    run: makeRun(),
    stages: new Map(),
    pendingStages: new Set(),
    runningStages: new Set(),
    completedStages: new Set(),
  });

  const makeStage = (overrides: Partial<PipelineStage> = {}): PipelineStage => ({
    name: 'deploy',
    runsOn: 'ubuntu',
    steps: [{ name: 'deploy', uses: 'orion://actions/deploy' }],
    ...overrides,
  });

  describe('execute oneshot', () => {
    it('runs all targets in parallel and returns success', async () => {
      const stage = makeStage({
        targets: ['n1', 'n2'],
        executionMode: 'oneshot',
      });

      mockStageExecutor.executeStage.mockResolvedValue(undefined as any);

      const result = await executor.execute(makeRun(), makeExecution(), stage);

      expect(mockStageExecutor.executeStage).toHaveBeenCalledTimes(2);
      expect(result.overallSuccess).toBe(true);
      expect(result.totalBatches).toBe(1);
      expect(result.batchResults[0].targetResults).toHaveLength(2);
    });

    it('returns failure when a target throws', async () => {
      const stage = makeStage({
        targets: ['n1', 'n2'],
        executionMode: 'oneshot',
      });

      mockStageExecutor.executeStage
        .mockResolvedValueOnce(undefined as any)
        .mockRejectedValueOnce(new Error('timeout'));

      const result = await executor.execute(makeRun(), makeExecution(), stage);

      expect(result.overallSuccess).toBe(false);
      const results = result.batchResults[0].targetResults;
      expect(results.some((r: TargetResult) => !r.success)).toBe(true);
    });
  });

  describe('execute grayScale', () => {
    it('runs batches sequentially, parallel within batch', async () => {
      const stage = makeStage({
        targets: ['n1', 'n2', 'n3', 'n4'],
        executionMode: 'grayScale',
        batchSize: 2,
      });

      mockStageExecutor.executeStage.mockResolvedValue(undefined as any);

      const result = await executor.execute(makeRun(), makeExecution(), stage);

      expect(result.totalBatches).toBe(2);
      expect(mockStageExecutor.executeStage).toHaveBeenCalledTimes(4);
      expect(result.batchResults[0].targetResults).toHaveLength(2);
      expect(result.batchResults[1].targetResults).toHaveLength(2);
    });

    it('stops remaining batches when a grayScale batch fails', async () => {
      const stage = makeStage({
        targets: ['n1', 'n2', 'n3', 'n4'],
        executionMode: 'grayScale',
        batchSize: 2,
      });

      mockStageExecutor.executeStage
        .mockRejectedValueOnce(new Error('node-1 down'));

      const result = await executor.execute(makeRun(), makeExecution(), stage);

      expect(result.totalBatches).toBeLessThanOrEqual(2);
      expect(result.batchResults[0].batchSuccess).toBe(false);
      expect(result.overallSuccess).toBe(false);
    });
  });

  describe('empty targets', () => {
    it('throws when targets is empty', async () => {
      const stage = makeStage({ targets: [], executionMode: 'oneshot' });
      await expect(executor.execute(makeRun(), makeExecution(), stage))
        .rejects.toThrow();
    });
  });

  describe('per-target result', () => {
    it('records durationMs for each target', async () => {
      const stage = makeStage({
        targets: ['n1'],
        executionMode: 'oneshot',
      });

      mockStageExecutor.executeStage.mockImplementation(async () => {
        await new Promise((r) => setTimeout(r, 10));
      });

      const result = await executor.execute(makeRun(), makeExecution(), stage);
      const targetResult = result.batchResults[0].targetResults[0];
      expect(targetResult.durationMs).toBeGreaterThanOrEqual(5);
    });
  });
});
