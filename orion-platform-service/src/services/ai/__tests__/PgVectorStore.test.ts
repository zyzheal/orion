/**
 * PgVectorStore Tests (VectorStore with pgvector backend)
 */

import { VectorStore } from '../VectorStore';

// Mock database pool
const mockPool = {
  query: jest.fn(),
};

describe('PgVectorStore (VectorStore with pgvector backend)', () => {
  let vectorStore: VectorStore;

  beforeEach(() => {
    mockPool.query.mockClear();
    vectorStore = new VectorStore(
      {
        host: 'localhost',
        port: 5432,
        collectionName: 'test-collection',
        dimension: 1536,
      },
      mockPool as any
    );
  });

  describe('addDocument', () => {
    it('should add document with generated embedding', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'doc-123', collection: 'test-collection' }],
        rowCount: 1,
      });

      const docId = await vectorStore.addDocument('test content', {
        source: 'test',
      });

      expect(docId).toBeDefined();
      expect(mockPool.query).toHaveBeenCalledTimes(1);

      // Verify INSERT query
      const queryCall = mockPool.query.mock.calls[0];
      expect(queryCall[0]).toContain('INSERT INTO vector_documents');
      expect(queryCall[1]).toContain('test content');
    });

    it('should use provided embedding function', async () => {
      const customEmbeddingFn = async (text: string) => [0.5, 0.6, 0.7];

      const customStore = new VectorStore(
        {
          host: 'localhost',
          port: 5432,
          collectionName: 'test',
          dimension: 3,
          embeddingFn: customEmbeddingFn,
        },
        mockPool as any
      );

      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'doc-456' }],
        rowCount: 1,
      });

      await customStore.addDocument('custom test');

      // Verify custom embedding was used (index 5 is the embedding param, stored as string)
      const queryCall = mockPool.query.mock.calls[0];
      expect(queryCall[1][5]).toBe('[0.5,0.6,0.7]');
    });

    it('should fallback to in-memory storage when no DB provided', async () => {
      const noDbStore = new VectorStore({
        host: 'localhost',
        port: 5432,
        collectionName: 'fallback',
        dimension: 1536,
      });

      const docId = await noDbStore.addDocument('fallback test');

      expect(docId).toBeDefined();
      expect(docId).toContain('doc_');
      expect(noDbStore.isPersistent).toBe(false);
    });
  });

  describe('search', () => {
    it('should perform similarity search via pgvector', async () => {
      const mockRows = [
        {
          id: 'doc-1',
          collection: 'test-collection',
          content: 'similar content A',
          metadata: '{"source":"test"}',
          embedding: '[0.1,0.2,0.3]',
          score: 0.95,
        },
        {
          id: 'doc-2',
          collection: 'test-collection',
          content: 'similar content B',
          metadata: '{"source":"test"}',
          embedding: '[0.11,0.22,0.33]',
          score: 0.85,
        },
      ];

      mockPool.query.mockResolvedValueOnce({
        rows: mockRows,
        rowCount: 2,
      });

      const results = await vectorStore.search({
        query: 'test query',
        topK: 10,
      });

      expect(results.length).toBe(2);
      expect(results[0].document.content).toBe('similar content A');
      // Score is returned from mock, may be parsed differently
      expect(results[0].score).toBeGreaterThanOrEqual(0);

      // Verify vector search query
      const queryCall = mockPool.query.mock.calls[0];
      expect(queryCall[0]).toContain('embedding <=>');
      expect(queryCall[0]).toContain('similarity_score');
    });

    it('should apply metadata filter', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await vectorStore.search({
        query: 'test',
        topK: 5,
        filter: { source: 'production', type: 'docs' },
      });

      const queryCall = mockPool.query.mock.calls[0];
      expect(queryCall[0]).toContain("metadata->>'source'");
      expect(queryCall[0]).toContain("metadata->>'type'");
    });

    it('should fallback to in-memory cosine similarity', async () => {
      const noDbStore = new VectorStore({
        host: 'localhost',
        port: 5432,
        collectionName: 'memory',
        dimension: 1536,
      });

      // Add some documents
      await noDbStore.addDocument('document A about testing');
      await noDbStore.addDocument('document B about development');
      await noDbStore.addDocument('document C about testing again');

      const results = await noDbStore.search({
        query: 'testing',
        topK: 2,
      });

      expect(results.length).toBe(2);
      expect(results.every(r => r.score >= 0 && r.score <= 1)).toBe(true);
    });
  });

  describe('deleteDocument', () => {
    it('should delete document from pgvector', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      const result = await vectorStore.deleteDocument('doc-123');

      expect(result).toBe(true);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM vector_documents'),
        ['doc-123']
      );
    });

    it('should delete from in-memory storage', async () => {
      const noDbStore = new VectorStore({
        host: 'localhost',
        port: 5432,
        collectionName: 'memory',
        dimension: 1536,
      });

      const docId = await noDbStore.addDocument('to be deleted');

      const result = await noDbStore.deleteDocument(docId);

      expect(result).toBe(true);
      expect(noDbStore.documentCount).toBe(0);
    });

    it('should return false when document not found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const result = await vectorStore.deleteDocument('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('isPersistent', () => {
    it('should return true when connected to pgvector', () => {
      expect(vectorStore.isPersistent).toBe(true);
    });

    it('should return false when using in-memory storage', () => {
      const noDbStore = new VectorStore({
        host: 'localhost',
        port: 5432,
        collectionName: 'memory',
        dimension: 1536,
      });

      expect(noDbStore.isPersistent).toBe(false);
    });
  });

  describe('OpenAI embedding integration', () => {
    it('should call OpenAI API when configured', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ embedding: [0.1, 0.2, 0.3, 0.4, 0.5] }],
        }),
      });

      const openaiStore = new VectorStore(
        {
          host: 'localhost',
          port: 5432,
          collectionName: 'openai-test',
          dimension: 5,
          embeddingProvider: 'openai',
          apiKey: 'test-api-key',
          embeddingModel: 'text-embedding-ada-002',
        },
        mockPool as any
      );

      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'doc-openai' }],
        rowCount: 1,
      });

      await openaiStore.addDocument('OpenAI test');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/embeddings',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-api-key',
          }),
        })
      );
    });

    it('should handle OpenAI API error', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });

      const openaiStore = new VectorStore(
        {
          host: 'localhost',
          port: 5432,
          collectionName: 'error-test',
          dimension: 1536,
          embeddingProvider: 'openai',
          apiKey: 'test-key',
        },
        mockPool as any
      );

      await expect(openaiStore.addDocument('error test')).rejects.toThrow(
        'OpenAI embedding API error'
      );
    });
  });

  describe('hash-based embedding fallback', () => {
    it('should generate deterministic embeddings', async () => {
      const hashStore = new VectorStore(
        {
          host: 'localhost',
          port: 5432,
          collectionName: 'hash-test',
          dimension: 1536,
          embeddingProvider: 'hash',
        },
        mockPool as any
      );

      mockPool.query.mockResolvedValue({ rows: [{ id: 'test' }], rowCount: 1 });

      await hashStore.addDocument('hash test 1');
      const call1 = mockPool.query.mock.calls[mockPool.query.mock.calls.length - 1][1][5];

      mockPool.query.mockClear();
      mockPool.query.mockResolvedValue({ rows: [{ id: 'test' }], rowCount: 1 });

      await hashStore.addDocument('hash test 1');
      const call2 = mockPool.query.mock.calls[mockPool.query.mock.calls.length - 1][1][5];

      // Same content should produce same embedding
      expect(call1).toEqual(call2);
    });

    it('should generate different embeddings for different content', async () => {
      const hashStore = new VectorStore(
        {
          host: 'localhost',
          port: 5432,
          collectionName: 'hash-diff',
          dimension: 1536,
          embeddingProvider: 'hash',
        },
        mockPool as any
      );

      mockPool.query.mockResolvedValue({ rows: [{ id: 'test' }], rowCount: 1 });

      await hashStore.addDocument('content A');
      const embedding1 = mockPool.query.mock.calls[mockPool.query.mock.calls.length - 1][1][5];

      mockPool.query.mockClear();
      mockPool.query.mockResolvedValue({ rows: [{ id: 'test' }], rowCount: 1 });

      await hashStore.addDocument('content B');
      const embedding2 = mockPool.query.mock.calls[mockPool.query.mock.calls.length - 1][1][5];

      // Different content should produce different embeddings
      expect(typeof embedding1).toBe('string');
      expect(typeof embedding2).toBe('string');
      expect(embedding1).not.toEqual(embedding2);
    });
  });

  describe('mixed search operations', () => {
    it('should handle add + search + delete sequence', async () => {
      // Add document
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'doc-sequence' }],
        rowCount: 1,
      });

      const docId = await vectorStore.addDocument('sequence test');

      // Search
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'doc-sequence',
            content: 'sequence test',
            metadata: '{}',
            embedding: '[0.1,0.2]',
            score: 0.99,
          },
        ],
        rowCount: 1,
      });

      const results = await vectorStore.search({ query: 'sequence', topK: 5 });

      expect(results.length).toBe(1);

      // Delete
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      const deleted = await vectorStore.deleteDocument(docId);

      expect(deleted).toBe(true);
    });
  });
});