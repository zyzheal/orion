import { BuildCacheConfigRepository, BuildCacheEntryRepository } from '../BuildCacheRepository';

describe('BuildCacheConfigRepository', () => {
  let repo: BuildCacheConfigRepository;
  const mockQuery = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new BuildCacheConfigRepository({ query: mockQuery } as any);
  });

  it('should instantiate', () => {
    expect(repo).toBeDefined();
  });
});

describe('BuildCacheEntryRepository', () => {
  let repo: BuildCacheEntryRepository;
  const mockQuery = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new BuildCacheEntryRepository({ query: mockQuery } as any);
  });

  it('should instantiate', () => {
    expect(repo).toBeDefined();
  });

  it('should deleteExpired', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1' }], rowCount: 1 });
    await repo.deleteExpired();
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should deleteByConfigId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1' }], rowCount: 1 });
    await repo.deleteByConfigId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findLRUEntries', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1' }], rowCount: 1 });
    await repo.findLRUEntries('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should recordHit', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1' }], rowCount: 1 });
    await repo.recordHit('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });
});

