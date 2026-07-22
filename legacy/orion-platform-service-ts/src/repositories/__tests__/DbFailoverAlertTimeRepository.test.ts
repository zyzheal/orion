/**
 * DbFailoverAlertTimeRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { DbFailoverAlertTimeRepository } from '../DbFailoverAlertTimeRepository';

const mockQuery = jest.fn();

describe('DbFailoverAlertTimeRepository', () => {
  let repo: DbFailoverAlertTimeRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new DbFailoverAlertTimeRepository({ query: mockQuery } as any);
  });

  it('should findByLevel', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByLevel('test-arg', 'test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should upsertAlertTime', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.upsertAlertTime('test-arg', 'test-arg', 'test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should deleteAll', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });
    const result = await repo.deleteAll();
    expect(mockQuery).toHaveBeenCalled();
    expect(result).toBeUndefined();
  });
});
