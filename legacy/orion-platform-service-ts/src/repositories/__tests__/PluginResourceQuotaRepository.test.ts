/**
 * PluginResourceQuotaRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { PluginResourceQuotaRepository } from '../PluginResourceQuotaRepository';

const mockQuery = jest.fn();

describe('PluginResourceQuotaRepository', () => {
  let repo: PluginResourceQuotaRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new PluginResourceQuotaRepository({ query: mockQuery } as any);
  });

  it('should findByScopeAndId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByScopeAndId('test-arg', 'test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByPluginId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByPluginId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByTenantId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTenantId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should upsertQuota', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.upsertQuota('test-arg', 'test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByScope', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByScope('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });
});
