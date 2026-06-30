/**
 * RuleEngineRuleSetRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { RuleEngineRuleSetRepository } from '../RuleEngineRuleSetRepository';

const mockQuery = jest.fn();

describe('RuleEngineRuleSetRepository', () => {
  let repo: RuleEngineRuleSetRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new RuleEngineRuleSetRepository({ query: mockQuery } as any);
  });

  it('should findByScenario', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByScenario('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should listAll', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.listAll();
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should upsertByScenario', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.upsertByScenario('test-arg', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });
});
