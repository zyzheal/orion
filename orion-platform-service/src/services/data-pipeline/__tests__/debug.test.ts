import { DataPipelineAsyncEngine } from '../DataPipelineAsyncEngine';
import { DataPipeline, PipelineStage } from '../types';

describe('debug', () => {
  it('debug concurrent', async () => {
    const stages: PipelineStage[] = [
      { id: 'a1', name: 'A', type: 'extract', config: {} },
      { id: 'a2', name: 'B', type: 'load', config: {} },
    ];

    const pipeline: DataPipeline = {
      id: 'p2',
      tenantId: 't1',
      name: 'p2',
      stages,
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const engine = new DataPipelineAsyncEngine({
      maxConcurrency: 2,
      defaultTimeoutMs: 5000,
      maxRetries: 2,
      baseRetryDelayMs: 100,
      maxRetryDelayMs: 1000,
      retryJitter: false,
    });

    const exec = await engine.executePipeline(pipeline);

    setTimeout(async () => {
      const status = engine.getExecutionStatus(exec.id);
      console.log('execution status:', status?.execution.status);
      console.log('tasks:', status?.tasks.map(t => ({ id: t.id, state: t.state })));
      engine.destroy();
    }, 3000);

    await new Promise(r => setTimeout(r, 3500));
  }, 10000);
});
