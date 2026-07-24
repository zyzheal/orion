/**
 * ApprovalController - Handles request/response logic for approval endpoints.
 *
 * Phase 2: Multi-level approval, emergency approval, and template endpoints.
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { MultiLevelApprovalService } from '../../services/approval/MultiLevelApprovalService';
import { EmergencyApprovalService } from '../../services/approval/EmergencyApprovalService';
import { ApprovalTemplateService } from '../../services/ApprovalTemplateService';

export class ApprovalController {
  constructor(
    private multiLevelService: MultiLevelApprovalService,
    private emergencyService: EmergencyApprovalService,
    private templateService: ApprovalTemplateService,
  ) {}

  /**
   * POST /requests - Submit multi-level approval request
   */
  async submitApprovalRequest(request: FastifyRequest, reply: FastifyReply) {
    const body = request.body as any;
    const tenantId = (request.headers as any)['x-tenant-id'] ?? 'default';
    const result = await this.multiLevelService.submitApprovalRequest(tenantId, body);
    return reply.send(result);
  }

  /**
   * GET /requests - List approval requests
   */
  async listApprovalRequests(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as any;
    const tenantId = (request.headers as any)['x-tenant-id'] ?? 'default';
    const results = await this.multiLevelService.getPendingApprovals('any', tenantId);
    return reply.send({ requests: results });
  }

  /**
   * GET /requests/:id - Get approval request detail
   */
  async getApprovalRequest(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    try {
      const chain = await this.multiLevelService.getApprovalChain(id);
      return reply.send(chain);
    } catch (err: any) {
      return reply.status(404).send({ error: err.message });
    }
  }

  /**
   * POST /requests/:id/review - Review approval (approve/reject)
   */
  async reviewApproval(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    try {
      const result = await this.multiLevelService.review(id, body.reviewerId, body.action, body.comment);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  }

  /**
   * GET /pending - Get pending approvals for user
   */
  async getPendingApprovals(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as any;
    const userId = query.userId ?? (request.headers as any)['x-user-id'];
    const tenantId = (request.headers as any)['x-tenant-id'] ?? 'default';
    if (!userId) {
      return reply.status(400).send({ error: 'userId query parameter or x-user-id header is required' });
    }
    const results = await this.multiLevelService.getPendingApprovals(userId, tenantId);
    return reply.send({ pending: results });
  }

  /**
   * POST /emergency - Emergency approval
   */
  async requestEmergencyApproval(request: FastifyRequest, reply: FastifyReply) {
    const body = request.body as any;
    const tenantId = (request.headers as any)['x-tenant-id'] ?? 'default';
    const result = await this.emergencyService.requestEmergencyApproval(tenantId, body);
    return reply.send(result);
  }

  /**
   * POST /templates - Create approval template
   */
  async createTemplate(request: FastifyRequest, reply: FastifyReply) {
    const body = request.body as any;
    const tenantId = (request.headers as any)['x-tenant-id'] ?? 'default';
    const template = await this.templateService.createTemplate(tenantId, body);
    return reply.send(template);
  }

  /**
   * GET /templates - Get template list
   */
  async getTemplates(request: FastifyRequest, reply: FastifyReply) {
    const tenantId = (request.headers as any)['x-tenant-id'] ?? 'default';
    const templates = await this.templateService.getTemplates(tenantId);
    return reply.send({ templates });
  }
}
