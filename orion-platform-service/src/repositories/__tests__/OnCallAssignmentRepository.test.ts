/**
 * OnCallAssignmentRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { OnCallAssignmentRepository } from '../OnCallAssignmentRepository';

const mockQuery = jest.fn();

describe('OnCallAssignmentRepository', () => {
  let repo: OnCallAssignmentRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new OnCallAssignmentRepository({ query: mockQuery } as any);
  });

  it('should findByScheduleId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByScheduleId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByScheduleAndTime', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByScheduleAndTime('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should deleteByScheduleId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.deleteByScheduleId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });
});
