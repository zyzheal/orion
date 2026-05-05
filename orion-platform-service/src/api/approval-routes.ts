/**
 * Approval Workflow API Routes
 * Prefix: /api/v1/approvals
 *
 * P0-7 Fix: Migrated ApprovalService to PostgreSQL Repository pattern
 * P0-5b Fix: Changed hardcoded `/approvals/` paths to relative paths to avoid double prefix
 * Phase 2: Added multi-level approval, emergency approval, and template endpoints
 */
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { ApprovalService } from '../services/approval/ApprovalService';
import { MultiLevelApprovalService } from '../services/approval/MultiLevelApprovalService';
import { EmergencyApprovalService } from '../services/approval/EmergencyApprovalService';
import { ApprovalTemplateService } from '../services/approval/ApprovalTemplateService';
import { ApprovalController } from './controllers/ApprovalController';
import { z } from 'zod';

const createApprovalSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  requesterId: z.string().min(1, 'Requester ID is required'),
  approverIds: z.array(z.string()).min(1, 'At least one approver is required'),
  requiredApprovals: z.number().min(1).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const approveRejectSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
});

const reviewSchema = z.object({
  reviewerId: z.string().min(1, 'Reviewer ID is required'),
  action: z.enum(['approve', 'reject']),
  comment: z.string().optional(),
});

const submitApprovalSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  requesterId: z.string().min(1),
  resourceType: z.string().min(1),
  resourceId: z.string().min(1),
  levels: z.array(z.object({
    levelIndex: z.number().optional(),
    approverIds: z.array(z.string()).min(1),
    requiredApprovals: z.number().min(1).optional(),
  })).min(1),
  mode: z.enum(['serial', 'parallel']).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const emergencyApprovalSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  requesterId: z.string().min(1),
  resourceType: z.string().min(1),
  resourceId: z.string().min(1),
  reason: z.enum(['production_incident', 'security_vulnerability', 'service_outage', 'data_corruption', 'other']),
  impactDescription: z.string().min(1),
  approverIds: z.array(z.string()).min(1),
});

const templateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  resourceType: z.string().min(1),
  levels: z.array(z.object({
    levelIndex: z.number().optional(),
    approverIds: z.array(z.string()).min(1),
    requiredApprovals: z.number().min(1).optional(),
  })).min(1),
  mode: z.enum(['serial', 'parallel']).optional(),
  isDefault: z.boolean().optional(),
});

interface ApprovalRoutesOptions {
  database: DatabasePool;
}

export default async function approvalRoutes(app: FastifyInstance, options: ApprovalRoutesOptions): Promise<void> {
  const approvalService = new ApprovalService(options.database);
  const multiLevelService = new MultiLevelApprovalService(options.database);
  const emergencyService = new EmergencyApprovalService(options.database);
  const templateService = new ApprovalTemplateService(options.database);
  const controller = new ApprovalController(multiLevelService, emergencyService, templateService);

  // ==================== Legacy Approval Endpoints (P0-7) ====================

  // POST / - Create approval (legacy)
  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = createApprovalSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        details: parseResult.error.issues,
      });
    }
    const { title, description, requesterId, approverIds, requiredApprovals, metadata } = parseResult.data;
    const req = await approvalService.createApproval(title, requesterId, approverIds, requiredApprovals || 1, description, metadata);
    return reply.send(req);
  });

  // GET / - List pending (legacy)
  app.get('/', async (_request: FastifyRequest, reply: FastifyReply) => {
    const approvals = await approvalService.listPending();
    return reply.send({ approvals });
  });

  // GET /:id - Get detail (legacy)
  app.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const req = await approvalService.getApproval(id);
    if (!req) return reply.status(404).send({ error: 'NOT_FOUND' });
    return reply.send(req);
  });

  // POST /:id/approve - Approve (legacy)
  app.post('/:id/approve', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const parseResult = approveRejectSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', details: parseResult.error.issues });
    }
    const { userId } = parseResult.data;
    try {
      const result = await approvalService.approve(id, userId);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // POST /:id/reject - Reject (legacy)
  app.post('/:id/reject', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const parseResult = approveRejectSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', details: parseResult.error.issues });
    }
    const { userId } = parseResult.data;
    try {
      const result = await approvalService.reject(id, userId);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // ==================== Phase 2: Multi-Level Approval ====================

  // POST /requests - Submit multi-level approval request
  app.post('/requests', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = submitApprovalSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        details: parseResult.error.issues,
      });
    }
    return controller.submitApprovalRequest(request, reply);
  });

  // GET /requests - List approval requests
  app.get('/requests', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listApprovalRequests(request, reply);
  });

  // GET /requests/:id - Get approval request detail (Phase 2)
  app.get('/requests/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getApprovalRequest(request, reply);
  });

  // POST /requests/:id/review - Review approval (approve/reject)
  app.post('/requests/:id/review', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = reviewSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        details: parseResult.error.issues,
      });
    }
    return controller.reviewApproval(request, reply);
  });

  // GET /pending - Get pending approvals for user
  app.get('/pending', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getPendingApprovals(request, reply);
  });

  // ==================== Phase 2: Emergency Approval ====================

  // POST /emergency - Emergency approval
  app.post('/emergency', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = emergencyApprovalSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        details: parseResult.error.issues,
      });
    }
    return controller.requestEmergencyApproval(request, reply);
  });

  // ==================== Phase 2: Approval Templates ====================

  // POST /templates - Create approval template
  app.post('/templates', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = templateSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        details: parseResult.error.issues,
      });
    }
    return controller.createTemplate(request, reply);
  });

  // GET /templates - Get template list
  app.get('/templates', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getTemplates(request, reply);
  });
}
