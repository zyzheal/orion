import { KnowledgeEmbeddingRepository } from '../KnowledgeEmbeddingRepository';

describe('KnowledgeEmbeddingRepository', () => {
  const mockQuery = jest.fn();
  let repo: KnowledgeEmbeddingRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new KnowledgeEmbeddingRepository({ query: mockQuery } as any);
  });

  it('should instantiate', () => { expect(repo).toBeDefined(); });

  it('should findByDocId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'e-1' }], rowCount: 1 });
    const result = await repo.findByDocId('doc-1');
    expect(mockQuery).toHaveBeenCalled();
  });
});
