import { ApprovalService, ApprovalStatus } from '../ApprovalService';
import { ApprovalRepository, ApprovalEntity, ApprovalStepEntity } from '../../repositories/ApprovalRepository';
import { v4 as uuidv4 } from 'uuid';

// Mock ApprovalRepository for testing
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
    const steps = Array.from(this.steps.values())
      .filter(s => s.approvalId === approvalId)
      .sort((a, b) => a.stepIndex - b.stepIndex);
    return steps;
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
    const list = await this.findPendingByTenant(tenantId);
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

// Create a modified ApprovalService that accepts a repository directly
class TestableApprovalService extends ApprovalService {
  constructor(repository: MockApprovalRepository) {
    // Pass a dummy db with query method - we'll override the repository
    super({ query: async () => ({ rows: [], rowCount: 0 }) });
    // Replace the repository with our mock
    (this as any).repository = repository;
  }

  // Override withTransaction to use the mock repository directly (no real DB transaction)
  private async withTransaction<T>(fn: (repo: ApprovalRepository) => Promise<T>): Promise<T> {
    return fn((this as any).repository);
  }
}

describe('ApprovalService', () => {
  let service: TestableApprovalService;
  let mockRepo: MockApprovalRepository;

  beforeEach(() => {
    mockRepo = new MockApprovalRepository();
    service = new TestableApprovalService(mockRepo);
  });

  afterEach(() => {
    mockRepo.clear();
  });

  test('should create approval request', async () => {
    const req = await service.createApproval('Deploy to prod', 'user1', ['manager1', 'manager2'], 2);
    expect(req.status).toBe(ApprovalStatus.PENDING);
    expect(req.approverIds).toEqual(['manager1', 'manager2']);
  });

  test('should approve when required count reached', async () => {
    const req = await service.createApproval('Deploy', 'user1', ['manager1'], 1);
    const result = await service.approve(req.id, 'manager1');
    expect(result.status).toBe(ApprovalStatus.APPROVED);
  });

  test('should reject', async () => {
    const req = await service.createApproval('Deploy', 'user1', ['manager1']);
    const result = await service.reject(req.id, 'manager1');
    expect(result.status).toBe(ApprovalStatus.REJECTED);
  });

  test('should require multiple approvals', async () => {
    const req = await service.createApproval('Deploy', 'user1', ['manager1', 'manager2'], 2);
    await service.approve(req.id, 'manager1');
    const result = await service.approve(req.id, 'manager2');
    expect(result.status).toBe(ApprovalStatus.APPROVED);
    expect(result.approvals.length).toBe(2);
  });

  test('should not allow unauthorized approval', async () => {
    const req = await service.createApproval('Deploy', 'user1', ['manager1']);
    await expect(service.approve(req.id, 'random')).rejects.toThrow('Not authorized');
  });

  test('should list pending approvals', async () => {
    await service.createApproval('A', 'user1', ['manager1']);
    await service.createApproval('B', 'user2', ['manager2']);
    const pending = await service.listPending();
    expect(pending.length).toBe(2);
  });

  // ==================== Withdraw / Cancel / Delegate / Statistics / Trend ====================

  test('should allow requester to cancel pending approval', async () => {
    const req = await service.createApproval('Deploy', 'user1', ['manager1']);
    const result = await service.cancelApproval(req.id, 'user1', 'no longer needed');
    expect(result.status).toBe(ApprovalStatus.CANCELLED);
  });

  test('should reject cancel by non-requester', async () => {
    const req = await service.createApproval('Deploy', 'user1', ['manager1']);
    await expect(service.cancelApproval(req.id, 'random')).rejects.toThrow('Only the requester');
  });

  test('should allow approver to withdraw their approval', async () => {
    const req = await service.createApproval('Deploy', 'user1', ['manager1']);
    await service.approve(req.id, 'manager1');
    const result = await service.withdrawApproval(req.id, 'manager1', 'mistake');
    expect(result.status).toBe(ApprovalStatus.PENDING);
  });

  test('should delegate pending approval step to another user', async () => {
    const req = await service.createApproval('Deploy', 'user1', ['manager1']);
    const result = await service.delegateApproval(req.id, 'manager1', 'manager2', 'out of office');
    expect(result.approverIds).toContain('manager2');
    expect(result.approverIds).not.toContain('manager1');
  });

  test('should compute approval statistics', async () => {
    await service.createApproval('A', 'user1', ['manager1'], 1, undefined, { tenantId: 't1' });
    const req = await service.createApproval('B', 'user1', ['manager1'], 1, undefined, { tenantId: 't1' });
    await service.approve(req.id, 'manager1');
    const stats = await service.getApprovalStatistics('t1', new Date(Date.now() - 86400000), new Date());
    expect(stats.totalApprovals).toBeGreaterThanOrEqual(2);
    expect(stats.approvalRate).toBeGreaterThanOrEqual(0);
  });

  test('should compute approval trend', async () => {
    await service.createApproval('A', 'user1', ['manager1'], 1, undefined, { tenantId: 't1' });
    const trend = await service.getApprovalTrend('t1', new Date(Date.now() - 86400000), new Date());
    expect(trend.dataPoints.length).toBeGreaterThanOrEqual(1);
    expect(trend.totalCreated).toBeGreaterThanOrEqual(1);
  });
});