import { type FastifyInstance, type FastifyPluginOptions, type FastifyRequest, type FastifyReply } from 'fastify';

export async function ticketRoutes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions & { database: any }
): Promise<void> {
  fastify.get('/tickets', async (_request: FastifyRequest, reply: FastifyReply) => {
    reply.code(501).send({ error: 'Ticket service not yet implemented' });
  });
  fastify.get('/tickets/:id', async (_request: FastifyRequest, reply: FastifyReply) => {
    reply.code(501).send({ error: 'Ticket service not yet implemented' });
  });
  fastify.post('/tickets', async (_request: FastifyRequest, reply: FastifyReply) => {
    reply.code(501).send({ error: 'Ticket service not yet implemented' });
  });
  fastify.put('/tickets/:id', async (_request: FastifyRequest, reply: FastifyReply) => {
    reply.code(501).send({ error: 'Ticket service not yet implemented' });
  });
  fastify.delete('/tickets/:id', async (_request: FastifyRequest, reply: FastifyReply) => {
    reply.code(501).send({ error: 'Ticket service not yet implemented' });
  });
}
