/**
 * KnowledgeBasePatternRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { KnowledgeBasePatternRepository } from '../KnowledgeBasePatternRepository';

const mockQuery = jest.fn();

describe('KnowledgeBasePatternRepository', () => {
  let repo: KnowledgeBasePatternRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new KnowledgeBasePatternRepository({ query: mockQuery } as any);
  });

  it('should findByCategory', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByCategory('test-arg', 'test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findBySymptoms', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findBySymptoms('test-arg', 'test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByAffectedComponent', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByAffectedComponent('test-arg', 'test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should updateSuccessRate', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.updateSuccessRate('test-id', 'test-arg', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should countByCategory', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.countByCategory('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should totalSuccessRate', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.totalSuccessRate('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });
});
