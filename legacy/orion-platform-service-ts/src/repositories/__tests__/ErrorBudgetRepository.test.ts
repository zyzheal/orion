/**
 * ErrorBudgetRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { ErrorBudgetRepository } from '../ErrorBudgetRepository';

const mockQuery = jest.fn();

describe('ErrorBudgetRepository', () => {
  let repo: ErrorBudgetRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new ErrorBudgetRepository({ query: mockQuery } as any);
  });

  it('should findBySloId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findBySloId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findHistoryBySloId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findHistoryBySloId('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findExhausted', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findExhausted('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });
});
