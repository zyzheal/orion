/**
 * HookChainDefinitionRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { HookChainDefinitionRepository } from '../HookChainDefinitionRepository';

const mockQuery = jest.fn();

describe('HookChainDefinitionRepository', () => {
  let repo: HookChainDefinitionRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new HookChainDefinitionRepository({ query: mockQuery } as any);
  });

  it('should findByName', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByName('test-name');
    expect(mockQuery).toHaveBeenCalled();
  });
});
