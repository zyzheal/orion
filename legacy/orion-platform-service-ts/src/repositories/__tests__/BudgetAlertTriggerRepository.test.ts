/**
 * BudgetAlertTriggerRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { BudgetAlertTriggerRepository } from '../BudgetAlertTriggerRepository';

const mockQuery = jest.fn();

describe('BudgetAlertTriggerRepository', () => {
  let repo: BudgetAlertTriggerRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new BudgetAlertTriggerRepository({ query: mockQuery } as any);
  });

  it('should findByBudgetId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByBudgetId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByEntityType', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByEntityType('test-type');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByEntity', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByEntity('test-type', 'test-id');
    expect(mockQuery).toHaveBeenCalled();
  });
});
