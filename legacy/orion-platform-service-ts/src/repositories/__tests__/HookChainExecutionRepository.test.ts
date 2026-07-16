/**
 * HookChainExecutionRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { HookChainExecutionRepository } from '../HookChainExecutionRepository';

const mockQuery = jest.fn();

describe('HookChainExecutionRepository', () => {
  let repo: HookChainExecutionRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new HookChainExecutionRepository({ query: mockQuery } as any);
  });

  it('should findByChainId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByChainId('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });
});
