// orion-platform-service/src/api/script-routes.ts
// Inline Script API Routes

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { InlineScriptService } from '../services/inline-script/InlineScriptService';
import { InlineScriptApprovalRepository } from '../repositories/InlineScriptApprovalRepository';
import { AIGenerateService } from '../services/ai/AIGenerateService';
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

const executionSchema = {
  body: {
    type: 'object',
    required: ['taskId', 'pipelineRunId', 'stageId', 'config'],
    properties: {
      taskId: { type: 'string', minLength: 1 },
      pipelineRunId: { type: 'string', minLength: 1 },
      stageId: { type: 'string', minLength: 1 },
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
      workspace: { type: 'object' },
      env: { type: 'object' },
      timeout: { type: 'number', minimum: 1000, maximum: 300000 },
    },
  },
};

const dryRunSchema = {
  body: {
    type: 'object',
    required: ['taskId', 'pipelineRunId', 'stageId', 'config'],
    properties: {
      taskId: { type: 'string', minLength: 1 },
      pipelineRunId: { type: 'string', minLength: 1 },
      stageId: { type: 'string', minLength: 1 },
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

const approvalSchema = {
  body: {
    type: 'object',
    required: ['code', 'reason', 'permissions'],
    properties: {
      code: { type: 'string', minLength: 1, maxLength: 1048576 },
      reason: { type: 'string', minLength: 1, maxLength: 500 },
      permissions: { type: 'object' },
      expirationType: { type: 'string', enum: ['single_use', '24h', '7d'] },
    },
  },
};

export default async function scriptRoutes(app: FastifyInstance, options?: { database?: any }): Promise<void> {
  const approvalRepo = options?.database ? new InlineScriptApprovalRepository(options.database) : undefined;
  const scriptService = new InlineScriptService({ approvalRepo });
  const aiGenerateService = new AIGenerateService();

  // POST /scan - Security scan code
  app.post('/scan', {
    schema: scanSchema,
    onRequest: [authenticateUser, requirePermission({ resource: 'script', action: 'execute' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;
    if (!body.config || typeof body.config.code !== 'string') {
      return reply.code(400).send({ error: 'Missing or invalid config.code' });
    }
    const result = await scriptService.scanCode(body.config);
    return result;
  });

  // POST /dry-run - Dry run test
  app.post('/dry-run', {
    schema: dryRunSchema,
    onRequest: [authenticateUser, requirePermission({ resource: 'script', action: 'execute' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;
    if (!body.config || typeof body.config.code !== 'string') {
      return reply.code(400).send({ error: 'Missing or invalid config.code' });
    }
    const result = await scriptService.dryRun(body);
    return result;
  });

  // POST /execute - Execute inline script
  app.post('/execute', {
    schema: executionSchema,
    onRequest: [authenticateUser, requirePermission({ resource: 'script', action: 'execute' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
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
  app.post('/approval', {
    schema: approvalSchema,
    onRequest: [authenticateUser, requirePermission({ resource: 'script', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
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
  app.get('/approval/:approvalId', {
    onRequest: [authenticateUser, requirePermission({ resource: 'script', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { approvalId } = request.params as { approvalId: string };
    const tenantId = (request as any).tenantId;
    const result = await scriptService.getApprovalStatus(approvalId, tenantId);
    return result;
  });

  // POST /approval/:approvalId/decide - Approve/deny request
  app.post('/approval/:approvalId/decide', {
    onRequest: [authenticateUser, requirePermission({ resource: 'script', action: 'approve' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { approvalId } = request.params as { approvalId: string };
    const body = request.body as any;
    const tenantId = (request as any).tenantId;

    if (!body.decision || !['approved', 'denied'].includes(body.decision)) {
      return reply.code(400).send({ error: 'Invalid decision: must be "approved" or "denied"' });
    }

    if (!approvalRepo) {
      return reply.code(500).send({ error: 'Approval repository not configured' });
    }

    if (!tenantId) {
      return reply.code(401).send({ error: 'Unauthorized: missing tenant' });
    }

    try {
      const approval = await approvalRepo.findByApprovalId(approvalId, tenantId);
      if (!approval) {
        return reply.code(404).send({ error: `Approval ${approvalId} not found` });
      }

      if (approval.status !== 'pending') {
        return reply.code(400).send({ error: `Approval already ${approval.status}` });
      }

      if (body.decision === 'denied') {
        await approvalRepo.updateStatus(approvalId, tenantId, 'denied');
        return { approvalId, decision: 'denied', status: 'denied', currentApprovals: approval.current_approvals };
      }

      // Atomic increment - prevents race condition with concurrent approvals
      const result = await approvalRepo.incrementApprovals(approvalId, tenantId);

      // Track usage for single_use approvals after they become approved
      if (result.status === 'approved' && approval.expiration_type === 'single_use') {
        await approvalRepo.updateUsageCount(approvalId, tenantId, approval.used_count + 1);
      }

      return { approvalId, decision: 'approved', status: result.status, currentApprovals: result.currentApprovals };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('not found') || msg.includes('no longer pending')) {
        return reply.code(400).send({ error: 'Approval is no longer pending' });
      }
      return reply.code(500).send({ error: 'Failed to process decision' });
    }
  });

  // POST /ai-generate - AI generate script
  app.post('/ai-generate', {
    onRequest: [authenticateUser, requirePermission({ resource: 'script', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;
    if (!body.prompt) {
      return reply.code(400).send({ error: 'Missing prompt' });
    }

    const result = await aiGenerateService.generateScript({
      prompt: body.prompt,
      language: body.language || 'bash',
      level: body.level,
    });

    return {
      generated: true,
      code: result.code,
      language: result.language,
      warnings: result.warnings,
      requiresApproval: result.requiresApproval,
    };
  });

  logger.info('Inline script routes registered');
}
