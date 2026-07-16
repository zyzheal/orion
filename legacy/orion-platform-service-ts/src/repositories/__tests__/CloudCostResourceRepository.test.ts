/**
 * CloudCostResourceRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { CloudCostResourceRepository } from '../CloudCostResourceRepository';

const mockQuery = jest.fn();

describe('CloudCostResourceRepository', () => {
  let repo: CloudCostResourceRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new CloudCostResourceRepository({ query: mockQuery } as any);
  });

  it('should findByProvider', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByProvider('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByResourceType', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByResourceType('test-type');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByTenant', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTenant('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByDateRange', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByDateRange('test-arg', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should getTotalCostByProvider', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.getTotalCostByProvider();
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should getTotalCostByResourceType', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.getTotalCostByResourceType();
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should getTotalCostByTenant', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.getTotalCostByTenant();
    expect(mockQuery).toHaveBeenCalled();
  });
});
