/**
 * DecisionExplanationRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { DecisionExplanationRepository } from '../DecisionExplanationRepository';

const mockQuery = jest.fn();

describe('DecisionExplanationRepository', () => {
  let repo: DecisionExplanationRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new DecisionExplanationRepository({ query: mockQuery } as any);
  });

  it('should findByDecisionId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByDecisionId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByType', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByType('test-type', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findRecent', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findRecent('test-arg', 'test-type');
    expect(mockQuery).toHaveBeenCalled();
  });
});
