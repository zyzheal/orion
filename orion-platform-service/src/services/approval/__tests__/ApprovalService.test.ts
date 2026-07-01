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
});