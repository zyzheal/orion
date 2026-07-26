import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AuditService } from '../services/AuditService';

export async function auditRoutes(app: FastifyInstance) {
  const service = new AuditService();

  app.get('/logs', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, string>;
    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '20', 10);
    const result = await service.queryLogs({
      limit,
      offset: (page - 1) * limit,
      tenantId: query.tenantId,
      userId: query.userId,
      action: query.action as any,
      resourceType: query.resourceType,
    });
    return reply.send({ entries: result.logs, total: result.total, page, limit, totalPages: Math.ceil(result.total / limit) });
  });

  app.get('/logs/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const log = await service.getLogById(params.id);
    return reply.send(log);
  });

  app.post('/logs', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;
    const log = await service.createLog(body);
    return reply.status(201).send({ entry: log });
  });

  app.get('/logs/:id/verify', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const log = await service.getLogById(params.id);
    return reply.send({ entry: log, isValid: !!log?.currentHash && log.currentHash.length > 0 });
  });

  app.post('/verify', async (_request: FastifyRequest, reply: FastifyReply) => {
    const result = await service.verifyChain();
    return reply.send({ result, verifiedAt: new Date().toISOString() });
  });

  app.get('/actions', async (_request: FastifyRequest, reply: FastifyReply) => {
    const actions = await service.getActionsSummary();
    return reply.send({ actions });
  });

  app.get('/resource-types', async (_request: FastifyRequest, reply: FastifyReply) => {
    const resourceTypes = await service.getResourceTypes();
    return reply.send({ resourceTypes });
  });

  app.get('/chain/info', async (_request: FastifyRequest, reply: FastifyReply) => {
    const chainInfo = await service.getChainInfo();
    return reply.send(chainInfo);
  });

  app.get('/storage/stats', async (_request: FastifyRequest, reply: FastifyReply) => {
    const stats = await service.getStorageStats();
    return reply.send({ stats });
  });

  app.get('/chain/genesis', async (_request: FastifyRequest, reply: FastifyReply) => {
    const genesis = await service.getGenesisEntry();
    return reply.send({ genesis });
  });

  app.get('/chain/latest', async (_request: FastifyRequest, reply: FastifyReply) => {
    const latest = await service.getLatestEntry();
    if (!latest) return reply.status(404).send({ error: 'NOT_FOUND', message: 'No audit logs found' });
    return reply.send(latest);
  });
}
