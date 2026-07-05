/**
 * PluginTenantQuotaRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { PluginTenantQuotaRepository } from '../PluginTenantQuotaRepository';

const mockQuery = jest.fn();

describe('PluginTenantQuotaRepository', () => {
  let repo: PluginTenantQuotaRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new PluginTenantQuotaRepository({ query: mockQuery } as any);
  });

  it('should findByTenantId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTenantId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should upsertQuota', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.upsertQuota('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should deleteByTenantId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.deleteByTenantId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findAllQuotas', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findAllQuotas();
    expect(mockQuery).toHaveBeenCalled();
  });
});
