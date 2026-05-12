import { type FastifyInstance, type FastifyPluginOptions } from 'fastify';
import { PipelineRunService } from '../services/PipelineRunService';

export async function pipelineRunRoutes(
  fastify: FastifyInstance,
  opts: FastifyPluginOptions & { database: any; eventBus: any; pipelineRunService?: PipelineRunService }
): Promise<void> {
  const service = opts.pipelineRunService || new PipelineRunService();

  // Get PipelineRun by ID
  fastify.get('/pipeline-runs/:id', async (request, reply) => {
    const runId = (request.params as any).id;
    const detail = await service.getRunDetail(runId);

    if (!detail || !detail.run) {
      return reply.code(404).send({ error: 'Pipeline run not found' });
    }

    return reply.send({
      run: detail.run,
      stages: detail.stages,
      tasks: detail.tasks,
    });
  });

  // List pipeline runs with optional filtering
  fastify.get('/pipeline-runs', async (request, reply) => {
    const query = request.query as any;
    const filter: any = {};

    if (query.pipelineId) filter.pipelineId = query.pipelineId;
    if (query.status) filter.status = Array.isArray(query.status) ? query.status : [query.status];
    if (query.triggerType) filter.triggerType = query.triggerType;
    if (query.limit) filter.limit = parseInt(query.limit, 10);
    if (query.offset) filter.offset = parseInt(query.offset, 10);

    const runs = await service.listRuns(filter);
    return reply.send({ runs, total: runs.length });
  });

  // Cancel a pipeline run
  fastify.post('/pipeline-runs/:id/cancel', async (request, reply) => {
    const runId = (request.params as any).id;
    const result = await service.cancelRun(runId);

    if (!result) {
      return reply.code(404).send({ error: 'Pipeline run not found or cannot be cancelled' });
    }

    return reply.send({ run: result });
  });
}
