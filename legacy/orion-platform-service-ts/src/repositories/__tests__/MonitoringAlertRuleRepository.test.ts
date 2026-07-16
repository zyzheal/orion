/**
 * MonitoringAlertRuleRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { MonitoringAlertRuleRepository } from '../MonitoringAlertRuleRepository';

const mockQuery = jest.fn();

describe('MonitoringAlertRuleRepository', () => {
  let repo: MonitoringAlertRuleRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new MonitoringAlertRuleRepository({ query: mockQuery } as any);
  });

  it('should findByTenantId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTenantId('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findEnabled', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findEnabled();
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByMetric', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByMetric('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should toggleEnabled', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.toggleEnabled('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });
});
