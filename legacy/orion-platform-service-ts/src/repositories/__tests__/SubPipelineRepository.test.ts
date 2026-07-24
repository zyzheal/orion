import { SubPipelineRepository } from '../SubPipelineRepository';

describe('SubPipelineRepository', () => {
  const mockQuery = jest.fn();
  let repo: SubPipelineRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new SubPipelineRepository({ query: mockQuery } as any);
  });

  it('should instantiate', () => { expect(repo).toBeDefined(); });

  it('should findByParentRunId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1' }], rowCount: 1 });
    await repo.findByParentRunId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByPipelineId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1' }], rowCount: 1 });
    await repo.findByPipelineId('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should delete', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });
    await repo.delete('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should countByStatus', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1' }], rowCount: 1 });
    await repo.countByStatus('active');
    expect(mockQuery).toHaveBeenCalled();
  });
});

