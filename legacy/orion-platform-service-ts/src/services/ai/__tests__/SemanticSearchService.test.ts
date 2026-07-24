/**
 * SemanticSearchService - Semantic Search Unit Tests
 *
 * Coverage: search, findSimilarCode, searchDocs, crossProjectSearch,
 *           hybrid search, keyword extraction, result combining
 */

import { SemanticSearchService } from '../SemanticSearchService';

// Mock dependencies
const mockCodeRepository = {
  search: jest.fn(),
  keywordSearch: jest.fn(),
};

const mockKnowledgeRepository = {
  search: jest.fn(),
  keywordSearch: jest.fn(),
};

const mockEmbeddingService = {
  generateEmbedding: jest.fn(),
};

describe('SemanticSearchService', () => {
  let service: SemanticSearchService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SemanticSearchService(
      mockCodeRepository as any,
      mockKnowledgeRepository as any,
      mockEmbeddingService as any
    );
  });

  // ==================== search ====================

  describe('search', () => {
    it('should search code and knowledge', async () => {
      mockEmbeddingService.generateEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
      mockCodeRepository.search.mockResolvedValue([
        { embedding: { id: 'c1', content: 'function test()', filePath: 'a.ts', chunkType: 'function', chunkName: 'test', projectId: 'p1', metadata: {} }, similarity: 0.9 },
      ]);
      mockKnowledgeRepository.search.mockResolvedValue([
        { embedding: { id: 'k1', content: 'Documentation', docId: 'd1', docType: 'guide', title: 'Guide', metadata: {} }, similarity: 0.85 },
      ]);

      const result = await service.search({
        query: 'test function',
        options: { searchType: 'all', limit: 10, threshold: 0.7 },
      });

      expect(result.codeMatches).toHaveLength(1);
      expect(result.knowledgeMatches).toHaveLength(1);
      expect(result.metadata.totalMatches).toBe(2);
      expect(result.metadata.queryEmbeddingTime).toBeGreaterThanOrEqual(0);
      expect(result.metadata.searchTime).toBeGreaterThanOrEqual(0);
    });

    it('should search code only', async () => {
      mockEmbeddingService.generateEmbedding.mockResolvedValue([0.1]);
      mockCodeRepository.search.mockResolvedValue([]);

      const result = await service.search({
        query: 'test',
        options: { searchType: 'code', limit: 10, threshold: 0.7 },
      });

      expect(result.codeMatches).toHaveLength(0);
      expect(result.knowledgeMatches).toBeUndefined();
    });

    it('should search knowledge only', async () => {
      mockEmbeddingService.generateEmbedding.mockResolvedValue([0.1]);
      mockKnowledgeRepository.search.mockResolvedValue([]);

      const result = await service.search({
        query: 'test',
        options: { searchType: 'knowledge', limit: 10, threshold: 0.7 },
      });

      expect(result.knowledgeMatches).toHaveLength(0);
      expect(result.codeMatches).toBeUndefined();
    });

    it('should filter by threshold', async () => {
      mockEmbeddingService.generateEmbedding.mockResolvedValue([0.1]);
      mockCodeRepository.search.mockResolvedValue([
        { embedding: { id: 'c1', content: 'high', filePath: 'a.ts', chunkType: 'function', chunkName: 'a', projectId: 'p1', metadata: {} }, similarity: 0.9 },
        { embedding: { id: 'c2', content: 'low', filePath: 'b.ts', chunkType: 'function', chunkName: 'b', projectId: 'p1', metadata: {} }, similarity: 0.5 },
      ]);

      const result = await service.search({
        query: 'test',
        options: { searchType: 'code', limit: 10, threshold: 0.7 },
      });

      expect(result.codeMatches).toHaveLength(1);
      expect(result.codeMatches![0].id).toBe('c1');
    });

    it('should use default options', async () => {
      mockEmbeddingService.generateEmbedding.mockResolvedValue([0.1]);
      mockCodeRepository.search.mockResolvedValue([]);
      mockKnowledgeRepository.search.mockResolvedValue([]);

      const result = await service.search({
        query: 'test',
        options: {},
      });

      expect(result.metadata.totalMatches).toBe(0);
    });

    it('should perform hybrid search with keyword boost', async () => {
      mockEmbeddingService.generateEmbedding.mockResolvedValue([0.1]);
      mockCodeRepository.search.mockResolvedValue([
        { embedding: { id: 'c1', content: 'function test()', filePath: 'a.ts', chunkType: 'function', chunkName: 'test', projectId: 'p1', metadata: {} }, similarity: 0.8 },
      ]);
      mockCodeRepository.keywordSearch.mockResolvedValue([
        { id: 'c2', content: 'keyword match', filePath: 'b.ts', chunkType: 'function', chunkName: 'match', projectId: 'p1', metadata: {} },
      ]);
      mockKnowledgeRepository.search.mockResolvedValue([]);

      const result = await service.search({
        query: 'test function',
        options: { searchType: 'code', limit: 10, threshold: 0.5, hybridSearch: true, keywordBoost: 0.3 },
      });

      expect(mockCodeRepository.keywordSearch).toHaveBeenCalled();
      expect(result.codeMatches!.length).toBeGreaterThanOrEqual(1);
      expect(result.metadata.hybridKeywordMatches).toBeDefined();
    });
  });

  // ==================== findSimilarCode ====================

  describe('findSimilarCode', () => {
    it('should find similar code', async () => {
      mockEmbeddingService.generateEmbedding.mockResolvedValue([0.1, 0.2]);
      mockCodeRepository.search.mockResolvedValue([
        { embedding: { id: 'c1', content: 'similar code', filePath: 'a.ts', chunkType: 'function', chunkName: 'fn', projectId: 'p1', metadata: {} }, similarity: 0.95 },
      ]);

      const result = await service.findSimilarCode('function hello() {}', 'p1');

      expect(result).toHaveLength(1);
      expect(result[0].similarity).toBe(0.95);
      expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalledWith('function hello() {}');
    });

    it('should work without projectId', async () => {
      mockEmbeddingService.generateEmbedding.mockResolvedValue([0.1]);
      mockCodeRepository.search.mockResolvedValue([]);

      const result = await service.findSimilarCode('code');
      expect(result).toEqual([]);
    });
  });

  // ==================== searchDocs ====================

  describe('searchDocs', () => {
    it('should search documentation', async () => {
      mockEmbeddingService.generateEmbedding.mockResolvedValue([0.1]);
      mockKnowledgeRepository.search.mockResolvedValue([
        { embedding: { id: 'k1', content: 'API guide', docId: 'd1', docType: 'guide', title: 'API Guide', metadata: {} }, similarity: 0.88 },
      ]);

      const result = await service.searchDocs('API documentation', ['guide']);

      expect(result).toHaveLength(1);
      expect(result[0].source.title).toBe('API Guide');
    });

    it('should work without docType filter', async () => {
      mockEmbeddingService.generateEmbedding.mockResolvedValue([0.1]);
      mockKnowledgeRepository.search.mockResolvedValue([]);

      const result = await service.searchDocs('test');
      expect(result).toEqual([]);
    });
  });

  // ==================== crossProjectSearch ====================

  describe('crossProjectSearch', () => {
    it('should search across specified projects', async () => {
      mockEmbeddingService.generateEmbedding.mockResolvedValue([0.1]);
      mockCodeRepository.search
        .mockResolvedValueOnce([
          { embedding: { id: 'c1', content: 'code1', filePath: 'a.ts', chunkType: 'function', chunkName: 'fn1', projectId: 'p1', metadata: {} }, similarity: 0.9 },
        ])
        .mockResolvedValueOnce([
          { embedding: { id: 'c2', content: 'code2', filePath: 'b.ts', chunkType: 'function', chunkName: 'fn2', projectId: 'p2', metadata: {} }, similarity: 0.8 },
        ]);

      const result = await service.crossProjectSearch('test', ['p1', 'p2']);

      expect(result).toHaveLength(2);
      // Sorted by similarity descending
      expect(result[0].similarity).toBeGreaterThanOrEqual(result[1].similarity);
    });

    it('should search all projects when no projectIds specified', async () => {
      mockEmbeddingService.generateEmbedding.mockResolvedValue([0.1]);
      mockCodeRepository.search.mockResolvedValue([
        { embedding: { id: 'c1', content: 'code', filePath: 'a.ts', chunkType: 'function', chunkName: 'fn', projectId: 'p1', metadata: {} }, similarity: 0.9 },
      ]);

      const result = await service.crossProjectSearch('test');

      expect(result).toHaveLength(1);
    });

    it('should limit results', async () => {
      mockEmbeddingService.generateEmbedding.mockResolvedValue([0.1]);
      const manyResults = Array.from({ length: 30 }, (_, i) => ({
        embedding: { id: `c${i}`, content: `code${i}`, filePath: `${i}.ts`, chunkType: 'function', chunkName: `fn${i}`, projectId: 'p1', metadata: {} },
        similarity: 0.9 - i * 0.01,
      }));
      mockCodeRepository.search.mockResolvedValue(manyResults);

      const result = await service.crossProjectSearch('test', undefined, 5);

      expect(result).toHaveLength(5);
    });
  });
});
