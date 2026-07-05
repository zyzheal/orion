/**
 * Approval Enhancement Tests
 *
 * 覆盖 Task 5.1 新增功能：
 * - POST /api/v1/approval/requests/:id/reassign
 * - GET /api/v1/approval/my-pending
 * - 验证 cancel / delegate / statistics 路由正常
 */

import { FastifyInstance } from 'fastify';
import { registerApprovalRoutes } from '../approval-routes';
import { ApprovalService, ApprovalStatus } from '../ApprovalService';
import { MultiLevelApprovalService } from '../MultiLevelApprovalService';
import { EmergencyApprovalService } from '../EmergencyApprovalService';
import { ApprovalTemplateService } from '../ApprovalTemplateService';
import { ApprovalGateService } from '../../services/pipeline/ApprovalGateService';
import { ApprovalRepository, ApprovalEntity, ApprovalStepEntity } from '../../repositories/ApprovalRepository';
import { ApprovalController } from '../../../api/controllers/ApprovalController';
import { v4 as uuidv4 } from 'uuid';

// ==================== Mock Repository ====================

class MockApprovalRepository {
  private approvals: Map<string, ApprovalEntity> = new Map();
  private steps: Map<string, ApprovalStepEntity> = new Map();

  async create(data: Omit<ApprovalEntity, 'id' | 'createdAt'> & Partial<Pick<ApprovalEntity, 'id'>>): Promise<ApprovalEntity> {
    const id = data.id || `approval-${uuidv4()}`;
    const entity: ApprovalEntity = {
      id,
      tenantId: data.tenantId ?? 'default',
      definitionId: data.definitionId ?? null,
      resourceType: data.resourceType ?? 'generic',
      resourceId: data.resourceId ?? id,
      title: data.title ?? `Approval ${id}`,
      status: data.status ?? 'pending',
      requestedBy: data.requestedBy ?? null,
      currentStep: data.currentStep ?? 0,
      totalSteps: data.totalSteps ?? 1,
      requiredApprovals: data.requiredApprovals ?? 1,
      result: data.result ?? null,
      completedAt: data.completedAt ?? null,
      createdAt: data.createdAt ?? new Date(),
    };
    this.approvals.set(id, entity);
    return entity;
  }

  async findById(id: string): Promise<ApprovalEntity | undefined> {
    return this.approvals.get(id);
  }

  async findAll(options?: { limit?: number }): Promise<{ entities: ApprovalEntity[]; total: number }> {
    const entities = Array.from(this.approvals.values());
    return {
      entities: entities.slice(0, options?.limit ?? 100),
      total: entities.length,
    };
  }

  async findPendingByTenant(tenantId: string): Promise<ApprovalEntity[]> {
    return Array.from(this.approvals.values()).filter(a => a.tenantId === tenantId && a.status === 'pending');
  }

  async findByTenant(tenantId: string, options?: { status?: string; limit?: number }): Promise<ApprovalEntity[]> {
    let list = Array.from(this.approvals.values()).filter(a => a.tenantId === tenantId);
    if (options?.status) {
      list = list.filter(a => a.status === options.status);
    }
    return list.slice(0, options?.limit ?? 100);
  }

  async updateStatus(id: string, status: string, completedAt?: Date): Promise<ApprovalEntity | null> {
    const entity = this.approvals.get(id);
    if (!entity) return null;
    const updated: ApprovalEntity = {
      ...entity,
      status,
      completedAt: completedAt ?? (status === 'approved' || status === 'rejected' ? new Date() : null),
      currentStep: status === 'approved' ? entity.totalSteps : entity.currentStep,
    };
    this.approvals.set(id, updated);
    return updated;
  }

  async advanceStep(id: string): Promise<ApprovalEntity | null> {
    const entity = this.approvals.get(id);
    if (!entity || entity.status !== 'pending') return null;
    const updated: ApprovalEntity = {
      ...entity,
      currentStep: entity.currentStep + 1,
    };
    this.approvals.set(id, updated);
    return updated;
  }

