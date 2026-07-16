/**
 * ChatOpsRecommendationRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { ChatOpsRecommendationRepository } from '../ChatOpsRecommendationRepository';

const mockQuery = jest.fn();

describe('ChatOpsRecommendationRepository', () => {
  let repo: ChatOpsRecommendationRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new ChatOpsRecommendationRepository({ query: mockQuery } as any);
  });

  it('should findActive', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findActive('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByType', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByType('test-type', 'test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findBySeverity', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findBySeverity('test-arg', 'test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should deleteBySource', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.deleteBySource('test-arg', 'test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should cleanExpired', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.cleanExpired('test-arg', 'test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should countActive', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.countActive('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });
});
