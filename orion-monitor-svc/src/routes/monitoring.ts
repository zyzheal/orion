import { type FastifyInstance, type FastifyPluginOptions, type FastifyRequest, type FastifyReply } from 'fastify';
export async function monitoringRoutes(fastify: FastifyInstance, _opts: FastifyPluginOptions): Promise<void> {
  fastify.get('/monitoring', async (_request: FastifyRequest, reply: FastifyReply) => { reply.code(501).send({ error: 'Monitoring not yet implemented' }); });
  fastify.get('/monitoring/:id', async (_request: FastifyRequest, reply: FastifyReply) => { reply.code(501).send({ error: 'Monitoring not yet implemented' }); });
  fastify.post('/monitoring', async (_request: FastifyRequest, reply: FastifyReply) => { reply.code(501).send({ error: 'Monitoring not yet implemented' }); });
}
export async function alertRoutes(fastify: FastifyInstance, _opts: FastifyPluginOptions): Promise<void> {
  fastify.get('/alert', async (_request: FastifyRequest, reply: FastifyReply) => { reply.code(501).send({ error: 'Alerts not yet implemented' }); });
  fastify.post('/alert', async (_request: FastifyRequest, reply: FastifyReply) => { reply.code(501).send({ error: 'Alerts not yet implemented' }); });
}
