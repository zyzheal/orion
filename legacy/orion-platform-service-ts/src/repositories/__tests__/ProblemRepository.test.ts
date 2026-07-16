/**
 * ProblemRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { ProblemRepository, KnownErrorRepository } from '../ProblemRepository';

const mockQuery = jest.fn();

describe('ProblemRepository', () => {
  let repo: ProblemRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new ProblemRepository({ query: mockQuery } as any);
  });

  it('should findByTenant', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTenant('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByIdAndTenant', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByIdAndTenant('test-id', 'test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should updateStatus', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.updateStatus('test-id', 'active', 'test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should addIncident', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.addIncident('test-id', 'test-id', 'test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should addChange', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.addChange('test-id', 'test-id', 'test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should getStats', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.getStats('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });
});

describe('KnownErrorRepository', () => {
  let repo: KnownErrorRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new KnownErrorRepository({ query: mockQuery } as any);
  });

  it('should findByTenant', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTenant('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByIdAndTenant', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByIdAndTenant('test-id', 'test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should search', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.search('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByKeywords', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByKeywords('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });
});
