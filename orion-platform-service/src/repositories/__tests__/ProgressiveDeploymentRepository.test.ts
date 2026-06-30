/**
 * ProgressiveDeploymentRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { ProgressiveDeploymentRepository } from '../ProgressiveDeploymentRepository';

const mockQuery = jest.fn();

describe('ProgressiveDeploymentRepository', () => {
  let repo: ProgressiveDeploymentRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new ProgressiveDeploymentRepository({ query: mockQuery } as any);
  });

  it('should findByDeploymentId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByDeploymentId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByTenantId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTenantId('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findActiveByTenant', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findActiveByTenant('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByPhase', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByPhase('test-arg', 'test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should updatePhase', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.updatePhase('test-id', 'test-arg', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should deleteByDeploymentId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.deleteByDeploymentId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should deleteCompletedOlderThan', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.deleteCompletedOlderThan('test-arg', 'test-id');
    expect(mockQuery).toHaveBeenCalled();
  });
});
