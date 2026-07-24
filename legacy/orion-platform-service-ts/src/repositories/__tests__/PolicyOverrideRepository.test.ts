/**
 * PolicyOverrideRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { PolicyOverrideRepository } from '../PolicyOverrideRepository';

const mockQuery = jest.fn();

describe('PolicyOverrideRepository', () => {
  let repo: PolicyOverrideRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new PolicyOverrideRepository({ query: mockQuery } as any);
  });

  it('should findActiveByTenant', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findActiveByTenant('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByTenant', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTenant('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findActiveByTenantAndPolicy', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findActiveByTenantAndPolicy('test-id', 'test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should createOverride', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.createOverride('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should updateOverride', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.updateOverride('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should markExpired', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.markExpired('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });
});
