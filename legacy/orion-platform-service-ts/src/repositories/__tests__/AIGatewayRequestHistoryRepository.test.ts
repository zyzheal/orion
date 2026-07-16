/**
 * AIGatewayRequestHistoryRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { AIGatewayRequestHistoryRepository } from '../AIGatewayRequestHistoryRepository';

const mockQuery = jest.fn();

describe('AIGatewayRequestHistoryRepository', () => {
  let repo: AIGatewayRequestHistoryRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new AIGatewayRequestHistoryRepository({ query: mockQuery } as any);
  });

  it('should findByScenario', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByScenario('test-arg', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should countByScenario', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.countByScenario('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should deleteByScenario', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.deleteByScenario('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should pruneOldRecords', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.pruneOldRecords('test-arg', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });
});
