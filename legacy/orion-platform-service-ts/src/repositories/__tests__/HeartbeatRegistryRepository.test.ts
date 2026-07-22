/**
 * HeartbeatRegistryRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { HeartbeatRegistryRepository } from '../HeartbeatRegistryRepository';

const mockQuery = jest.fn();

describe('HeartbeatRegistryRepository', () => {
  let repo: HeartbeatRegistryRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new HeartbeatRegistryRepository({ query: mockQuery } as any);
  });

  it('should findByTaskId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTaskId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findActive', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findActive();
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByTenant', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTenant('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should updateLastBeat', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.updateLastBeat('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should markTimeout', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.markTimeout('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should deleteByTaskId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.deleteByTaskId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should list', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.list('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });
});
