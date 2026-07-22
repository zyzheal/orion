/**
 * DbLagHistoryRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { DbLagHistoryRepository } from '../DbLagHistoryRepository';

const mockQuery = jest.fn();

describe('DbLagHistoryRepository', () => {
  let repo: DbLagHistoryRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new DbLagHistoryRepository({ query: mockQuery } as any);
  });

  it('should findByReplicaHost', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByReplicaHost('test-arg', 'test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should deleteByReplicaHost', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.deleteByReplicaHost('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should deleteOlderThan', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.deleteOlderThan('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should deleteAll', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });
    const result = await repo.deleteAll();
    expect(mockQuery).toHaveBeenCalled();
    expect(result).toBeUndefined();
  });
});
