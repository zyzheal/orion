/**
 * CloudCostScheduleRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { CloudCostScheduleRepository } from '../CloudCostScheduleRepository';

const mockQuery = jest.fn();

describe('CloudCostScheduleRepository', () => {
  let repo: CloudCostScheduleRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new CloudCostScheduleRepository({ query: mockQuery } as any);
  });

  it('should findByProvider', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByProvider('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findEnabled', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findEnabled();
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should updateLastCollected', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.updateLastCollected('test-id', 'active');
    expect(mockQuery).toHaveBeenCalled();
  });
});
