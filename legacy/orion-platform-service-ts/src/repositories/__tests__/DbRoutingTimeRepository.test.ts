/**
 * DbRoutingTimeRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { DbRoutingTimeRepository } from '../DbRoutingTimeRepository';

const mockQuery = jest.fn();

describe('DbRoutingTimeRepository', () => {
  let repo: DbRoutingTimeRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new DbRoutingTimeRepository({ query: mockQuery } as any);
  });

  it('should findByNodeId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByNodeId('test-id', 'test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should upsertRoutingTime', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.upsertRoutingTime('test-id', 'test-arg', 'test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should deleteByNodeId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.deleteByNodeId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should deleteAll', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });
    const result = await repo.deleteAll();
    expect(mockQuery).toHaveBeenCalled();
    expect(result).toBeUndefined();
  });
});
