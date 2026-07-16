/**
 * EmergencyApprovalRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { EmergencyApprovalRepository } from '../EmergencyApprovalRepository';

const mockQuery = jest.fn();

describe('EmergencyApprovalRepository', () => {
  let repo: EmergencyApprovalRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new EmergencyApprovalRepository({ query: mockQuery } as any);
  });

  it('should findByTenant', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTenant('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should createRequest', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.createRequest('test-arg', 'test-arg', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should updateRequest', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.updateRequest('test-id', 'test-arg', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });
});
