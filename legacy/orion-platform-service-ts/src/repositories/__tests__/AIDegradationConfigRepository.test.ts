/**
 * AIDegradationConfigRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { AIDegradationConfigRepository, AIDegradationResultCacheRepository } from '../AIDegradationConfigRepository';

const mockQuery = jest.fn();

describe('AIDegradationConfigRepository', () => {
  let repo: AIDegradationConfigRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new AIDegradationConfigRepository({ query: mockQuery } as any);
  });

  it('should findByScenario', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByScenario('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should listAll', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.listAll();
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should upsertByScenario', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.upsertByScenario('test-arg', 'test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should deleteByScenario', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.deleteByScenario('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });
});

describe('AIDegradationResultCacheRepository', () => {
  let repo: AIDegradationResultCacheRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new AIDegradationResultCacheRepository({ query: mockQuery } as any);
  });

  it('should findByCacheKey', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByCacheKey('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByScenario', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByScenario('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should upsertByCacheKey', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.upsertByCacheKey('test-arg', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should deleteByScenario', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.deleteByScenario('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should pruneExpired', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.pruneExpired();
    expect(mockQuery).toHaveBeenCalled();
  });
});
