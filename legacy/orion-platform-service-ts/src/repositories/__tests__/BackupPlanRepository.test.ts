/**
 * BackupPlanRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { BackupPlanRepository } from '../BackupPlanRepository';

const mockQuery = jest.fn();

describe('BackupPlanRepository', () => {
  let repo: BackupPlanRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new BackupPlanRepository({ query: mockQuery } as any);
  });

  it('should findEnabled', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findEnabled();
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should toggleEnabled', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.toggleEnabled('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });
});
