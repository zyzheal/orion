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
import { ApprovalGateService } from '../services/pipeline/ApprovalGateService';
import { ApprovalGateRepository } from '../repositories/ApprovalGateRepository';
import { authenticateUser } from '../middleware/authMiddleware';
import { DatabasePool } from '../services/database';

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
  } else {
    // Fallback: This should not happen in production, but we throw an error
    throw new Error('Database connection is required for ApprovalService');
  }

  // Initialize ApprovalGateRepository and ApprovalGateService
  let gateService: ApprovalGateService;
  if (db) {
    const gateRepository = new ApprovalGateRepository(db as unknown as Pool);
    gateService = new ApprovalGateService({ repository: gateRepository });
  } else {
    gateService = new ApprovalGateService({});
  }

  const controller = new ApprovalController(
    multiLevelService,
    emergencyService,
    templateService,
    gateService
  );

  // ==================== Multi-Level Approval (auth protected) ====================
  await app.register(async (instance: FastifyInstance) => {
    instance.addHook('onRequest', authenticateUser);

    // POST /api/v1/approvals/requests - 提交审批请求
    instance.post(
      '/v1/approvals/requests',
      async (request: FastifyRequest, reply: FastifyReply) => {
        return controller.submitApprovalRequest(request, reply);
      }
    );

    // GET /api/v1/approvals/requests - 审批列表
    instance.get(
      '/v1/approvals/requests',
      async (request: FastifyRequest, reply: FastifyReply) => {
        return controller.listApprovalRequests(request, reply);
      }
    );

    // GET /api/v1/approvals/requests/:id - 审批详情
    instance.get(
      '/v1/approvals/requests/:id',
      async (request: FastifyRequest, reply: FastifyReply) => {
        return controller.getApprovalRequest(request, reply);
      }
    );

    // POST /api/v1/approvals/requests/:id/review - 审批操作
    instance.post(
      '/v1/approvals/requests/:id/review',
      async (request: FastifyRequest, reply: FastifyReply) => {
        return controller.reviewApproval(request, reply);
      }
    );

    // GET /api/v1/approvals/pending - 待审批列表
    instance.get(
      '/v1/approvals/pending',
      async (request: FastifyRequest, reply: FastifyReply) => {
        return controller.getPendingApprovals(request, reply);
      }
    );

    // ==================== Emergency Approval ====================
    // POST /api/v1/approvals/emergency - 紧急审批
    instance.post(
      '/v1/approvals/emergency',
      async (request: FastifyRequest, reply: FastifyReply) => {
        return controller.requestEmergencyApproval(request, reply);
      }
    );

    // ==================== Templates ====================
    // POST /api/v1/approvals/templates - 创建模板
    instance.post(
      '/v1/approvals/templates',
      async (request: FastifyRequest, reply: FastifyReply) => {
        return controller.createTemplate(request, reply);
      }
    );

    // GET /api/v1/approvals/templates - 模板列表
    instance.get(
      '/v1/approvals/templates',
      async (request: FastifyRequest, reply: FastifyReply) => {
        return controller.getTemplates(request, reply);
      }
    );

    // ==================== Approval Gate (Pipeline) ====================
    // GET /api/v1/pipeline-runs/:runId/approvals - 获取 run 的所有审批
    instance.get(
      '/v1/pipeline-runs/:runId/approvals',
      async (request: FastifyRequest, reply: FastifyReply) => {
        return controller.listByRun(request, reply);
      }
    );

    // GET /api/v1/pipeline-runs/:runId/stages/:stageId/approval - 获取 stage 审批状态
    instance.get(
      '/v1/pipeline-runs/:runId/stages/:stageId/approval',
      async (request: FastifyRequest, reply: FastifyReply) => {
        return controller.getStatus(request, reply);
      }
    );

    // POST /api/v1/pipeline-runs/:runId/stages/:stageId/approve - 审批通过
    instance.post(
      '/v1/pipeline-runs/:runId/stages/:stageId/approve',
      async (request: FastifyRequest, reply: FastifyReply) => {
        return controller.approve(request, reply);
      }
    );

    // POST /api/v1/pipeline-runs/:runId/stages/:stageId/reject - 审批拒绝
    instance.post(
      '/v1/pipeline-runs/:runId/stages/:stageId/reject',
      async (request: FastifyRequest, reply: FastifyReply) => {
        return controller.reject(request, reply);
      }
    );
  });
}

export default registerApprovalRoutes;
