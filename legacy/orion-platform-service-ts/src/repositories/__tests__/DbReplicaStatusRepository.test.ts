/**
 * DbReplicaStatusRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { DbReplicaStatusRepository } from '../DbReplicaStatusRepository';

const mockQuery = jest.fn();

describe('DbReplicaStatusRepository', () => {
  let repo: DbReplicaStatusRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new DbReplicaStatusRepository({ query: mockQuery } as any);
  });

  it('should findByHost', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByHost('test-arg', 'test-arg', 'test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findAllReplicas', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findAllReplicas('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should upsertStatus', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.upsertStatus('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should deleteAll', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });
    const result = await repo.deleteAll();
    expect(mockQuery).toHaveBeenCalled();
    expect(result).toBeUndefined();
  });
});
