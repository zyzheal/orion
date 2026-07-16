/**
 * TimelineEventRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { TimelineEventRepository } from '../TimelineEventRepository';

const mockQuery = jest.fn();

describe('TimelineEventRepository', () => {
  let repo: TimelineEventRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new TimelineEventRepository({ query: mockQuery } as any);
  });

  it('should findByDeploymentId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByDeploymentId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByDeploymentInRange', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByDeploymentInRange('test-id', 'test-arg', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByTenantId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTenantId('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should deleteOlderThan', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.deleteOlderThan('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should deleteByDeploymentId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.deleteByDeploymentId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });
});
