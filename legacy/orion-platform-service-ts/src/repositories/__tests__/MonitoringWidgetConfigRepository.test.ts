/**
 * MonitoringWidgetConfigRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { MonitoringWidgetConfigRepository } from '../MonitoringWidgetConfigRepository';

const mockQuery = jest.fn();

describe('MonitoringWidgetConfigRepository', () => {
  let repo: MonitoringWidgetConfigRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new MonitoringWidgetConfigRepository({ query: mockQuery } as any);
  });

  it('should findByTenantId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTenantId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should updateSortOrder', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.updateSortOrder('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should deleteByTenant', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.deleteByTenant('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });
});
