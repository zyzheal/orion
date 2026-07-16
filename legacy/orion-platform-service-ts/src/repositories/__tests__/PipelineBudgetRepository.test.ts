/**
 * PipelineBudgetRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { PipelineBudgetRepository } from '../PipelineBudgetRepository';

const mockQuery = jest.fn();

describe('PipelineBudgetRepository', () => {
  let repo: PipelineBudgetRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new PipelineBudgetRepository({ query: mockQuery } as any);
  });

  it('should findByPipelineId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByPipelineId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should updateCost', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.updateCost('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should updateBlocked', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.updateBlocked('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should upsert', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.upsert('test-id', 'test-arg', 'test-arg', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should deleteByPipelineId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.deleteByPipelineId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });
});
