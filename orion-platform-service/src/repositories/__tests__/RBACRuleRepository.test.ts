/**
 * RBACRuleRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { RBACRuleRepository } from '../RBACRuleRepository';

const mockQuery = jest.fn();

describe('RBACRuleRepository', () => {
  let repo: RBACRuleRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new RBACRuleRepository({ query: mockQuery } as any);
  });

  it('should findByPipelineId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByPipelineId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByPipelineAndUser', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByPipelineAndUser('test-id', 'test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should upsert', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.upsert('test-id', 'test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should deleteByPipelineAndUser', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.deleteByPipelineAndUser('test-id', 'test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should deleteByPipelineId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.deleteByPipelineId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });
});
