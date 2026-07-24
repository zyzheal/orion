/**
 * SuppressionLogRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { SuppressionLogRepository } from '../SuppressionLogRepository';

const mockQuery = jest.fn();

describe('SuppressionLogRepository', () => {
  let repo: SuppressionLogRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new SuppressionLogRepository({ query: mockQuery } as any);
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

  it('should findByRuleType', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByRuleType('test-type', 'test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findInRange', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findInRange('test-arg', 'test-arg', 'test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should deleteOlderThan', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.deleteOlderThan('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });
});
