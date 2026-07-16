import { GitOpsRepository } from '../GitOpsRepository';

describe('GitOpsRepository', () => {
  const mockQuery = jest.fn();
  let repo: GitOpsRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new GitOpsRepository({ query: mockQuery } as any);
  });

  it('should instantiate', () => { expect(repo).toBeDefined(); });

  it('should findAll', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1' }], rowCount: 1 });
    await repo.findAll();
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByStatus', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1' }], rowCount: 1 });
    await repo.findByStatus('active');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should delete', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });
    await repo.delete('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findSyncHistory', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1' }], rowCount: 1 });
    await repo.findSyncHistory('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });
});

