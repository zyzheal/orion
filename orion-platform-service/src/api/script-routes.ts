// orion-platform-service/src/api/script-routes.ts
// Inline Script API Routes

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { InlineScriptService } from '../services/inline-script/InlineScriptService';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// Input validation schema
const scanSchema = {
  body: {
    type: 'object',
    required: ['config'],
    properties: {
      config: {
        type: 'object',
        required: ['code', 'level', 'language'],
        properties: {
          code: { type: 'string', minLength: 1 },
          level: { type: 'string', enum: ['safe', 'standard', 'advanced'] },
          language: { type: 'string', enum: ['javascript', 'typescript', 'python', 'shell'] },
          permissions: { type: 'object' },
          approvalId: { type: 'string' },
        },
      },
    },
  },
};

export default async function scriptRoutes(app: FastifyInstance, options?: { database?: any }): Promise<void> {
  const scriptService = new InlineScriptService({
    approvalRepo: options?.database ? undefined : undefined, // Will be wired when DB is available
  });

  // POST /scan - Security scan code
  app.post('/scan', { schema: scanSchema }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;
    if (!body.config || typeof body.config.code !== 'string') {
      return reply.code(400).send({ error: 'Missing or invalid config.code' });
    }
    const result = await scriptService.scanCode(body.config);
    return result;
  });

  // POST /dry-run - Dry run test
  app.post('/dry-run', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;
    if (!body.config || typeof body.config.code !== 'string') {
      return reply.code(400).send({ error: 'Missing or invalid config.code' });
    }
    const result = await scriptService.dryRun(body);
    return result;
  });

  // POST /execute - Execute inline script
  app.post('/execute', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;
    const tenantId = (request as any).tenantId;
    const userId = (request as any).userId;

    if (!body.config || typeof body.config.code !== 'string') {
      return reply.code(400).send({ error: 'Missing or invalid config.code' });
    }

    if (!body.taskId || !body.pipelineRunId || !body.stageId) {
      return reply.code(400).send({ error: 'Missing taskId, pipelineRunId, or stageId' });
    }

    const result = await scriptService.execute({
      taskId: body.taskId,
      pipelineRunId: body.pipelineRunId,
      stageId: body.stageId,
      config: body.config,
      workspace: body.workspace,
      env: body.env,
      timeout: body.timeout,
      userId,
      tenantId,
    });

    if (result.status === 'pending_approval') {
      return reply.code(202).send(result);
    }

    return result;
  });

  // POST /approval - Request Level 3 approval
  app.post('/approval', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;
    const tenantId = (request as any).tenantId;
    const userId = (request as any).userId;

    if (!body.code || !body.reason) {
      return reply.code(400).send({ error: 'Missing code or reason' });
    }

    if (!tenantId || !userId) {
      return reply.code(401).send({ error: 'Unauthorized: missing tenant or user' });
    }

    const result = await scriptService.requestApproval({ ...body, tenantId, userId });
    return result;
  });

  // GET /approval/:approvalId - Get approval status
  app.get('/approval/:approvalId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { approvalId } = request.params as { approvalId: string };
    const tenantId = (request as any).tenantId;
    const result = await scriptService.getApprovalStatus(approvalId, tenantId);
    return result;
  });

  // POST /approval/:approvalId/decide - Approve/deny request
  app.post('/approval/:approvalId/decide', async (request: FastifyRequest, reply: FastifyReply) => {
    const { approvalId } = request.params as { approvalId: string };
    const body = request.body as any;
    const tenantId = (request as any).tenantId;

    if (!body.decision || !['approved', 'denied'].includes(body.decision)) {
      return reply.code(400).send({ error: 'Invalid decision: must be "approved" or "denied"' });
    }

    // TODO: wire to database when approval service is fully implemented
    return { approvalId, decision: body.decision, status: 'not_implemented' };
  });

  // POST /ai-generate - AI generate script
  app.post('/ai-generate', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;
    if (!body.prompt) {
      return reply.code(400).send({ error: 'Missing prompt' });
    }
    return { generated: false, status: 'not_implemented', prompt: body.prompt };
  });

  logger.info('Inline script routes registered');
}
