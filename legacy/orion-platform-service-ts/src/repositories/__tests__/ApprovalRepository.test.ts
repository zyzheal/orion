import { ApprovalRepository, ApprovalEntity, ApprovalStepEntity } from '../ApprovalRepository';

describe('ApprovalRepository', () => {
  let repo: ApprovalRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repo = new ApprovalRepository(mockDb);
  });

  test('should find approvals by tenant', async () => {
    mockDb.query.mockResolvedValue({
      rows: [
        { id: 'apr-1', tenant_id: 'tenant-1', resource_type: 'pipeline', resource_id: 'pipe-1', status: 'pending', requested_by: 'user-1', current_step: 0, total_steps: 2, result: null, completed_at: null, created_at: new Date() },
        { id: 'apr-2', tenant_id: 'tenant-1', resource_type: 'deployment', resource_id: 'dep-1', status: 'approved', requested_by: 'user-2', current_step: 2, total_steps: 2, result: null, completed_at: new Date(), created_at: new Date() },
      ],
    });
    const result = await repo.findByTenant('tenant-1');
    expect(result.length).toBe(2);
    expect(result[0].tenantId).toBe('tenant-1');
    expect(result[0].status).toBe('pending');
  });

  test('should find pending approvals', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{ id: 'apr-1', tenant_id: 't1', resource_type: 'pipeline', resource_id: 'p1', status: 'pending', requested_by: 'u1', current_step: 0, total_steps: 1, result: null, completed_at: null, created_at: new Date() }],
    });
    const result = await repo.findPendingByTenant('t1');
    expect(result.length).toBe(1);
    expect(result[0].status).toBe('pending');
  });

  test('should find by resource', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{ id: 'apr-1', tenant_id: 't1', resource_type: 'pipeline', resource_id: 'pipe-1', status: 'approved', requested_by: 'u1', current_step: 1, total_steps: 1, result: null, completed_at: new Date(), created_at: new Date() }],
    });
    const result = await repo.findByResource('pipeline', 'pipe-1');
    expect(result.length).toBe(1);
    expect(result[0].resourceType).toBe('pipeline');
  });

  test('should update status', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{ id: 'apr-1', tenant_id: 't1', resource_type: 'pipeline', resource_id: 'p1', status: 'approved', requested_by: 'u1', current_step: 1, total_steps: 1, result: null, completed_at: new Date(), created_at: new Date() }],
    });
    const result = await repo.updateStatus('apr-1', 'approved');
    expect(result?.status).toBe('approved');
    expect(result?.completedAt).toBeDefined();
  });

  test('should advance step', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{ id: 'apr-1', tenant_id: 't1', resource_type: 'pipeline', resource_id: 'p1', status: 'pending', requested_by: 'u1', current_step: 1, total_steps: 2, result: null, completed_at: null, created_at: new Date() }],
    });
    const result = await repo.advanceStep('apr-1');
    expect(result?.currentStep).toBe(1);
  });

  // Approval Steps tests
  test('should create approval step', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{ id: 'step-1', approval_id: 'apr-1', step_index: 0, approver_id: 'user-1', status: 'pending', comment: null, acted_at: null }],
    });
    const result = await repo.createStep({ approvalId: 'apr-1', stepIndex: 0, approverId: 'user-1', status: 'pending' });
    expect(result.approvalId).toBe('apr-1');
    expect(result.stepIndex).toBe(0);
  });

  test('should find steps by approval', async () => {
    mockDb.query.mockResolvedValue({
      rows: [
        { id: 'step-1', approval_id: 'apr-1', step_index: 0, approver_id: 'u1', status: 'approved', comment: 'Looks good', acted_at: new Date() },
        { id: 'step-2', approval_id: 'apr-1', step_index: 1, approver_id: 'u2', status: 'pending', comment: null, acted_at: null },
      ],
    });
    const result = await repo.findStepsByApproval('apr-1');
    expect(result.length).toBe(2);
    expect(result[0].status).toBe('approved');
    expect(result[1].status).toBe('pending');
  });

  test('should update step status', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{ id: 'step-1', approval_id: 'apr-1', step_index: 0, approver_id: 'u1', status: 'approved', comment: 'Approved', acted_at: new Date() }],
    });
    const result = await repo.updateStepStatus('step-1', 'approved', 'Approved');
    expect(result?.status).toBe('approved');
    expect(result?.comment).toBe('Approved');
    expect(result?.actedAt).toBeDefined();
  });
});