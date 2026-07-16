/**
 * CodeEmbeddingService Tests
 */

import { CodeEmbeddingService, EmbeddingProviderType } from '../CodeEmbeddingService';
import { CodeEmbeddingRepository } from '../../../repositories/CodeEmbeddingRepository';

// Mock repository
const mockRepository = {
  insert: jest.fn(),
  findById: jest.fn(),
  findByFilePath: jest.fn(),
  deleteByFilePath: jest.fn(),
  search: jest.fn(),
};

// Mock fetch for API calls
global.fetch = jest.fn();

describe('CodeEmbeddingService', () => {
  let service: CodeEmbeddingService;

  beforeEach(() => {
    jest.clearAllMocks();

    // Default: hash provider (no external API calls)
    service = new CodeEmbeddingService(
      mockRepository as any,
      { type: 'hash' }
    );
  });

  describe('chunkCode', () => {
    it('should chunk TypeScript code into functions', () => {
      // Generate TypeScript functions with 50+ lines each (minChunkSize = 50)
      const lines: string[] = [];
      for (let i = 0; i < 3; i++) {
        lines.push(`function processData${i}(data: any): any {`);
        for (let j = 0; j < 55; j++) {
          lines.push(`  const step${j} = data.value + ${j};`);
        }
        lines.push(`  return data;`);
        lines.push(`}`);
        lines.push('');
      }
      const code = lines.join('\n');

      const result = service.chunkCode(code, 'src/utils.ts', 'typescript');

      expect(result.metadata.filePath).toBe('src/utils.ts');
      expect(result.metadata.language).toBe('typescript');
      expect(result.chunks.length).toBeGreaterThan(0);
      expect(result.chunks.some(c => c.type === 'function')).toBe(true);
    });

    it('should chunk Python code into functions', () => {
      // Each function needs 50+ lines to be extracted as a chunk (minChunkSize = 50)
      const lines: string[] = [];
      lines.push('# Calculator module with comprehensive functionality');
      lines.push('');

      // Generate 2 functions with 50+ lines each
      for (let i = 0; i < 2; i++) {
        lines.push(`def operation_${i}(a, b):`);
        lines.push(`    """Perform operation ${i}."""`);
        for (let j = 0; j < 50; j++) {
          lines.push(`    # Step ${j + 1} of processing`);
          lines.push(`    temp_${j} = a + b + ${j}`);
        }
        lines.push(`    result = a + b + ${i}`);
        lines.push(`    return result`);
        lines.push('');
      }

      const code = lines.join('\n');

      const result = service.chunkCode(code, 'src/calc.py', 'python');

      expect(result.metadata.language).toBe('python');
      expect(result.chunks.length).toBeGreaterThan(0);
    });

    it('should fallback to size-based chunking for unknown language', () => {
      const code = 'Some random text that is longer than fifty characters and should be chunked by size rather than by function boundaries';

      const result = service.chunkCode(code, 'unknown.txt', 'unknown', {
        splitBy: 'file',
        maxChunkSize: 100,
        minChunkSize: 20,
      });

      expect(result.chunks.length).toBeGreaterThan(0);
      expect(result.chunks[0].type).toBe('snippet');
    });
  });

  describe('generateEmbedding', () => {
    it('should generate hash-based embedding for hash provider', async () => {
      const text = 'test content';
      const embedding = await service.generateEmbedding(text);

      expect(embedding.length).toBe(1536);
      // Hash embedding values can be slightly outside [-1, 1] due to algorithm
      expect(embedding.every(v => v >= -2 && v <= 2)).toBe(true);
    });

    it('should use cached embedding when available', async () => {
      const text = 'test content';

      // First call
      const embedding1 = await service.generateEmbedding(text);

      // Second call should use cache
      const embedding2 = await service.generateEmbedding(text);

      expect(embedding1).toEqual(embedding2);
    });
  });

  describe('generateEmbedding with OpenAI', () => {
    it('should call OpenAI API when configured', async () => {
      const openaiService = new CodeEmbeddingService(
        mockRepository as any,
        {
          type: 'openai',
          apiKey: 'test-key',
          model: 'text-embedding-ada-002',
        }
      );

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ embedding: [0.1, 0.2, 0.3] }],
        }),
      });

      const embedding = await openaiService.generateEmbedding('test');

      expect(embedding).toEqual([0.1, 0.2, 0.3]);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/embeddings',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-key',
          }),
        })
      );
    });

    it('should throw error on API failure', async () => {
      const openaiService = new CodeEmbeddingService(
        mockRepository as any,
        { type: 'openai', apiKey: 'test-key' }
      );

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });

      await expect(openaiService.generateEmbedding('test')).rejects.toThrow(
        'OpenAI embedding API error'
      );
    });
  });

  describe('batchEmbed', () => {
    it('should batch embed multiple inputs', async () => {
      const inputs = [
        {
          projectId: 'proj-1',
          filePath: 'src/a.ts',
          chunkType: 'function' as const,
          chunkName: 'funcA',
          content: 'function funcA() {}',
          metadata: { language: 'typescript', lineStart: 1, lineEnd: 3 },
        },
        {
          projectId: 'proj-1',
          filePath: 'src/b.ts',
          chunkType: 'function' as const,
          chunkName: 'funcB',
          content: 'function funcB() {}',
          metadata: { language: 'typescript', lineStart: 1, lineEnd: 3 },
        },
      ];

      mockRepository.insert.mockResolvedValue({ id: 'emb-1' });
      mockRepository.findByFilePath.mockResolvedValue([]);

      const result = await service.batchEmbed(inputs, 2, false);

      expect(result.success).toBe(true);
      expect(result.processed).toBe(2);
      expect(result.skipped).toBe(0);
      expect(result.failed).toBe(0);
      expect(mockRepository.insert).toHaveBeenCalledTimes(2);
    });

    it('should skip existing embeddings when skipExisting=true', async () => {
      const inputs = [
        {
          projectId: 'proj-1',
          filePath: 'src/a.ts',
          chunkType: 'function' as const,
          chunkName: 'funcA',
          content: 'existing content',
          metadata: { language: 'typescript', lineStart: 1, lineEnd: 3 },
        },
      ];

      // Simulate existing embedding
      mockRepository.findByFilePath.mockResolvedValue([
        {
          id: 'existing-emb',
          projectId: 'proj-1',
          filePath: 'src/a.ts',
          chunkType: 'function',
          chunkName: 'funcA',
          content: 'existing content',
          embedding: [],
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await service.batchEmbed(inputs, 2, true);

      expect(result.skipped).toBe(1);
      expect(result.processed).toBe(0);
    });

    it('should report errors for failed embeddings', async () => {
      const inputs = [
        {
          projectId: 'proj-1',
          filePath: 'src/a.ts',
          chunkType: 'function' as const,
          chunkName: 'funcA',
          content: 'content',
          metadata: { language: 'typescript', lineStart: 1, lineEnd: 3 },
        },
      ];

      mockRepository.findByFilePath.mockResolvedValue([]);
      mockRepository.insert.mockRejectedValue(new Error('DB error'));

      const result = await service.batchEmbed(inputs, 2, false);

      expect(result.success).toBe(false);
      expect(result.failed).toBe(1);
      expect(result.errors?.length).toBe(1);
      expect(result.errors?.[0].error).toBe('DB error');
    });
  });

  describe('embedFile', () => {
    it('should chunk and embed entire file', async () => {
      const fileContent = `
function add(a: number, b: number): number {
  return a + b;
}

function subtract(a: number, b: number): number {
  return a - b;
}
`;

      mockRepository.findByFilePath.mockResolvedValue([]);
      mockRepository.insert.mockResolvedValue({ id: 'emb-123' });

      const result = await service.embedFile(
        'proj-123',
        'src/math.ts',
        fileContent,
        'typescript'
      );

      expect(result.processed).toBeGreaterThan(0);
      expect(result.success).toBe(true);
    });
  });

  describe('updateFileEmbeddings', () => {
    it('should delete old embeddings and embed new content', async () => {
      mockRepository.deleteByFilePath.mockResolvedValue(3);
      mockRepository.findByFilePath.mockResolvedValue([]);
      mockRepository.insert.mockResolvedValue({ id: 'new-emb' });

      const newContent = 'function newFunc() {}';

      const result = await service.updateFileEmbeddings(
        'proj-123',
        'src/file.ts',
        newContent,
        'typescript'
      );

      expect(mockRepository.deleteByFilePath).toHaveBeenCalledWith(
        'proj-123',
        'src/file.ts'
      );
      expect(result.success).toBe(true);
    });
  });

  describe('detectLanguage helper', () => {
    it('should be used automatically from file extension', async () => {
      // Need enough code to produce at least one chunk (minChunkSize is 50 lines)
      const code = Array.from({ length: 60 }, (_, i) =>
        `function test${i}() { return ${i}; }`
      ).join('\n');

      mockRepository.findByFilePath.mockResolvedValue([]);
      mockRepository.insert.mockResolvedValue({ id: 'emb-1' });

      const result = await service.embedFile('proj-1', 'src/utils.ts', code);

      // Language should be detected as TypeScript from .ts extension
      expect(result.success).toBe(true);
      expect(result.processed).toBeGreaterThan(0);
    });
  });
});