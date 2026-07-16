import { ExecutionTimelineRepository } from '../ExecutionTimelineRepository';

describe('ExecutionTimelineRepository', () => {
  const mockQuery = jest.fn();
  let repo: ExecutionTimelineRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new ExecutionTimelineRepository({ query: mockQuery } as any);
  });

  it('should instantiate', () => { expect(repo).toBeDefined(); });

  it('should findByRunId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1' }], rowCount: 1 });
    await repo.findByRunId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should getNextSequenceNum', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1' }], rowCount: 1 });
    await repo.getNextSequenceNum('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByTimelineId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1' }], rowCount: 1 });
    await repo.findByTimelineId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });
});

