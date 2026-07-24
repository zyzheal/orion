/**
 * CostOptimizationRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { CostRecommendationRepository, SavingsTrackingRepository } from '../CostOptimizationRepository';

const mockQuery = jest.fn();

describe('CostRecommendationRepository', () => {
  let repo: CostRecommendationRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new CostRecommendationRepository({ query: mockQuery } as any);
  });

  it('should findByTenant', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTenant('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByStatus', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByStatus('active', 'test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should createRecommendation', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.createRecommendation('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should updateRecommendation', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.updateRecommendation('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should deleteRecommendation', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.deleteRecommendation('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });
});

describe('SavingsTrackingRepository', () => {
  let repo: SavingsTrackingRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new SavingsTrackingRepository({ query: mockQuery } as any);
  });

  it('should findByTenant', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTenant('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByRecommendation', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByRecommendation('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByTenantAndMonth', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTenantAndMonth('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should createRecord', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.createRecord('test-arg', 'test-id');
    expect(mockQuery).toHaveBeenCalled();
  });
});
