import { PermissionRepository } from '../PermissionRepository';

describe('PermissionRepository', () => {
  const mockQuery = jest.fn();
  let repo: PermissionRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new PermissionRepository({ query: mockQuery } as any);
  });

  it('should instantiate', () => { expect(repo).toBeDefined(); });

  it('should findById', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'p-1' }], rowCount: 1 });
    const result = await repo.findById('p-1');
    expect(mockQuery).toHaveBeenCalled();
  });
});
