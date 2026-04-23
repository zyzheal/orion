import { ApprovalService, ApprovalStatus } from '../ApprovalService';

describe('ApprovalService', () => {
  let service: ApprovalService;

  beforeEach(() => {
    service = new ApprovalService();
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
    expect(req.status).toBe(ApprovalStatus.PENDING);
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
    const pending = service.listPending();
    expect(pending.length).toBe(2);
  });
});
