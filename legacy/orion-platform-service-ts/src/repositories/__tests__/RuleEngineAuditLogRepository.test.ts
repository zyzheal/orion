/**
 * RuleEngineAuditLogRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { RuleEngineAuditLogRepository } from '../RuleEngineAuditLogRepository';

const mockQuery = jest.fn();

describe('RuleEngineAuditLogRepository', () => {
  let repo: RuleEngineAuditLogRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new RuleEngineAuditLogRepository({ query: mockQuery } as any);
  });

  it('should findByScenario', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByScenario('test-arg', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByRuleId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByRuleId('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should countByScenario', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.countByScenario('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should pruneOldRecords', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.pruneOldRecords('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });
});
