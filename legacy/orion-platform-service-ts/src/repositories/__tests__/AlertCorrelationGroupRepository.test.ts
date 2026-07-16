/**
 * AlertCorrelationGroupRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { AlertCorrelationGroupRepository } from '../AlertCorrelationGroupRepository';

const mockQuery = jest.fn();

describe('AlertCorrelationGroupRepository', () => {
  let repo: AlertCorrelationGroupRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new AlertCorrelationGroupRepository({ query: mockQuery } as any);
  });

  it('should findByTenantId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTenantId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findActive', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findActive(1, 'test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should deleteExpired', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.deleteExpired(1);
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should updateAlerts', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });
    const result = await repo.updateAlerts('test-id', '2026-01-01', {}, '2026-01-01');
    expect(result).toBeUndefined();
  });
});
