/**
 * RcaResultRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { RcaResultRepository } from '../RcaResultRepository';

const mockQuery = jest.fn();

describe('RcaResultRepository', () => {
  let repo: RcaResultRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new RcaResultRepository({ query: mockQuery } as any);
  });

  it('should findByTenantId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTenantId('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findRecent', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findRecent('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should deleteOlderThan', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.deleteOlderThan('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });
});
