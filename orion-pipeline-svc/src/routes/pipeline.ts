import { type FastifyInstance, type FastifyPluginOptions } from 'fastify';
import { PipelineService } from '../services/PipelineService';
import { PipelineRepository, CreatePipelineInput } from '../services/PipelineRepository';

export async function pipelineRoutes(
  fastify: FastifyInstance,
  opts: FastifyPluginOptions & { database: any }
): Promise<void> {
  const repo = new PipelineRepository(opts.database);
  const pipelineService = new PipelineService(repo);

  fastify.post('/pipelines', async (request, reply) => {
    const pipeline = await pipelineService.create(request.body as CreatePipelineInput);
    return reply.code(201).send(pipeline);
  });

  fastify.get('/pipelines', async (request) => {
    const query = request.query as any;
    const tenantId = query.tenantId || 'default';
    return pipelineService.list(tenantId, query.projectId);
  });

  fastify.get('/pipelines/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const pipeline = await pipelineService.getById(id);
    if (!pipeline) return reply.code(404).send({ error: 'Pipeline not found' });
    return pipeline;
  });

  fastify.put('/pipelines/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const pipeline = await pipelineService.update(id, request.body as Partial<CreatePipelineInput>);
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
    const run = await pipelineService.triggerRun(id, request.body as { trigger_type?: string; trigger_by?: string });
    if (!run) return reply.code(404).send({ error: 'Pipeline not found' });
    return reply.code(201).send(run);
  });

  fastify.get('/pipelines/:id/runs', async (request) => {
    const { id } = request.params as { id: string };
    return pipelineService.listRuns(id);
  });

  fastify.get('/pipelines/:id/runs/:rid', async (request, reply) => {
    const { rid } = request.params as { id: string; rid: string };
    const run = await pipelineService.getRun(rid);
    if (!run) return reply.code(404).send({ error: 'Run not found' });
    return run;
  });

  fastify.post('/pipelines/:id/runs/:rid/cancel', async (request, reply) => {
    const { rid } = request.params as { id: string; rid: string };
    const result = await pipelineService.cancelRun(rid);
    if (!result) return reply.code(404).send({ error: 'Run not found' });
    return result;
  });
}
