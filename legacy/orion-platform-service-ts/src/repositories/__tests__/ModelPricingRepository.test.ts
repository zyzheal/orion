/**
 * ModelPricingRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { ModelPricingRepository } from '../ModelPricingRepository';

const mockQuery = jest.fn();

describe('ModelPricingRepository', () => {
  let repo: ModelPricingRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new ModelPricingRepository({ query: mockQuery } as any);
  });

  it('should findByModelId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByModelId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByTenant', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTenant('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should upsertByModelId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.upsertByModelId('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should deleteByModelId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.deleteByModelId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });
});
