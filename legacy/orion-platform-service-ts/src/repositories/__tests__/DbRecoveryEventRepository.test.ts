/**
 * DbRecoveryEventRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { DbRecoveryEventRepository } from '../DbRecoveryEventRepository';

const mockQuery = jest.fn();

describe('DbRecoveryEventRepository', () => {
  let repo: DbRecoveryEventRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new DbRecoveryEventRepository({ query: mockQuery } as any);
  });

  it('should findRecent', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findRecent('test-arg', 'test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should deleteAll', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });
    const result = await repo.deleteAll();
    expect(mockQuery).toHaveBeenCalled();
    expect(result).toBeUndefined();
  });
});
