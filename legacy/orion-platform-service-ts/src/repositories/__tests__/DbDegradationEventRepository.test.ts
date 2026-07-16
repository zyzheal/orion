/**
 * DbDegradationEventRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { DbDegradationEventRepository } from '../DbDegradationEventRepository';

const mockQuery = jest.fn();

describe('DbDegradationEventRepository', () => {
  let repo: DbDegradationEventRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new DbDegradationEventRepository({ query: mockQuery } as any);
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