  async createStep(step: Omit<ApprovalStepEntity, 'id'>): Promise<ApprovalStepEntity> {
    const id = `step-${uuidv4()}`;
    const entity: ApprovalStepEntity = {
      id,
      approvalId: step.approvalId,
      stepIndex: step.stepIndex,
      approverId: step.approverId ?? null,
      status: step.status ?? 'pending',
      comment: step.comment ?? null,
      actedAt: step.actedAt ?? null,
    };
    this.steps.set(id, entity);
    return entity;
  }

  async findStepsByApproval(approvalId: string): Promise<ApprovalStepEntity[]> {
    return Array.from(this.steps.values())
      .filter(s => s.approvalId === approvalId)
      .sort((a, b) => a.stepIndex - b.stepIndex);
  }

  async updateStepStatus(stepId: string, status: string, comment?: string, actedAt?: Date): Promise<ApprovalStepEntity | null> {
    const step = this.steps.get(stepId);
    if (!step) return null;
    const updated: ApprovalStepEntity = {
      ...step,
      status,
      comment: comment ?? step.comment,
      actedAt: actedAt ?? (status !== 'pending' ? new Date() : step.actedAt),
    };
    this.steps.set(stepId, updated);
    return updated;
  }

  async updateStepApprover(stepId: string, newApproverId: string, reason?: string): Promise<ApprovalStepEntity | null> {
    const step = this.steps.get(stepId);
    if (!step) return null;
    const updated: ApprovalStepEntity = {
      ...step,
      approverId: newApproverId,
      comment: reason ?? step.comment,
    };
    this.steps.set(stepId, updated);
    return updated;
  }

  async findStatisticsByTenant(tenantId: string, periodStart: Date, periodEnd: Date): Promise<{
    totalApprovals: number;
    approvedCount: number;
    rejectedCount: number;
    cancelledCount: number;
    pendingCount: number;
    averageDurationMs: number;
  }> {
    const all = Array.from(this.approvals.values()).filter(a => a.tenantId === tenantId);
    const total = all.length;
    const approved = all.filter(a => a.status === 'approved').length;
    const rejected = all.filter(a => a.status === 'rejected').length;
    const cancelled = all.filter(a => a.status === 'cancelled').length;
    const pending = all.filter(a => a.status === 'pending').length;
    return { totalApprovals: total, approvedCount: approved, rejectedCount: rejected, cancelledCount: cancelled, pendingCount: pending, averageDurationMs: 0 };
  }

  async findTrendByTenant(tenantId: string, periodStart: Date, periodEnd: Date): Promise<Array<{
    period: string;
    created: string;
    approved: string;
    rejected: string;
    cancelled: string;
    pending: string;
  }>> {
    const all = Array.from(this.approvals.values()).filter(a => a.tenantId === tenantId);
    const map = new Map<string, { created: number; approved: number; rejected: number; cancelled: number; pending: number }>();
    for (const a of all) {
      const day = new Date(a.createdAt).toISOString().slice(0, 10);
      const cur = map.get(day) || { created: 0, approved: 0, rejected: 0, cancelled: 0, pending: 0 };
      cur.created += 1;
      (cur as any)[a.status] += 1;
      map.set(day, cur);
    }
    return Array.from(map.entries()).map(([period, counts]) => ({ period, ...counts, created: String(counts.created), approved: String(counts.approved), rejected: String(counts.rejected), cancelled: String(counts.cancelled), pending: String(counts.pending) }));
  }

  clear(): void {
    this.approvals.clear();
    this.steps.clear();
  }
}

// ==================== ApprovalService test wrapper ====================

class TestableApprovalService extends ApprovalService {
  constructor(repository: MockApprovalRepository) {
    super({ query: async () => ({ rows: [], rowCount: 0 }) });
    (this as any).repository = repository;
  }

