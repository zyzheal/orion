import { PipelineStage } from '../../models/Pipeline';

describe('PipelineStage multi-target extension', () => {
  const baseStage: PipelineStage = {
    name: 'deploy',
    runsOn: 'ubuntu-latest',
    steps: [{ name: 'deploy', uses: 'orion://actions/deploy' }],
  };

  it('single-target stage should not require targets field', () => {
    expect(baseStage.targets).toBeUndefined();
    expect(baseStage.executionMode).toBeUndefined();
  });

  it('multi-target stage with oneshot mode should be valid', () => {
    const stage: PipelineStage = {
      ...baseStage,
      targets: ['node-1', 'node-2', 'node-3'],
      executionMode: 'oneshot',
    };
    expect(stage.targets).toHaveLength(3);
    expect(stage.executionMode).toBe('oneshot');
  });

  it('multi-target stage with grayScale mode and batchSize should be valid', () => {
    const stage: PipelineStage = {
      ...baseStage,
      targets: ['node-1', 'node-2', 'node-3', 'node-4'],
      executionMode: 'grayScale',
      batchSize: 2,
    };
    expect(stage.executionMode).toBe('grayScale');
    expect(stage.batchSize).toBe(2);
  });

  it('grayScale batchSize defaults to 1', () => {
    const stage: PipelineStage = {
      ...baseStage,
      targets: ['node-1'],
      executionMode: 'grayScale',
    };
    expect(stage.batchSize).toBeUndefined();
  });
});
