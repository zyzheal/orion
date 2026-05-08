/**
 * ApprovalController - 审批工作流控制器
 *
 * Phase 2: 处理多级审批、紧急审批、审批模板相关的 HTTP 请求。
 */
import { FastifyRequest, FastifyReply } from 'fastify';
import { MultiLevelApprovalService, ApprovalAction, ApprovalMode, ApprovalRequestInput, ApprovalRequestDetail } from '../../services/approval/MultiLevelApprovalService';
import { EmergencyApprovalService, EmergencyReason, EmergencyApprovalInput } from '../../services/approval/EmergencyApprovalService';
import { ApprovalTemplateService, ApprovalTemplateInput } from '../../services/approval/ApprovalTemplateService';
import { ApprovalGateService } from '../../services/pipeline/ApprovalGateService';

// ==================== Request/Response Types ====================

interface ApprovalRequestBody {
  title: string;
  description?: string;
  requesterId: string;
  resourceType: string;
  resourceId: string;
  levels: Array<{
    levelIndex?: number;
    approverIds?: string[];
    requiredApprovals?: number;
  }>;
  mode?: ApprovalMode;
  metadata?: Record<string, unknown>;
  tenantId?: string;
}

interface ReviewRequestBody {
  reviewerId: string;
  action: 'approve' | 'reject';
  comment?: string;
}

interface ListQueryParams {
  tenantId?: string;
  userId?: string;
}

interface EmergencyApprovalRequestBody {
  title: string;
  description: string;
  requesterId: string;
  resourceType: string;
  resourceId: string;
  reason: EmergencyReason;
  impactDescription: string;
  approverIds: string[] | string;
  metadata?: Record<string, unknown>;
  tenantId?: string;
}

interface TemplateRequestBody {
  name: string;
  description?: string;
  resourceType: string;
  levels: Array<{
    levelIndex?: number;
    approverIds?: string[];
    requiredApprovals?: number;
  }>;
  mode?: ApprovalMode;
  isDefault?: boolean;
  tenantId?: string;
}

interface FastifyRequestWithAuth extends FastifyRequest {
  tenantId?: string;
  userId?: string;
}

export class ApprovalController {
  private multiLevelService: MultiLevelApprovalService;
  private emergencyService: EmergencyApprovalService;
  private templateService: ApprovalTemplateService;
  private approvalGateService: ApprovalGateService | null;

  constructor(
    multiLevelService: MultiLevelApprovalService,
    emergencyService: EmergencyApprovalService,
    templateService: ApprovalTemplateService,
    approvalGateService?: ApprovalGateService,
  ) {
    this.multiLevelService = multiLevelService;
    this.emergencyService = emergencyService;
    this.templateService = templateService;
    this.approvalGateService = approvalGateService || null;
  }

  // ==================== Multi-Level Approval ====================

