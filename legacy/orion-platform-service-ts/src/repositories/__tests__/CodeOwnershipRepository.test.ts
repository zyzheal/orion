import { CodeOwnershipRepository } from '../CodeOwnershipRepository';

describe('CodeOwnershipRepository', () => {
  const mockQuery = jest.fn();
  let repo: CodeOwnershipRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new CodeOwnershipRepository({ query: mockQuery } as any);
  });

  it('should instantiate', () => { expect(repo).toBeDefined(); });

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

