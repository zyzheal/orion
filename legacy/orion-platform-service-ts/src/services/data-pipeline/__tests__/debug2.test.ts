import { DataPipelineAsyncEngine } from '../DataPipelineAsyncEngine';
import { DataPipeline, PipelineStage } from '../types';

describe('debug2', () => {
  it('debug multiple pipelines', async () => {
    const stages1: PipelineStage[] = [
      { id: 's1', name: 'Extract', type: 'extract', config: {} },
      { id: 's2', name: 'Transform', type: 'transform', config: {}, dependsOn: ['s1'] },
      { id: 's3', name: 'Load', type: 'load', config: {}, dependsOn: ['s2'] },
    ];
    const stages2: PipelineStage[] = [
      { id: 'a1', name: 'A', type: 'extract', config: {} },
      { id: 'a2', name: 'B', type: 'load', config: {} },
    ];

    const p1: DataPipeline = {
      id: 'p1', tenantId: 't1', name: 'p1', stages: stages1, status: 'draft',
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    const p2: DataPipeline = {
      id: 'p2', tenantId: 't1', name: 'p2', stages: stages2, status: 'draft',
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };

    const engine = new DataPipelineAsyncEngine({
      maxConcurrency: 2,
      defaultTimeoutMs: 5000,
      maxRetries: 2,
      baseRetryDelayMs: 100,
      maxRetryDelayMs: 1000,
      retryJitter: false,
    });

    const exec1 = await engine.executePipeline(p1);
    const exec2 = await engine.executePipeline(p2);

    const check = async () => {
      const s1 = engine.getExecutionStatus(exec1.id);
      const s2 = engine.getExecutionStatus(exec2.id);
      console.log('exec1 status:', s1?.execution.status, 'tasks:', s1?.tasks.map(t => t.state).join(','));
      console.log('exec2 status:', s2?.execution.status, 'tasks:', s2?.tasks.map(t => t.state).join(','));
    };

    setTimeout(check, 500);
    setTimeout(check, 1000);
    setTimeout(check, 2000);
    setTimeout(check, 3000);

    await new Promise(r => setTimeout(r, 3500));
    engine.destroy();
  }, 10000);
});