  private async withTransaction<T>(fn: (repo: ApprovalRepository) => Promise<T>): Promise<T> {
    return fn((this as any).repository);
  }
}

// ==================== ApprovalController test wrapper ====================

interface TestRequest {
  params: { id?: string };
  query: Record<string, string | undefined>;
  body: Record<string, any>;
  userId?: string;
  tenantId?: string;
}

interface TestReply {
  status: jest.Mock;
  send: jest.Mock;
}

class TestableApprovalController extends ApprovalController {
  private mockRepo: MockApprovalRepository;
  private mockRequest: TestRequest;
  private mockReply: TestReply;

  constructor(mockRepo: MockApprovalRepository) {
    const multiLevelService = new MultiLevelApprovalService({ query: async () => ({ rows: [], rowCount: 0 }) });
    const emergencyService = new EmergencyApprovalService({ query: async () => ({ rows: [], rowCount: 0 }) });
    const templateService = new ApprovalTemplateService({ query: async () => ({ rows: [], rowCount: 0 }) });
    const approvalService = new TestableApprovalService(mockRepo);
    super(multiLevelService, emergencyService, templateService, undefined, approvalService);
    this.mockRepo = mockRepo;
    this.mockRequest = {
      params: {},
      query: {},
      body: {},
    };
    this.mockReply = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
  }

  async makeRequest(method: 'reassignApproval' | 'getMyPendingApprovals' | 'cancelApproval' | 'delegateApproval', overrides: Partial<TestRequest> = {}) {
    const request = { ...this.mockRequest, ...overrides };
    const reply = this.mockReply;
    reply.status.mockClear();
    reply.send.mockClear();

    switch (method) {
      case 'reassignApproval':
        await (this as any).reassignApproval(request, reply);
        break;
      case 'getMyPendingApprovals':
        await (this as any).getMyPendingApprovals(request, reply);
        break;
      case 'cancelApproval':
        await (this as any).cancelApproval(request, reply);
        break;
      case 'delegateApproval':
        await (this as any).delegateApproval(request, reply);
        break;
    }
    return { request, reply };
  }
}

// ==================== Tests ====================

