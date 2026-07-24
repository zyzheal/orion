/**
 * AssignmentRuleRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { AssignmentRuleRepository } from '../AssignmentRuleRepository';

const mockQuery = jest.fn();

describe('AssignmentRuleRepository', () => {
  let repo: AssignmentRuleRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new AssignmentRuleRepository({ query: mockQuery } as any);
  });

  it('should findEnabled', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findEnabled();
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByTenantId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTenantId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findEnabledByTenantId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findEnabledByTenantId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should updateEnabled', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.updateEnabled('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should updateOrder', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.updateOrder('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });
});
