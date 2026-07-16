/**
 * ServiceCatalogRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { ServiceCatalogRepository } from '../ServiceCatalogRepository';

const mockQuery = jest.fn();

describe('ServiceCatalogRepository', () => {
  let repo: ServiceCatalogRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new ServiceCatalogRepository({ query: mockQuery } as any);
  });

  it('should createService', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.createService('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should updateService', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.updateService('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByTenant', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTenant('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByCategory', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByCategory('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByStatus', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByStatus('test-id', 'active');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByOwner', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByOwner('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });
});