  /**
   * 提交审批请求
   * POST /api/v1/approvals/requests
   */
  async submitApprovalRequest(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = request.body as ApprovalRequestBody;
      const { title, description, requesterId, resourceType, resourceId, levels, mode } = body;

      if (!title || !requesterId || !resourceType || !resourceId || !levels || !Array.isArray(levels) || levels.length === 0) {
        return reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Missing required fields: title, requesterId, resourceType, resourceId, levels',
        });
      }

      const authRequest = request as FastifyRequestWithAuth;
      const tenantId = authRequest.tenantId || body.tenantId || 'default';

      const input: ApprovalRequestInput = {
        title,
        description,
        requesterId,
        resourceType,
        resourceId,
        levels: levels.map((l, i) => ({
          levelIndex: l.levelIndex ?? i,
          approverIds: l.approverIds || [],
          requiredApprovals: l.requiredApprovals || 1,
        })),
        mode: mode as ApprovalMode,
        metadata: body.metadata,
      };

      const result = await this.multiLevelService.submitApprovalRequest(tenantId, input);
      return reply.status(201).send({ success: true, data: result });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'SUBMIT_ERROR';
      return reply.status(500).send({ error: 'SUBMIT_ERROR', message });
    }
  }

  /**
   * 获取审批列表
   * GET /api/v1/approvals/requests
   */
  async listApprovalRequests(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = request.query as ListQueryParams;
      const authRequest = request as FastifyRequestWithAuth;
      const tenantId = query.tenantId || authRequest.tenantId || 'default';

      // Reuse listPending from the existing approval-routes approach
      // For full listing, we return pending approvals for the tenant
      // The detailed list endpoint should query the repository directly
      return reply.status(200).send({
        success: true,
        message: 'Use /approvals/pending for pending items, /approvals/requests/:id for details',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'LIST_ERROR';
      return reply.status(500).send({ error: 'LIST_ERROR', message });
    }
  }

  /**
   * 获取审批详情
   * GET /api/v1/approvals/requests/:id
   */
  async getApprovalRequest(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const chain = await this.multiLevelService.getApprovalChain(id);
      return reply.status(200).send({ success: true, data: chain });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'GET_ERROR';
      if (message.includes('not found')) {
        return reply.status(404).send({ error: 'NOT_FOUND', message });
      }
      return reply.status(500).send({ error: 'GET_ERROR', message });
    }
  }

  /**
   * 审批操作
   * POST /api/v1/approvals/requests/:id/review
   */
  async reviewApproval(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as ReviewRequestBody;
      const { reviewerId, action, comment } = body;

      if (!reviewerId || !action) {
        return reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Missing required fields: reviewerId, action',
        });
      }

      if (action !== 'approve' && action !== 'reject') {
        return reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'action must be "approve" or "reject"',
        });
      }

      const approvalAction = action === 'approve' ? ApprovalAction.APPROVE : ApprovalAction.REJECT;
      const result = await this.multiLevelService.review(id, reviewerId, approvalAction, comment);
      return reply.status(200).send({ success: true, data: result });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'REVIEW_ERROR';
      if (message.includes('not found') || message.includes('Not authorized') || message.includes('not pending')) {
        return reply.status(400).send({ error: 'REVIEW_ERROR', message });
      }
      return reply.status(500).send({ error: 'REVIEW_ERROR', message });
    }
  }

  /**
   * 获取待审批列表
   * GET /api/v1/approvals/pending
   */
  async getPendingApprovals(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = request.query as ListQueryParams;
      const authRequest = request as FastifyRequestWithAuth;
      const userId = query.userId || authRequest.userId;
      const tenantId = query.tenantId || authRequest.tenantId || 'default';

      if (!userId) {
        return reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'userId is required',
        });
      }

      const pending = await this.multiLevelService.getPendingApprovals(userId, tenantId);
      return reply.status(200).send({ success: true, data: pending });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'PENDING_ERROR';
      return reply.status(500).send({ error: 'PENDING_ERROR', message });
    }
  }

  // ==================== Emergency Approval ====================

  /**
   * 紧急审批
   * POST /api/v1/approvals/emergency
   */
  async requestEmergencyApproval(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = request.body as EmergencyApprovalRequestBody;
      const { title, description, requesterId, resourceType, resourceId, reason, impactDescription, approverIds } = body;

      if (!title || !description || !requesterId || !resourceType || !resourceId || !reason || !impactDescription || !approverIds) {
        return reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Missing required fields: title, description, requesterId, resourceType, resourceId, reason, impactDescription, approverIds',
        });
      }

      const authRequest = request as FastifyRequestWithAuth;
      const tenantId = authRequest.tenantId || body.tenantId || 'default';

      const input: EmergencyApprovalInput = {
        title,
        description,
        requesterId,
        resourceType,
        resourceId,
        reason: reason as EmergencyReason,
        impactDescription,
        approverIds: Array.isArray(approverIds) ? approverIds : [approverIds],
        metadata: body.metadata,
      };

      const result = await this.emergencyService.requestEmergencyApproval(tenantId, input);
      return reply.status(201).send({ success: true, data: result });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'EMERGENCY_ERROR';
      return reply.status(500).send({ error: 'EMERGENCY_ERROR', message });
    }
  }

  // ==================== Approval Templates ====================

  /**
   * 创建审批模板
   * POST /api/v1/approvals/templates
   */
  async createTemplate(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = request.body as TemplateRequestBody;
      const { name, description, resourceType, levels, mode, isDefault } = body;

      if (!name || !resourceType || !levels || !Array.isArray(levels)) {
        return reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Missing required fields: name, resourceType, levels',
        });
      }

      const authRequest = request as FastifyRequestWithAuth;
      const tenantId = authRequest.tenantId || body.tenantId || 'default';

      const input: ApprovalTemplateInput = {
        name,
        description,
        resourceType,
        levels: levels.map((l, i) => ({
          levelIndex: l.levelIndex ?? i,
          approverIds: l.approverIds || [],
          requiredApprovals: l.requiredApprovals || 1,
        })),
        mode,
        isDefault,
      };

      const template = await this.templateService.createTemplate(tenantId, input);
      return reply.status(201).send({ success: true, data: template });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'TEMPLATE_ERROR';
      return reply.status(500).send({ error: 'TEMPLATE_ERROR', message });
    }
  }

  /**
   * 获取模板列表
   * GET /api/v1/approvals/templates
   */
  async getTemplates(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = request.query as ListQueryParams;
      const authRequest = request as FastifyRequestWithAuth;
      const tenantId = query.tenantId || authRequest.tenantId || 'default';

      const templates = await this.templateService.getTemplates(tenantId);
      return reply.status(200).send({ success: true, data: templates });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'TEMPLATES_ERROR';
      return reply.status(500).send({ error: 'TEMPLATES_ERROR', message });
    }
  }

  // ==================== Pipeline Approval Gate ====================

  /**
   * 获取 Pipeline Run 的所有审批请求
   * GET /api/v1/pipeline-runs/:runId/approvals
   */
  async listByRun(request: FastifyRequest, reply: FastifyReply) {
    if (!this.approvalGateService) {
      return reply.status(501).send({ error: 'NOT_IMPLEMENTED', message: 'Approval gate not configured' });
    }
    try {
      const { runId } = request.params as { runId: string };
      const approvals = this.approvalGateService.getByRun(runId);
      return reply.status(200).send({ success: true, data: approvals });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'LIST_ERROR';
      return reply.status(500).send({ error: 'LIST_ERROR', message });
    }
  }

  /**
   * 获取特定 Stage 的审批状态
   * GET /api/v1/pipeline-runs/:runId/stages/:stageId/approval
   */
  async getStatus(request: FastifyRequest, reply: FastifyReply) {
    if (!this.approvalGateService) {
      return reply.status(501).send({ error: 'NOT_IMPLEMENTED', message: 'Approval gate not configured' });
    }
    try {
      const { runId, stageId } = request.params as { runId: string; stageId: string };
      const status = this.approvalGateService.getStatus(runId, stageId);
      if (!status) {
        return reply.status(404).send({ error: 'NOT_FOUND', message: 'No approval request found' });
      }
      return reply.status(200).send({ success: true, data: status });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'GET_ERROR';
      return reply.status(500).send({ error: 'GET_ERROR', message });
    }
  }

  /**
   * 审批通过
   * POST /api/v1/pipeline-runs/:runId/stages/:stageId/approve
   */
  async approve(request: FastifyRequest, reply: FastifyReply) {
    if (!this.approvalGateService) {
      return reply.status(501).send({ error: 'NOT_IMPLEMENTED', message: 'Approval gate not configured' });
    }
    try {
      const { runId, stageId } = request.params as { runId: string; stageId: string };
      const body = request.body as { userId: string; comment?: string };
      const { userId, comment } = body;

      if (!userId) {
        return reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'userId is required',
        });
      }

      const result = await this.approvalGateService.approve(runId, stageId, userId, comment);
      return reply.status(200).send({ success: true, data: result });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'APPROVE_ERROR';
      if (message.includes('not authorized') || message.includes('No pending')) {
        return reply.status(400).send({ error: 'APPROVE_ERROR', message });
      }
      return reply.status(500).send({ error: 'APPROVE_ERROR', message });
    }
  }

  /**
   * 审批拒绝
   * POST /api/v1/pipeline-runs/:runId/stages/:stageId/reject
   */
  async reject(request: FastifyRequest, reply: FastifyReply) {
    if (!this.approvalGateService) {
      return reply.status(501).send({ error: 'NOT_IMPLEMENTED', message: 'Approval gate not configured' });
    }
    try {
      const { runId, stageId } = request.params as { runId: string; stageId: string };
      const body = request.body as { userId: string; comment?: string };
      const { userId, comment } = body;

      if (!userId) {
        return reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'userId is required',
        });
      }

      const result = await this.approvalGateService.reject(runId, stageId, userId, comment);
      return reply.status(200).send({ success: true, data: result });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'REJECT_ERROR';
      if (message.includes('not authorized') || message.includes('No pending')) {
        return reply.status(400).send({ error: 'REJECT_ERROR', message });
      }
      return reply.status(500).send({ error: 'REJECT_ERROR', message });
    }
  }
}
