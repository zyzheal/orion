/**
 * SaaSCostSubscriptionRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { SaaSCostSubscriptionRepository } from '../SaaSCostSubscriptionRepository';

const mockQuery = jest.fn();

describe('SaaSCostSubscriptionRepository', () => {
  let repo: SaaSCostSubscriptionRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new SaaSCostSubscriptionRepository({ query: mockQuery } as any);
  });

  it('should findByTool', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTool('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByStatus', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByStatus('active');
    expect(mockQuery).toHaveBeenCalled();
  });
});
