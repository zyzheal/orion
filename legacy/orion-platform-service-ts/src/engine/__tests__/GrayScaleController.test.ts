import { GrayScaleController, ExecutionBatch } from '../../engine/GrayScaleController';
import { PipelineStage } from '../../models/Pipeline';

describe('GrayScaleController', () => {
  const controller = new GrayScaleController();

  const makeStage = (overrides: Partial<PipelineStage> = {}): PipelineStage => ({
    name: 'test-stage',
    runsOn: 'ubuntu',
    steps: [{ name: 'run', uses: 'orion://actions/run' }],
    ...overrides,
  });

  describe('no targets', () => {
    it('returns empty array when targets is undefined', () => {
      const stage = makeStage();
      expect(controller.splitBatches(stage)).toEqual([]);
    });

    it('returns empty array when targets is empty', () => {
      const stage = makeStage({ targets: [] });
      expect(controller.splitBatches(stage)).toEqual([]);
    });
  });

  describe('oneshot mode', () => {
    it('returns single batch with all targets', () => {
      const stage = makeStage({
        targets: ['node-1', 'node-2', 'node-3'],
        executionMode: 'oneshot',
      });
      const batches = controller.splitBatches(stage);
      expect(batches).toHaveLength(1);
      expect(batches[0].targets).toEqual(['node-1', 'node-2', 'node-3']);
      expect(batches[0].totalBatches).toBe(1);
      expect(batches[0].totalTargets).toBe(3);
    });
  });

  describe('grayScale mode', () => {
    it('splits into batches of batchSize=2', () => {
      const stage = makeStage({
        targets: ['n1', 'n2', 'n3', 'n4', 'n5'],
        executionMode: 'grayScale',
        batchSize: 2,
      });
      const batches = controller.splitBatches(stage);
      expect(batches).toHaveLength(3);
      expect(batches[0].targets).toEqual(['n1', 'n2']);
      expect(batches[1].targets).toEqual(['n3', 'n4']);
      expect(batches[2].targets).toEqual(['n5']);
      expect(batches[0].totalBatches).toBe(3);
      expect(batches[0].batchIndex).toBe(0);
      expect(batches[1].batchIndex).toBe(1);
      expect(batches[2].batchIndex).toBe(2);
    });

    it('defaults batchSize to 1 when omitted', () => {
      const stage = makeStage({
        targets: ['n1', 'n2'],
        executionMode: 'grayScale',
      });
      const batches = controller.splitBatches(stage);
      expect(batches).toHaveLength(2);
      expect(batches[0].targets).toEqual(['n1']);
      expect(batches[1].targets).toEqual(['n2']);
    });

    it('throws on invalid batchSize < 1', () => {
      const stage = makeStage({
        targets: ['n1'],
        executionMode: 'grayScale',
        batchSize: 0,
      });
      expect(() => controller.splitBatches(stage)).toThrow();
    });
  });

  describe('no executionMode declared', () => {
    it('treats all targets as single parallel batch', () => {
      const stage = makeStage({
        targets: ['n1', 'n2'],
      });
      const batches = controller.splitBatches(stage);
      expect(batches).toHaveLength(1);
      expect(batches[0].targets).toEqual(['n1', 'n2']);
    });
  });
});
