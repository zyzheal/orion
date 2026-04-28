/**
 * Approval Workflow API Routes
 * Prefix: /api/v1/approvals
 *
 * P0-7 Fix: Migrated ApprovalService to PostgreSQL Repository pattern
 * P0-5b Fix: Changed hardcoded `/approvals/` paths to relative paths to avoid double prefix
 */
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { ApprovalService } from '../services/approval/ApprovalService';

interface ApprovalRoutesOptions {
  database: DatabasePool;
}

export default async function approvalRoutes(app: FastifyInstance, options: ApprovalRoutesOptions): Promise<void> {
  const approvalService = new ApprovalService(options.database);

  // POST / - Create approval
  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const { title, description, requesterId, approverIds, requiredApprovals, metadata } = request.body as any;
    const req = await approvalService.createApproval(title, requesterId, approverIds, requiredApprovals || 1, description, metadata);
    return reply.send(req);
  });

  // GET / - List pending
  app.get('/', async (_request: FastifyRequest, reply: FastifyReply) => {
    const approvals = await approvalService.listPending();
    return reply.send({ approvals });
  });

  // GET /:id - Get detail
  app.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const req = await approvalService.getApproval(id);
    if (!req) return reply.status(404).send({ error: 'NOT_FOUND' });
    return reply.send(req);
  });

  // POST /:id/approve - Approve
  app.post('/:id/approve', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const { userId } = request.body as any;
    try {
      const result = await approvalService.approve(id, userId);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // POST /:id/reject - Reject
  app.post('/:id/reject', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const { userId } = request.body as any;
    try {
      const result = await approvalService.reject(id, userId);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });
}
