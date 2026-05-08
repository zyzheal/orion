// orion-platform-service/src/api/script-routes.ts
// Inline Script API Routes

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { InlineScriptService } from '../services/inline-script/InlineScriptService';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export default async function scriptRoutes(app: FastifyInstance, options?: { database?: any }): Promise<void> {
  const scriptService = new InlineScriptService();

  // POST /scan - Security scan code
  app.post('/scan', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;
    const result = await scriptService.scanCode(body.config);
    return result;
  });

  // POST /dry-run - Dry run test
  app.post('/dry-run', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;
    const result = await scriptService.dryRun(body);
    return result;
  });

  // POST /approval - Request Level 3 approval
  app.post('/approval', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;
    const tenantId = (request as any).tenantId;
    const userId = (request as any).userId;
    const result = await scriptService.requestApproval({ ...body, tenantId, userId });
    return result;
  });

  // GET /approval/:approvalId - Get approval status
  app.get('/approval/:approvalId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { approvalId } = request.params as { approvalId: string };
    const result = await scriptService.getApprovalStatus(approvalId);
    return result;
  });

  // POST /approval/:approvalId/decide - Approve/deny request
  app.post('/approval/:approvalId/decide', async (request: FastifyRequest, reply: FastifyReply) => {
    const { approvalId } = request.params as { approvalId: string };
    const body = request.body as any;
    return { approvalId, decision: body.decision, status: 'not_implemented' };
  });

  // POST /ai-generate - AI generate script
  app.post('/ai-generate', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;
    return { generated: false, status: 'not_implemented', prompt: body.prompt };
  });

  logger.info('Inline script routes registered');
}
