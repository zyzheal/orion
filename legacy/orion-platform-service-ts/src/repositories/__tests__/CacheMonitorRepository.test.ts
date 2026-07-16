/**
 * CacheMonitorRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { CacheMetricsRepository } from '../CacheMonitorRepository';

const mockQuery = jest.fn();

describe('CacheMetricsRepository', () => {
  let repo: CacheMetricsRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new CacheMetricsRepository({ query: mockQuery } as any);
  });

  it('should findById', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findById('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should create', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.create('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should update', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.update('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should delete', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.delete('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByCacheId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByCacheId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByTenant', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTenant('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should getTenantSummary', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.getTenantSummary('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should recordEvent', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.recordEvent('test-id', 'test-id', 'test-arg', 'test-arg', 'test-arg', 'test-arg', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });
});
