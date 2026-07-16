/**
 * IaCStateVersionRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { IaCStateVersionRepository } from '../IaCStateVersionRepository';

const mockQuery = jest.fn();

describe('IaCStateVersionRepository', () => {
  let repo: IaCStateVersionRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new IaCStateVersionRepository({ query: mockQuery } as any);
  });

  it('should findByWorkspace', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByWorkspace('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findCurrent', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findCurrent('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should getNextVersion', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.getNextVersion('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });
});
