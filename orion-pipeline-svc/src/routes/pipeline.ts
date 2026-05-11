import { type FastifyInstance, type FastifyPluginOptions } from 'fastify';
import { PipelineService } from '../services/PipelineService';

export async function pipelineRoutes(
  fastify: FastifyInstance,
  opts: FastifyPluginOptions & { database: any }
): Promise<void> {
  const pipelineService = new PipelineService(opts.database);

  fastify.post('/pipelines', async (request, reply) => {
    const pipeline = await pipelineService.create(request.body as import('../services/PipelineService').CreatePipelineInput);
    return reply.code(201).send(pipeline);
  });

  fastify.get('/pipelines', async (request) => {
    const query = request.query as any;
    return pipelineService.list({
      projectId: query.projectId,
      status: query.status,
      limit: query.limit || 20,
      offset: query.offset || 0,
    });
  });

  fastify.get('/pipelines/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const pipeline = await pipelineService.getById(id);
    if (!pipeline) return reply.code(404).send({ error: 'Pipeline not found' });
    return pipeline;
  });

  fastify.put('/pipelines/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const pipeline = await pipelineService.update(id, request.body as Partial<import('../services/PipelineService').CreatePipelineInput>);
    if (!pipeline) return reply.code(404).send({ error: 'Pipeline not found' });
    return pipeline;
  });

  fastify.delete('/pipelines/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const deleted = await pipelineService.delete(id);
    if (!deleted) return reply.code(404).send({ error: 'Pipeline not found' });
    return reply.code(204).send();
  });

  fastify.post('/pipelines/:id/run', async (request, reply) => {
    const { id } = request.params as { id: string };
    const run = await pipelineService.run(id, request.body as { envOverrides?: Record<string, string>; stages?: string[] });
    if (!run) return reply.code(404).send({ error: 'Pipeline not found' });
    return reply.code(201).send(run);
  });

  fastify.get('/pipelines/:id/runs', async (request) => {
    const { id } = request.params as { id: string };
    return pipelineService.listRuns(id);
  });

  fastify.get('/pipelines/:id/runs/:rid', async (request, reply) => {
    const { id, rid } = request.params as { id: string; rid: string };
    const run = await pipelineService.getRun(id, rid);
    if (!run) return reply.code(404).send({ error: 'Run not found' });
    return run;
  });

  fastify.post('/pipelines/:id/runs/:rid/cancel', async (request, reply) => {
    const { id, rid } = request.params as { id: string; rid: string };
    const result = await pipelineService.cancelRun(id, rid);
    if (!result) return reply.code(404).send({ error: 'Run not found' });
    return result;
  });
}
