import { LLMTraceRepository } from '../LLMTraceRepository';

describe('LLMTraceRepository', () => {
  const mockQuery = jest.fn();
  let repo: LLMTraceRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new LLMTraceRepository({ query: mockQuery } as any);
  });

  it('should instantiate', () => { expect(repo).toBeDefined(); });

  it('should findByTenant', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1' }], rowCount: 1 });
    await repo.findByTenant('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByScenario', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1' }], rowCount: 1 });
    await repo.findByScenario('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findAll', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1' }], rowCount: 1 });
    await repo.findAll('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should deleteAll', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });
    await repo.deleteAll();
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should getDailyStats', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1' }], rowCount: 1 });
    await repo.getDailyStats('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });
});

