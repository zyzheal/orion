/**
 * Approval Workflow API Routes
 * Prefix: /api/v1/approvals
 */
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ApprovalService } from '../services/approval/ApprovalService';

export default async function approvalRoutes(app: FastifyInstance): Promise<void> {
  const approvalService = new ApprovalService();

  // POST /approvals - Create approval
  app.post('/approvals', async (request: FastifyRequest, reply: FastifyReply) => {
    const { title, description, requesterId, approverIds, requiredApprovals, metadata } = request.body as any;
    const req = await approvalService.createApproval(title, requesterId, approverIds, requiredApprovals || 1, description, metadata);
    return reply.send(req);
  });

  // GET /approvals - List pending
  app.get('/approvals', async (_request: FastifyRequest, reply: FastifyReply) => {
    const approvals = await approvalService.listPending();
    return reply.send({ approvals });
  });

  // GET /approvals/:id - Get detail
  app.get('/approvals/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const req = await approvalService.getApproval(id);
    if (!req) return reply.status(404).send({ error: 'NOT_FOUND' });
    return reply.send(req);
  });

  // POST /approvals/:id/approve - Approve
  app.post('/approvals/:id/approve', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const { userId } = request.body as any;
    try {
      const result = await approvalService.approve(id, userId);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // POST /approvals/:id/reject - Reject
  app.post('/approvals/:id/reject', async (request: FastifyRequest, reply: FastifyReply) => {
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
