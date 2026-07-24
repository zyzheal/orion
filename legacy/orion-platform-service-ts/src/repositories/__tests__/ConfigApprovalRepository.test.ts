import { ConfigApprovalRepository } from '../ConfigApprovalRepository';

describe('ConfigApprovalRepository', () => {
  const mockQuery = jest.fn();
  let repo: ConfigApprovalRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new ConfigApprovalRepository({ query: mockQuery } as any);
  });

  it('should instantiate', () => { expect(repo).toBeDefined(); });

  it('should findByConfig', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1' }], rowCount: 1 });
    await repo.findByConfig('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should delete', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });
    await repo.delete('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });
});

