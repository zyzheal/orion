/**
 * HealingApprovalRequestRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { HealingApprovalRequestRepository } from '../HealingApprovalRequestRepository';

const mockQuery = jest.fn();

describe('HealingApprovalRequestRepository', () => {
  let repo: HealingApprovalRequestRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new HealingApprovalRequestRepository({ query: mockQuery } as any);
  });

  it('should findByStatus', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByStatus('active', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByIncident', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByIncident('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should updateStatus', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.updateStatus('test-id', 'active', 'test-arg', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });
});
