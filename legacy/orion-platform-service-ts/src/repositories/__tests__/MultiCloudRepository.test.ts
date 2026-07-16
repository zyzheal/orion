/**
 * MultiCloudRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { MultiCloudRepository } from '../MultiCloudRepository';

const mockQuery = jest.fn();

describe('MultiCloudRepository', () => {
  let repo: MultiCloudRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new MultiCloudRepository({ query: mockQuery } as any);
  });

  it('should createCloudAccount', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.createCloudAccount('test-arg', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findAccountById', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findAccountById('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findAccountsByTenant', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findAccountsByTenant('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should deleteCloudAccount', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.deleteCloudAccount('test-id', 'test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should createResource', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.createResource('test-arg', 'test-arg', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findResourcesByTenant', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findResourcesByTenant('test-id', 'test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should deleteResourcesByAccount', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.deleteResourcesByAccount('test-id', 'test-id');
    expect(mockQuery).toHaveBeenCalled();
  });
});
