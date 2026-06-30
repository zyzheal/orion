/**
 * DbHealthCheckCountRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { DbHealthCheckCountRepository } from '../DbHealthCheckCountRepository';

const mockQuery = jest.fn();

describe('DbHealthCheckCountRepository', () => {
  let repo: DbHealthCheckCountRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new DbHealthCheckCountRepository({ query: mockQuery } as any);
  });

  it('should findByNodeId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByNodeId('test-id', 'test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should upsertCount', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.upsertCount('test-id', 'test-arg', 'test-id');
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