describe('ApprovalEnhancement - Task 5.1', () => {
  let mockRepo: MockApprovalRepository;
  let service: TestableApprovalService;
  let controller: TestableApprovalController;

  beforeEach(() => {
    mockRepo = new MockApprovalRepository();
    service = new TestableApprovalService(mockRepo);
    controller = new TestableApprovalController(mockRepo);
  });

  afterEach(() => {
    mockRepo.clear();
  });

  // ==================== Service-level: reassign ====================

  describe('ApprovalService.reassignApproval', () => {
    test('should reassign all pending steps from one approver to another', async () => {
      const req = await service.createApproval('Deploy', 'user1', ['manager1', 'manager2'], 1, undefined, { tenantId: 't1' });
      const result = await service.reassignApproval(req.id, 'user1', 'manager3', 'manager1 out of office');
      expect(result.approverIds).toContain('manager3');
      expect(result.approverIds).not.toContain('manager1');
      expect(result.status).toBe(ApprovalStatus.PENDING);
    });

    test('should reject reassign if approval is not pending', async () => {
      const req = await service.createApproval('Deploy', 'user1', ['manager1'], 1, undefined, { tenantId: 't1' });
      await service.approve(req.id, 'manager1');
      await expect(service.reassignApproval(req.id, 'user1', 'manager2')).rejects.toThrow('Cannot reassign');
    });

    test('should reject reassign by non-requester', async () => {
      const req = await service.createApproval('Deploy', 'user1', ['manager1'], 1, undefined, { tenantId: 't1' });
      await expect(service.reassignApproval(req.id, 'random-user', 'manager2')).rejects.toThrow('Only the requester');
    });
  });

  // ==================== Controller-level: reassign route ====================

  describe('POST /v1/approvals/requests/:id/reassign', () => {
    test('should return 200 with reassigned approval data', async () => {
      const req = await service.createApproval('Deploy', 'user1', ['manager1'], 1, undefined, { tenantId: 't1' });
      const { reply } = await controller.makeRequest('reassignApproval', {
        params: { id: req.id },
        body: { fromUserId: 'user1', toUserId: 'manager2', reason: 'out of office' },
        userId: 'user1',
        tenantId: 't1',
      });

      expect(reply.status).toHaveBeenCalledWith(200);
      const sendArg = reply.send.mock.calls[0][0];
      expect(sendArg.success).toBe(true);
      expect(sendArg.data.approverIds).toContain('manager2');
    });

    test('should return 400 if fromUserId or toUserId missing', async () => {
      const { reply } = await controller.makeRequest('reassignApproval', {
        params: { id: 'approval-1' },
        body: { fromUserId: 'user1' },
      });
      expect(reply.status).toHaveBeenCalledWith(400);
    });

    test('should return 400 if approval not found', async () => {
      const { reply } = await controller.makeRequest('reassignApproval', {
        params: { id: 'nonexistent' },
        body: { fromUserId: 'user1', toUserId: 'manager2' },
      });
      expect(reply.status).toHaveBeenCalledWith(400);
    });
  });

  // ==================== Controller-level: my-pending route ====================

  describe('GET /v1/approvals/my-pending', () => {
    test('should return only approvals where current user is an approver', async () => {
      await service.createApproval('A', 'user1', ['manager1', 'user2'], 1, undefined, { tenantId: 't1' });
      await service.createApproval('B', 'user1', ['manager1'], 1, undefined, { tenantId: 't1' });

      const { reply } = await controller.makeRequest('getMyPendingApprovals', {
        query: { tenantId: 't1' },
        userId: 'user2',
        tenantId: 't1',
      });

      expect(reply.status).toHaveBeenCalledWith(200);
      const sendArg = reply.send.mock.calls[0][0];
      expect(sendArg.success).toBe(true);
      expect(sendArg.data.length).toBeGreaterThanOrEqual(1);
      // All returned approvals should have user2 as approver
      for (const approval of sendArg.data) {
        expect(approval.approverIds).toContain('user2');
      }
    });

    test('should return 400 if userId is missing', async () => {
      const { reply } = await controller.makeRequest('getMyPendingApprovals', {
        query: { tenantId: 't1' },
      });
      expect(reply.status).toHaveBeenCalledWith(400);
    });
  });

  // ==================== Verify existing routes still work ====================

  describe('Existing routes (cancel/delegate/statistics)', () => {
    test('POST /v1/approvals/requests/:id/cancel - requester can cancel', async () => {
      const req = await service.createApproval('Deploy', 'user1', ['manager1'], 1, undefined, { tenantId: 't1' });
      const { reply } = await controller.makeRequest('cancelApproval', {
        params: { id: req.id },
        body: { userId: 'user1', reason: 'no longer needed' },
        userId: 'user1',
      });
      expect(reply.status).toHaveBeenCalledWith(200);
      const sendArg = reply.send.mock.calls[0][0];
      expect(sendArg.data.status).toBe(ApprovalStatus.CANCELLED);
    });

    test('POST /v1/approvals/requests/:id/delegate - approver can delegate', async () => {
      const req = await service.createApproval('Deploy', 'user1', ['manager1'], 1, undefined, { tenantId: 't1' });
      const { reply } = await controller.makeRequest('delegateApproval', {
        params: { id: req.id },
        body: { fromUserId: 'manager1', toUserId: 'manager2', reason: 'out of office' },
      });
      expect(reply.status).toHaveBeenCalledWith(200);
      const sendArg = reply.send.mock.calls[0][0];
      expect(sendArg.data.approverIds).toContain('manager2');
    });
  });
});
