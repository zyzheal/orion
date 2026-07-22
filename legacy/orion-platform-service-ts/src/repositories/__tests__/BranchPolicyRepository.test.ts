import { BranchPolicyRepository } from '../BranchPolicyRepository';

describe('BranchPolicyRepository', () => {
  const mockQuery = jest.fn();
  let repo: BranchPolicyRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new BranchPolicyRepository({ query: mockQuery } as any);
  });

  it('should instantiate', () => { expect(repo).toBeDefined(); });

  it('should findByRepo', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1' }], rowCount: 1 });
    await repo.findByRepo('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findAll', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1' }], rowCount: 1 });
    await repo.findAll();
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should delete', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });
    await repo.delete('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });
});

