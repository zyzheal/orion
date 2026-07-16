/**
 * GuardianTaskRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { GuardianTaskRepository } from '../GuardianTaskRepository';

const mockQuery = jest.fn();

describe('GuardianTaskRepository', () => {
  let repo: GuardianTaskRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new GuardianTaskRepository({ query: mockQuery } as any);
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

  it('should markAborted', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.markAborted('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should markCompleted', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.markCompleted('test-id');
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
