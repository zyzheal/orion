/**
 * IaCWorkspaceRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { IaCWorkspaceRepository } from '../IaCWorkspaceRepository';

const mockQuery = jest.fn();

describe('IaCWorkspaceRepository', () => {
  let repo: IaCWorkspaceRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new IaCWorkspaceRepository({ query: mockQuery } as any);
  });

  it('should findAllFiltered', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findAllFiltered('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });
});
