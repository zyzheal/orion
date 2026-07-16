/**
 * MonitoringNotificationHistoryRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { MonitoringNotificationHistoryRepository } from '../MonitoringNotificationHistoryRepository';

const mockQuery = jest.fn();

describe('MonitoringNotificationHistoryRepository', () => {
  let repo: MonitoringNotificationHistoryRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new MonitoringNotificationHistoryRepository({ query: mockQuery } as any);
  });

  it('should findByTenantId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTenantId('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByAlertId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByAlertId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByChannelId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByChannelId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByStatus', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByStatus('active');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findWithFilters', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findWithFilters('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });
});
