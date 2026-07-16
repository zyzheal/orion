/**
 * AssignmentHistoryRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { AssignmentHistoryRepository } from '../AssignmentHistoryRepository';

const mockQuery = jest.fn();

describe('AssignmentHistoryRepository', () => {
  let repo: AssignmentHistoryRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new AssignmentHistoryRepository({ query: mockQuery } as any);
  });

  it('should findByAssignee', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByAssignee('test-arg', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByTicketId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTicketId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByTenantId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTenantId('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByPeriod', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByPeriod('test-arg', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });
});
