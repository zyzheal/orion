/**
 * AlertTopologyNodeRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { AlertTopologyNodeRepository } from '../AlertTopologyNodeRepository';

const mockQuery = jest.fn();

describe('AlertTopologyNodeRepository', () => {
  let repo: AlertTopologyNodeRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new AlertTopologyNodeRepository({ query: mockQuery } as any);
  });

  it('should findByTenantId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTenantId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByParentId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByParentId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should updateStatus', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.updateStatus('test-id', 'active');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should deleteByTenant', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.deleteByTenant('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });
});
