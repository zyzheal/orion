/**
 * CodeEmbeddingRepository Tests
 */

import { CodeEmbeddingRepository } from '../../repositories/CodeEmbeddingRepository';

// Mock database pool
const mockPool = {
  query: jest.fn(),
};

describe('CodeEmbeddingRepository', () => {
  let repository: CodeEmbeddingRepository;

  beforeEach(() => {
    repository = new CodeEmbeddingRepository(mockPool as any);
    mockPool.query.mockClear();
  });

  describe('insert', () => {
    it('should insert a code embedding with generated UUID', async () => {
      const input = {
        projectId: 'proj-123',
        filePath: 'src/utils.ts',
        chunkType: 'function' as const,
        chunkName: 'formatDate',
        content: 'function formatDate(date: Date): string { ... }',
        metadata: {
          language: 'typescript',
          lineStart: 10,
          lineEnd: 20,
        },
      };

      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      const result = await repository.insert(input);

      expect(result.id).toBeDefined();
      expect(result.projectId).toBe(input.projectId);
      expect(result.filePath).toBe(input.filePath);
      expect(result.chunkType).toBe(input.chunkType);
      expect(result.chunkName).toBe(input.chunkName);
      expect(mockPool.query).toHaveBeenCalledTimes(1);
    });

    it('should handle embedding vector correctly', async () => {
      const embedding = [0.1, 0.2, 0.3, 0.4, 0.5];
      const input = {
        projectId: 'proj-123',
        filePath: 'src/utils.ts',
        chunkType: 'function' as const,
        chunkName: 'testFunc',
        content: 'test content',
        metadata: { language: 'typescript', lineStart: 1, lineEnd: 5 },
        embedding,
      };

      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      await repository.insert(input);

      // Verify embedding was serialized correctly
      const queryCall = mockPool.query.mock.calls[0];
      expect(queryCall[1][6]).toBe('[0.1,0.2,0.3,0.4,0.5]');
    });
  });

  describe('findById', () => {
    it('should return embedding when found', async () => {
      const mockRow = {
        id: 'emb-123',
        project_id: 'proj-123',
        file_path: 'src/utils.ts',
        chunk_type: 'function',
        chunk_name: 'formatDate',
        content: 'function formatDate...',
        embedding: '[0.1,0.2,0.3]',
        metadata: '{"language":"typescript","lineStart":10,"lineEnd":20}',
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPool.query.mockResolvedValueOnce({ rows: [mockRow], rowCount: 1 });

      const result = await repository.findById('emb-123');

      expect(result).toBeDefined();
      expect(result?.id).toBe('emb-123');
      expect(result?.projectId).toBe('proj-123');
      expect(result?.chunkType).toBe('function');
      expect(result?.embedding).toEqual([0.1, 0.2, 0.3]);
    });

    it('should return null when not found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const result = await repository.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findByProject', () => {
    it('should return all embeddings for a project', async () => {
      const mockRows = [
        {
          id: 'emb-1',
          project_id: 'proj-123',
          file_path: 'src/a.ts',
          chunk_type: 'function',
          chunk_name: 'funcA',
          content: 'content A',
          embedding: null,
          metadata: '{}',
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: 'emb-2',
          project_id: 'proj-123',
          file_path: 'src/b.ts',
          chunk_type: 'class',
          chunk_name: 'ClassB',
          content: 'content B',
          embedding: null,
          metadata: '{}',
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockPool.query.mockResolvedValueOnce({ rows: mockRows, rowCount: 2 });

      const results = await repository.findByProject('proj-123');

      expect(results.length).toBe(2);
      expect(results[0].filePath).toBe('src/a.ts');
      expect(results[1].chunkType).toBe('class');
    });
  });

  describe('delete', () => {
    it('should return true when deletion succeeds', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      const result = await repository.delete('emb-123');

      expect(result).toBe(true);
    });

    it('should return false when nothing deleted', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const result = await repository.delete('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('deleteByFilePath', () => {
    it('should delete all embeddings for a file', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 5 });

      const count = await repository.deleteByFilePath('proj-123', 'src/old.ts');

      expect(count).toBe(5);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM code_embeddings'),
        ['proj-123', 'src/old.ts']
      );
    });
  });

  describe('count', () => {
    it('should return total count without filters', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ count: '42' }], rowCount: 1 });

      const count = await repository.count();

      expect(count).toBe(42);
    });

    it('should return count with project filter', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ count: '10' }], rowCount: 1 });

      const count = await repository.count({ projectId: 'proj-123' });

      expect(count).toBe(10);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('project_id = $1'),
        ['proj-123']
      );
    });

    it('should return count with chunkType filter', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ count: '5' }], rowCount: 1 });

      const count = await repository.count({ chunkType: 'function' });

      expect(count).toBe(5);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('chunk_type = $1'),
        ['function']
      );
    });
  });

  describe('search', () => {
    it('should return results with similarity scores', async () => {
      const queryEmbedding = [0.1, 0.2, 0.3, 0.4];
      const mockRows = [
        {
          id: 'emb-1',
          project_id: 'proj-123',
          file_path: 'src/a.ts',
          chunk_type: 'function',
          chunk_name: 'funcA',
          content: 'similar content',
          embedding: '[0.11,0.21,0.31,0.41]',
          metadata: '{}',
          created_at: new Date(),
          updated_at: new Date(),
          similarity_score: '0.95',
        },
        {
          id: 'emb-2',
          project_id: 'proj-123',
          file_path: 'src/b.ts',
          chunk_type: 'function',
          chunk_name: 'funcB',
          content: 'less similar',
          embedding: '[0.5,0.6,0.7,0.8]',
          metadata: '{}',
          created_at: new Date(),
          updated_at: new Date(),
          similarity_score: '0.60',
        },
      ];

      mockPool.query.mockResolvedValueOnce({ rows: mockRows, rowCount: 2 });

      const results = await repository.search(queryEmbedding, 10);

      expect(results.length).toBe(2);
      expect(results[0].similarity).toBeCloseTo(0.95);
      expect(results[1].similarity).toBeCloseTo(0.60);
    });

    it('should filter by projectId', async () => {
      const queryEmbedding = [0.1, 0.2, 0.3];
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await repository.search(queryEmbedding, 10, { projectId: 'proj-123' });

      const query = mockPool.query.mock.calls[0][0];
      expect(query).toContain('project_id = $2');
    });

    it('should filter by chunkType array', async () => {
      const queryEmbedding = [0.1, 0.2];
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await repository.search(queryEmbedding, 10, {
        chunkType: ['function', 'class'],
      });

      const query = mockPool.query.mock.calls[0][0];
      expect(query).toContain('chunk_type = ANY');
    });
  });

  describe('keywordSearch', () => {
    it('should search by keywords in content and chunk_name', async () => {
      const mockRows = [
        {
          id: 'emb-1',
          project_id: 'proj-123',
          file_path: 'src/utils.ts',
          chunk_type: 'function',
          chunk_name: 'formatDate',
          content: 'function formatDate(date: Date)',
          embedding: null,
          metadata: '{}',
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockPool.query.mockResolvedValueOnce({ rows: mockRows, rowCount: 1 });

      const results = await repository.keywordSearch(['formatDate', 'date']);

      expect(results.length).toBe(1);
      expect(results[0].chunkName).toBe('formatDate');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('content ILIKE'),
        expect.arrayContaining(['%formatDate%', '%formatDate%'])
      );
    });
  });

  describe('parseEmbedding', () => {
    it('should parse string embedding correctly', async () => {
      const mockRow = {
        id: 'test',
        project_id: 'proj',
        file_path: 'file.ts',
        chunk_type: 'function',
        chunk_name: 'test',
        content: 'test',
        embedding: '[0.1,0.2,0.3,0.4,0.5]',
        metadata: '{}',
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPool.query.mockResolvedValueOnce({ rows: [mockRow], rowCount: 1 });

      const result = await repository.findById('test');

      expect(result?.embedding).toEqual([0.1, 0.2, 0.3, 0.4, 0.5]);
    });

    it('should return empty array for null embedding', async () => {
      const mockRow = {
        id: 'test',
        project_id: 'proj',
        file_path: 'file.ts',
        chunk_type: 'function',
        chunk_name: 'test',
        content: 'test',
        embedding: null,
        metadata: '{}',
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPool.query.mockResolvedValueOnce({ rows: [mockRow], rowCount: 1 });

      const result = await repository.findById('test');

      expect(result?.embedding).toEqual([]);
    });
  });
});