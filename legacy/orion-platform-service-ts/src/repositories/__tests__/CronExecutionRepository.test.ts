/**
 * CronExecutionRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { CronExecutionRepository } from '../CronExecutionRepository';

const mockQuery = jest.fn();

describe('CronExecutionRepository', () => {
  let repo: CronExecutionRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new CronExecutionRepository({ query: mockQuery } as any);
  });

  it('should findByJobId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByJobId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findRunning', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findRunning('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should complete', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.complete('test-id', 'active', 'test-arg', 'test-arg', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });
});
