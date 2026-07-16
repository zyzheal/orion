/**
 * DiagnosticPatternRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { DiagnosticPatternRepository } from '../DiagnosticPatternRepository';

const mockQuery = jest.fn();

describe('DiagnosticPatternRepository', () => {
  let repo: DiagnosticPatternRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new DiagnosticPatternRepository({ query: mockQuery } as any);
  });

  it('should create', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.create('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByCategory', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByCategory('test-arg', 'test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByTenant', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTenant('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should searchByKeyword', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.searchByKeyword('test-arg', 'test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should incrementFrequency', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.incrementFrequency('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should updateConfidence', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.updateConfidence('test-id', 'test-id');
    expect(mockQuery).toHaveBeenCalled();
  });
});
