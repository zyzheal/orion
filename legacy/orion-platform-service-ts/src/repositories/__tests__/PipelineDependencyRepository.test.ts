/**
 * PipelineDependencyRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { PipelineDependencyRepository } from '../PipelineDependencyRepository';

const mockQuery = jest.fn();

describe('PipelineDependencyRepository', () => {
  let repo: PipelineDependencyRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new PipelineDependencyRepository({ query: mockQuery } as any);
  });

  it('should findByPipelineId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByPipelineId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByTenantId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTenantId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should deleteByPipelineId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.deleteByPipelineId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should upsertDependency', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.upsertDependency('test-id', 'test-arg', 'test-type', 'test-id');
    expect(mockQuery).toHaveBeenCalled();
  });
});
