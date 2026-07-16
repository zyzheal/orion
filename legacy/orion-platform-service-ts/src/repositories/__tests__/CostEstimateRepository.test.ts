/**
 * CostEstimateRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { CostEstimateRepository } from '../CostEstimateRepository';

const mockQuery = jest.fn();

describe('CostEstimateRepository', () => {
  let repo: CostEstimateRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new CostEstimateRepository({ query: mockQuery } as any);
  });

  it('should findByModel', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByModel('test-arg', 'test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByTenantId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTenantId('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findRecent', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findRecent('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByDateRange', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByDateRange('test-arg', 'test-arg', 'test-id');
    expect(mockQuery).toHaveBeenCalled();
  });
});
