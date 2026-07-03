/**
 * Approval Routes - 审批管理路由
 *
 * 注册多级审批、紧急审批、模板、审批门禁相关端点。
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Pool } from 'pg';
import { ApprovalController } from './controllers/ApprovalController';
import { MultiLevelApprovalService } from '../services/approval/MultiLevelApprovalService';
import { EmergencyApprovalService } from '../services/approval/EmergencyApprovalService';
import { ApprovalTemplateService } from '../services/approval/ApprovalTemplateService';
import { ApprovalService } from '../services/approval/ApprovalService';
import { ApprovalGateService } from '../services/pipeline/ApprovalGateService';
import { ApprovalGateRepository } from '../repositories/ApprovalGateRepository';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { DatabasePool } from '../services/database';
import { createLogger } from '../utils/logger';

const logger = createLogger('approval-routes');

export interface ApprovalRoutesOptions {
  database?: Pool | DatabasePool;
}

export async function registerApprovalRoutes(
  app: FastifyInstance,
  options: ApprovalRoutesOptions
): Promise<void> {
  // Use database pool if available, otherwise create services without persistence (fallback)
  const db = options.database as DatabasePool | undefined;

  let multiLevelService: MultiLevelApprovalService;
  let emergencyService: EmergencyApprovalService;
  let templateService: ApprovalTemplateService;

  if (db) {
    multiLevelService = new MultiLevelApprovalService(db);
    emergencyService = new EmergencyApprovalService(db);
    templateService = new ApprovalTemplateService(db);
    const approvalService = new ApprovalService(db);
    const gateRepository = new ApprovalGateRepository(db);
    const gateService = new ApprovalGateService(gateRepository);
    const controller = new ApprovalController(
      multiLevelService,
      emergencyService,
      templateService,
      gateService,
      approvalService,
    );
  } else {
    // Fallback: return early without database
    logger.warn('[ApprovalRoutes] No database, skipping routes');
    return;
  }

  // ==================== Multi-Level Approval (auth protected) ====================
  await app.register(async (instance: FastifyInstance) => {
    instance.addHook('onRequest', authenticateUser);

    // POST /api/v1/approvals/requests - 提交审批请求
    instance.post(
      '/v1/approvals/requests',
      { onRequest: [authenticateUser, requirePermission({ resource: 'approval', action: 'write' })] },
      async (request: FastifyRequest, reply: FastifyReply) => {
        return controller.submitApprovalRequest(request, reply);
      }
    );

    // GET /api/v1/approvals/requests - 审批列表
    instance.get(
      '/v1/approvals/requests',
      { onRequest: [authenticateUser, requirePermission({ resource: 'approval', action: 'read' })] },
      async (request: FastifyRequest, reply: FastifyReply) => {
        return controller.listApprovalRequests(request, reply);
      }
    );

    // GET /api/v1/approvals/requests/:id - 审批详情
    instance.get(
      '/v1/approvals/requests/:id',
      { onRequest: [authenticateUser, requirePermission({ resource: 'approval', action: 'read' })] },
      async (request: FastifyRequest, reply: FastifyReply) => {
        return controller.getApprovalRequest(request, reply);
      }
    );

    // POST /api/v1/approvals/requests/:id/review - 审批操作
    instance.post(
      '/v1/approvals/requests/:id/review',
      { onRequest: [authenticateUser, requirePermission({ resource: 'approval', action: 'approve' })] },
      async (request: FastifyRequest, reply: FastifyReply) => {
        return controller.reviewApproval(request, reply);
      }
    );

    // POST /api/v1/approvals/requests/:id/approve - 审批通过
    instance.post(
      '/v1/approvals/requests/:id/approve',
      { onRequest: [authenticateUser, requirePermission({ resource: 'approval', action: 'approve' })] },
      async (request: FastifyRequest, reply: FastifyReply) => {
        return controller.approveRequest(request, reply);
      }
    );

    // POST /api/v1/approvals/requests/:id/reject - 审批拒绝
    instance.post(
      '/v1/approvals/requests/:id/reject',
      { onRequest: [authenticateUser, requirePermission({ resource: 'approval', action: 'approve' })] },
      async (request: FastifyRequest, reply: FastifyReply) => {
        return controller.rejectRequest(request, reply);
      }
    );

    // POST /api/v1/approvals/requests/:id/withdraw - 撤回审批
    instance.post(
      '/v1/approvals/requests/:id/withdraw',
      { onRequest: [authenticateUser, requirePermission({ resource: 'approval', action: 'approve' })] },
      async (request: FastifyRequest, reply: FastifyReply) => {
        return controller.withdrawApproval(request, reply);
      }
    );

    // POST /api/v1/approvals/requests/:id/cancel - 取消审批
    instance.post(
      '/v1/approvals/requests/:id/cancel',
      { onRequest: [authenticateUser, requirePermission({ resource: 'approval', action: 'approve' })] },
      async (request: FastifyRequest, reply: FastifyReply) => {
        return controller.cancelApproval(request, reply);
      }
    );

    // POST /api/v1/approvals/requests/:id/delegate - 委托审批
    instance.post(
      '/v1/approvals/requests/:id/delegate',
      { onRequest: [authenticateUser, requirePermission({ resource: 'approval', action: 'approve' })] },
      async (request: FastifyRequest, reply: FastifyReply) => {
        return controller.delegateApproval(request, reply);
      }
    );

    // POST /api/v1/approvals/requests/:id/reassign - 重新分配审批人
    instance.post(
      '/v1/approvals/requests/:id/reassign',
      { onRequest: [authenticateUser, requirePermission({ resource: 'approval', action: 'approve' })] },
      async (request: FastifyRequest, reply: FastifyReply) => {
        return controller.reassignApproval(request, reply);
      }
    );

    // GET /api/v1/approvals/statistics - 审批统计
    instance.get(
      '/v1/approvals/statistics',
      { onRequest: [authenticateUser, requirePermission({ resource: 'approval', action: 'read' })] },
      async (request: FastifyRequest, reply: FastifyReply) => {
        return controller.getApprovalStatistics(request, reply);
      }
    );

    // GET /api/v1/approvals/trend - 审批趋势
    instance.get(
      '/v1/approvals/trend',
      { onRequest: [authenticateUser, requirePermission({ resource: 'approval', action: 'read' })] },
      async (request: FastifyRequest, reply: FastifyReply) => {
        return controller.getApprovalTrend(request, reply);
      }
    );

    // GET /api/v1/approvals/requests/:id/history - 审批历史
    instance.get(
      '/v1/approvals/requests/:id/history',
      { onRequest: [authenticateUser, requirePermission({ resource: 'approval', action: 'read' })] },
      async (request: FastifyRequest, reply: FastifyReply) => {
        return controller.getApprovalHistory(request, reply);
      }
    );

    // ==================== Agent AI Analysis ====================
    // POST /api/v1/approvals/agent/analyze - Agent 自动分析
    instance.post(
      '/v1/approvals/agent/analyze',
      { onRequest: [authenticateUser, requirePermission({ resource: 'approval', action: 'read' })] },
      async (request: FastifyRequest, reply: FastifyReply) => {
        return controller.agentAnalyze(request, reply);
      }
    );

    // GET /api/v1/approvals/pending - 待审批列表
    instance.get(
      '/v1/approvals/pending',
      { onRequest: [authenticateUser, requirePermission({ resource: 'approval', action: 'read' })] },
      async (request: FastifyRequest, reply: FastifyReply) => {
        return controller.getPendingApprovals(request, reply);
      }
    );

    // GET /api/v1/approvals/my-pending - 我的待审批列表
    instance.get(
      '/v1/approvals/my-pending',
      { onRequest: [authenticateUser, requirePermission({ resource: 'approval', action: 'read' })] },
      async (request: FastifyRequest, reply: FastifyReply) => {
        return controller.getMyPendingApprovals(request, reply);
      }
    );

    // ==================== Emergency Approval ====================
    // POST /api/v1/approvals/emergency - 紧急审批
    instance.post(
      '/v1/approvals/emergency',
      { onRequest: [authenticateUser, requirePermission({ resource: 'approval', action: 'write' })] },
      async (request: FastifyRequest, reply: FastifyReply) => {
        return controller.requestEmergencyApproval(request, reply);
      }
    );

    // ==================== Templates ====================
    // POST /api/v1/approvals/templates - 创建模板
    instance.post(
      '/v1/approvals/templates',
      { onRequest: [authenticateUser, requirePermission({ resource: 'approval', action: 'write' })] },
      async (request: FastifyRequest, reply: FastifyReply) => {
        return controller.createTemplate(request, reply);
      }
    );

    // GET /api/v1/approvals/templates - 模板列表
    instance.get(
      '/v1/approvals/templates',
      { onRequest: [authenticateUser, requirePermission({ resource: 'approval', action: 'read' })] },
      async (request: FastifyRequest, reply: FastifyReply) => {
        return controller.getTemplates(request, reply);
      }
    );

    // ==================== Approval Gate (Pipeline) ====================
    // GET /api/v1/pipeline-runs/:runId/approvals - 获取 run 的所有审批
    instance.get(
      '/v1/pipeline-runs/:runId/approvals',
      { onRequest: [authenticateUser, requirePermission({ resource: 'approval', action: 'read' })] },
      async (request: FastifyRequest, reply: FastifyReply) => {
        return controller.listByRun(request, reply);
      }
    );

    // GET /api/v1/pipeline-runs/:runId/stages/:stageId/approval - 获取 stage 审批状态
    instance.get(
      '/v1/pipeline-runs/:runId/stages/:stageId/approval',
      { onRequest: [authenticateUser, requirePermission({ resource: 'approval', action: 'read' })] },
      async (request: FastifyRequest, reply: FastifyReply) => {
        return controller.getStatus(request, reply);
      }
    );

    // POST /api/v1/pipeline-runs/:runId/stages/:stageId/approve - 审批通过
    instance.post(
      '/v1/pipeline-runs/:runId/stages/:stageId/approve',
      { onRequest: [authenticateUser, requirePermission({ resource: 'approval', action: 'approve' })] },
      async (request: FastifyRequest, reply: FastifyReply) => {
        return controller.approve(request, reply);
      }
    );

    // POST /api/v1/pipeline-runs/:runId/stages/:stageId/reject - 审批拒绝
    instance.post(
      '/v1/pipeline-runs/:runId/stages/:stageId/reject',
      { onRequest: [authenticateUser, requirePermission({ resource: 'approval', action: 'approve' })] },
      async (request: FastifyRequest, reply: FastifyReply) => {
        return controller.reject(request, reply);
      }
    );
  });
}

export default registerApprovalRoutes;
