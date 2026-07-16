/**
 * IaCModuleRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { IaCModuleRepository } from '../IaCModuleRepository';

const mockQuery = jest.fn();

describe('IaCModuleRepository', () => {
  let repo: IaCModuleRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new IaCModuleRepository({ query: mockQuery } as any);
  });

  it('should findByName', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByName('test-name');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findAllModules', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findAllModules();
    expect(mockQuery).toHaveBeenCalled();
  });
});
