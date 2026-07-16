/**
 * RiskPredictionRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { RiskPredictionRepository } from '../RiskPredictionRepository';

const mockQuery = jest.fn();

describe('RiskPredictionRepository', () => {
  let repo: RiskPredictionRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new RiskPredictionRepository({ query: mockQuery } as any);
  });

  it('should findByTarget', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTarget('test-type', 'test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByTenant', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTenant('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findHighRisk', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findHighRisk('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should clearExpired', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.clearExpired();
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should getStats', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.getStats();
    expect(mockQuery).toHaveBeenCalled();
  });
});
