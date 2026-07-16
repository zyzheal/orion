import { VectorRepository } from '../VectorRepository';

describe('VectorRepository', () => {
  const mockQuery = jest.fn();
  let repo: VectorRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new VectorRepository({ query: mockQuery } as any);
  });

  it('should instantiate', () => { expect(repo).toBeDefined(); });

  it('should findById', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'v-1' }], rowCount: 1 });
    const result = await repo.findById('v-1');
    expect(mockQuery).toHaveBeenCalled();
  });
});
