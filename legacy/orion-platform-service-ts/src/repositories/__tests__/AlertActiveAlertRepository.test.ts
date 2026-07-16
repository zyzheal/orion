/**
 * AlertActiveAlertRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { AlertActiveAlertRepository } from '../AlertActiveAlertRepository';

const mockQuery = jest.fn();

describe('AlertActiveAlertRepository', () => {
  let repo: AlertActiveAlertRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new AlertActiveAlertRepository({ query: mockQuery } as any);
  });

  it('should findByTenantId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTenantId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findBySourceId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findBySourceId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findFiringBySourceType', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findFiringBySourceType('test-type', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should markResolved', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.markResolved('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should deleteResolved', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.deleteResolved('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should countByStatus', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.countByStatus('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });
});
