/**
 * TenantPrivacyPolicyRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { TenantPrivacyPolicyRepository } from '../TenantPrivacyPolicyRepository';

const mockQuery = jest.fn();

describe('TenantPrivacyPolicyRepository', () => {
  let repo: TenantPrivacyPolicyRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new TenantPrivacyPolicyRepository({ query: mockQuery } as any);
  });

  it('should findByTenantId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTenantId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should upsert', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.upsert('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should deleteByTenantId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.deleteByTenantId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });
});
