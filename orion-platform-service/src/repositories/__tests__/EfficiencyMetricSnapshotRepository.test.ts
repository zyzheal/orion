/**
 * EfficiencyMetricSnapshotRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { EfficiencyMetricSnapshotRepository } from '../EfficiencyMetricSnapshotRepository';

const mockQuery = jest.fn();

describe('EfficiencyMetricSnapshotRepository', () => {
  let repo: EfficiencyMetricSnapshotRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new EfficiencyMetricSnapshotRepository({ query: mockQuery } as any);
  });

  it('should create', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.create('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByTenant', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTenant('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should pruneOld', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.pruneOld('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });
});
