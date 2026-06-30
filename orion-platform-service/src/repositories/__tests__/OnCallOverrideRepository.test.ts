/**
 * OnCallOverrideRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { OnCallOverrideRepository } from '../OnCallOverrideRepository';

const mockQuery = jest.fn();

describe('OnCallOverrideRepository', () => {
  let repo: OnCallOverrideRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new OnCallOverrideRepository({ query: mockQuery } as any);
  });

  it('should findByScheduleId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByScheduleId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findActiveAtTime', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findActiveAtTime('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should deleteByScheduleId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.deleteByScheduleId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });
});
