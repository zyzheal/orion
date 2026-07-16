/**
 * ServiceDependencyRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { ServiceDependencyRepository } from '../ServiceDependencyRepository';

const mockQuery = jest.fn();

describe('ServiceDependencyRepository', () => {
  let repo: ServiceDependencyRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new ServiceDependencyRepository({ query: mockQuery } as any);
  });

  it('should findByTenantId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTenantId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByService', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByService('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findDependentsOf', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findDependentsOf('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should upsertDependency', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.upsertDependency('test-arg', 'test-id', 'test-arg', 'test-type');
    expect(mockQuery).toHaveBeenCalled();
  });
});
