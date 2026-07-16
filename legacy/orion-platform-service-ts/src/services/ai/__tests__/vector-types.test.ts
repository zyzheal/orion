/**
 * vector-types.ts 类型兼容性测试
 *
 * 测试覆盖:
 * - 所有导出类型可正确使用
 * - 接口字段类型兼容性
 * - 常量值约束验证
 * - 可选字段处理
 */

import type {
  EmbeddingProviderType,
  EmbeddingProviderConfig,
  CodeChunkType,
  CodeChunkMetadata,
  CodeEmbedding,
  CodeEmbeddingInput,
  KnowledgeDocType,
  KnowledgeMetadata,
  KnowledgeEmbedding,
  KnowledgeEmbeddingInput,
  SemanticSearchRequest,
  CodeSearchMatch,
  KnowledgeSearchMatch,
  SemanticSearchResult,
  BatchEmbedRequest,
  BatchEmbedResult,
  EmbeddingStatus,
  ChunkingConfig,
  ChunkedCode,
  EmbeddingCacheEntry,
  EmbeddingCacheConfig,
} from '../vector-types';

describe('vector-types', () => {
  // ==================== EmbeddingProviderType ====================

  describe('EmbeddingProviderType', () => {
    it('should accept valid provider types', () => {
      const providers: EmbeddingProviderType[] = ['openai', 'voyage', 'claude', 'hash'];
      expect(providers.length).toBe(4);
    });

    it('should be assignable from string literal', () => {
      const provider: EmbeddingProviderType = 'openai';
      expect(provider).toBe('openai');
    });
  });

  // ==================== EmbeddingProviderConfig ====================

  describe('EmbeddingProviderConfig', () => {
    it('should accept minimal config with only type', () => {
      const config: EmbeddingProviderConfig = { type: 'hash' };
      expect(config.type).toBe('hash');
      expect(config.apiKey).toBeUndefined();
      expect(config.model).toBeUndefined();
      expect(config.baseUrl).toBeUndefined();
    });

    it('should accept full config', () => {
      const config: EmbeddingProviderConfig = {
        type: 'openai',
        apiKey: 'sk-test-key',
        model: 'text-embedding-3-small',
        baseUrl: 'https://api.openai.com/v1',
      };
      expect(config.type).toBe('openai');
      expect(config.apiKey).toBe('sk-test-key');
      expect(config.model).toBe('text-embedding-3-small');
      expect(config.baseUrl).toBe('https://api.openai.com/v1');
    });
  });

  // ==================== CodeChunkType ====================

  describe('CodeChunkType', () => {
    it('should accept all valid chunk types', () => {
      const types: CodeChunkType[] = ['function', 'class', 'file', 'snippet'];
      expect(types.length).toBe(4);
    });
  });

  // ==================== CodeChunkMetadata ====================

  describe('CodeChunkMetadata', () => {
    it('should accept minimal metadata with required fields', () => {
      const metadata: CodeChunkMetadata = {
        language: 'typescript',
        lineStart: 1,
        lineEnd: 10,
      };
      expect(metadata.language).toBe('typescript');
      expect(metadata.lineStart).toBe(1);
      expect(metadata.lineEnd).toBe(10);
      expect(metadata.dependencies).toBeUndefined();
      expect(metadata.exports).toBeUndefined();
    });

    it('should accept full metadata', () => {
      const metadata: CodeChunkMetadata = {
        language: 'python',
        lineStart: 5,
        lineEnd: 50,
        dependencies: ['os', 'sys', 'json'],
        exports: ['MyClass', 'my_function'],
        complexity: 15,
        author: 'developer@example.com',
      };
      expect(metadata.dependencies).toHaveLength(3);
      expect(metadata.exports).toHaveLength(2);
      expect(metadata.complexity).toBe(15);
      expect(metadata.author).toBe('developer@example.com');
    });
  });

  // ==================== CodeEmbedding ====================

  describe('CodeEmbedding', () => {
    it('should accept valid code embedding', () => {
      const embedding: CodeEmbedding = {
        id: 'emb-001',
        projectId: 'proj-001',
        filePath: 'src/services/ai/CostOptimizerService.ts',
        chunkType: 'function',
        chunkName: 'analyzeCostSavings',
        content: 'function analyzeCostSavings() { ... }',
        embedding: new Array(1536).fill(0.1),
        metadata: {
          language: 'typescript',
          lineStart: 150,
          lineEnd: 184,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(embedding.id).toBe('emb-001');
      expect(embedding.embedding.length).toBe(1536);
      expect(embedding.chunkType).toBe('function');
    });
  });

  // ==================== CodeEmbeddingInput ====================

  describe('CodeEmbeddingInput', () => {
    it('should accept input without embedding (optional)', () => {
      const input: CodeEmbeddingInput = {
        projectId: 'proj-001',
        filePath: 'src/index.ts',
        chunkType: 'file',
        chunkName: 'index',
        content: 'export * from "./module"',
        metadata: {
          language: 'typescript',
          lineStart: 1,
          lineEnd: 1,
        },
      };

      expect(input.embedding).toBeUndefined();
    });

    it('should accept input with embedding', () => {
      const input: CodeEmbeddingInput = {
        projectId: 'proj-001',
        filePath: 'src/index.ts',
        chunkType: 'file',
        chunkName: 'index',
        content: 'export * from "./module"',
        embedding: [0.1, 0.2, 0.3],
        metadata: {
          language: 'typescript',
          lineStart: 1,
          lineEnd: 1,
        },
      };

      expect(input.embedding).toHaveLength(3);
    });
  });

  // ==================== KnowledgeDocType ====================

  describe('KnowledgeDocType', () => {
    it('should accept all valid doc types', () => {
      const types: KnowledgeDocType[] = ['wiki', 'api_doc', 'design_doc', 'runbook'];
      expect(types.length).toBe(4);
    });
  });

  // ==================== KnowledgeMetadata ====================

  describe('KnowledgeMetadata', () => {
    it('should accept empty metadata (all optional)', () => {
      const metadata: KnowledgeMetadata = {};
      expect(metadata.author).toBeUndefined();
      expect(metadata.tags).toBeUndefined();
    });

    it('should accept full metadata', () => {
      const metadata: KnowledgeMetadata = {
        author: 'team-lead',
        version: '2.0',
        tags: ['architecture', 'microservices'],
        project: 'orion',
        category: 'design',
        lastUpdated: new Date(),
      };
      expect(metadata.tags).toHaveLength(2);
      expect(metadata.version).toBe('2.0');
    });
  });

  // ==================== KnowledgeEmbedding ====================

  describe('KnowledgeEmbedding', () => {
    it('should accept valid knowledge embedding', () => {
      const embedding: KnowledgeEmbedding = {
        id: 'know-001',
        docId: 'doc-001',
        docType: 'design_doc',
        title: 'Architecture Design',
        content: 'This document describes...',
        embedding: new Array(1536).fill(0.2),
        metadata: {
          author: 'architect',
          tags: ['architecture'],
        },
        createdAt: new Date(),
      };

      expect(embedding.docType).toBe('design_doc');
      expect(embedding.embedding.length).toBe(1536);
    });
  });

  // ==================== KnowledgeEmbeddingInput ====================

  describe('KnowledgeEmbeddingInput', () => {
    it('should accept input without optional fields', () => {
      const input: KnowledgeEmbeddingInput = {
        docId: 'doc-001',
        docType: 'wiki',
        title: 'Getting Started',
        content: 'Welcome to...',
      };

      expect(input.embedding).toBeUndefined();
      expect(input.metadata).toBeUndefined();
    });

    it('should accept input with all optional fields', () => {
      const input: KnowledgeEmbeddingInput = {
        docId: 'doc-002',
        docType: 'api_doc',
        title: 'API Reference',
        content: 'REST API documentation',
        embedding: [0.1, 0.2],
        metadata: {
          author: 'api-team',
          version: '1.0',
        },
      };

      expect(input.embedding).toHaveLength(2);
      expect(input.metadata?.author).toBe('api-team');
    });
  });

  // ==================== SemanticSearchRequest ====================

  describe('SemanticSearchRequest', () => {
    it('should accept request with minimal options', () => {
      const request: SemanticSearchRequest = {
        query: 'how to optimize pipeline',
        options: {},
      };

      expect(request.query).toBe('how to optimize pipeline');
      expect(request.options.limit).toBeUndefined();
    });

    it('should accept request with full options', () => {
      const request: SemanticSearchRequest = {
        query: 'error handling patterns',
        options: {
          projectId: 'proj-001',
          chunkType: ['function', 'class'],
          docType: ['design_doc', 'api_doc'],
          limit: 20,
          threshold: 0.8,
          hybridSearch: true,
          keywordBoost: 0.5,
          searchType: 'all',
        },
      };

      expect(request.options.chunkType).toHaveLength(2);
      expect(request.options.threshold).toBe(0.8);
      expect(request.options.hybridSearch).toBe(true);
      expect(request.options.keywordBoost).toBe(0.5);
    });
  });

  // ==================== CodeSearchMatch ====================

  describe('CodeSearchMatch', () => {
    it('should accept valid code search match', () => {
      const match: CodeSearchMatch = {
        id: 'match-001',
        content: 'function optimize() { ... }',
        similarity: 0.92,
        source: {
          filePath: 'src/optimizer.ts',
          chunkType: 'function',
          chunkName: 'optimize',
          projectId: 'proj-001',
          metadata: {
            language: 'typescript',
            lineStart: 10,
            lineEnd: 25,
          },
        },
      };

      expect(match.similarity).toBeGreaterThan(0);
      expect(match.similarity).toBeLessThanOrEqual(1);
      expect(match.source.chunkType).toBe('function');
    });
  });

  // ==================== KnowledgeSearchMatch ====================

  describe('KnowledgeSearchMatch', () => {
    it('should accept valid knowledge search match', () => {
      const match: KnowledgeSearchMatch = {
        id: 'kmatch-001',
        content: 'The architecture follows...',
        similarity: 0.85,
        source: {
          docId: 'doc-001',
          docType: 'design_doc',
          title: 'System Architecture',
          metadata: {
            author: 'architect',
          },
        },
      };

      expect(match.similarity).toBeGreaterThan(0);
      expect(match.source.docType).toBe('design_doc');
    });
  });

  // ==================== SemanticSearchResult ====================

  describe('SemanticSearchResult', () => {
    it('should accept result with code matches only', () => {
      const result: SemanticSearchResult = {
        codeMatches: [],
        metadata: {
          queryEmbeddingTime: 50,
          searchTime: 120,
          totalMatches: 0,
        },
      };

      expect(result.knowledgeMatches).toBeUndefined();
      expect(result.metadata.totalMatches).toBe(0);
    });

    it('should accept result with both match types', () => {
      const result: SemanticSearchResult = {
        codeMatches: [{
          id: 'c1',
          content: 'code',
          similarity: 0.9,
          source: {
            filePath: 'src/index.ts',
            chunkType: 'file',
            chunkName: 'index',
            projectId: 'p1',
            metadata: { language: 'ts', lineStart: 1, lineEnd: 10 },
          },
        }],
        knowledgeMatches: [{
          id: 'k1',
          content: 'knowledge',
          similarity: 0.8,
          source: {
            docId: 'd1',
            docType: 'wiki',
            title: 'Wiki',
            metadata: {},
          },
        }],
        metadata: {
          queryEmbeddingTime: 30,
          searchTime: 80,
          totalMatches: 2,
          hybridKeywordMatches: 1,
        },
      };

      expect(result.codeMatches).toHaveLength(1);
      expect(result.knowledgeMatches).toHaveLength(1);
      expect(result.metadata.hybridKeywordMatches).toBe(1);
    });
  });

  // ==================== BatchEmbedRequest ====================

  describe('BatchEmbedRequest', () => {
    it('should accept code batch request', () => {
      const request: BatchEmbedRequest = {
        items: [{
          projectId: 'proj-001',
          filePath: 'src/index.ts',
          chunkType: 'file',
          chunkName: 'index',
          content: 'export {}',
          metadata: { language: 'typescript', lineStart: 1, lineEnd: 1 },
        }],
        type: 'code',
        batchSize: 10,
        skipExisting: true,
      };

      expect(request.type).toBe('code');
      expect(request.items).toHaveLength(1);
      expect(request.batchSize).toBe(10);
    });

    it('should accept knowledge batch request', () => {
      const request: BatchEmbedRequest = {
        items: [{
          docId: 'doc-001',
          docType: 'wiki',
          title: 'Guide',
          content: 'Content here',
        }],
        type: 'knowledge',
      };

      expect(request.type).toBe('knowledge');
      expect(request.batchSize).toBeUndefined();
      expect(request.skipExisting).toBeUndefined();
    });
  });

  // ==================== BatchEmbedResult ====================

  describe('BatchEmbedResult', () => {
    it('should accept successful result', () => {
      const result: BatchEmbedResult = {
        success: true,
        processed: 10,
        skipped: 2,
        failed: 0,
        embeddingTime: 1500,
      };

      expect(result.success).toBe(true);
      expect(result.processed + result.skipped + result.failed).toBe(12);
    });

    it('should accept result with errors', () => {
      const result: BatchEmbedResult = {
        success: false,
        processed: 5,
        skipped: 1,
        failed: 4,
        errors: [
          { index: 2, error: 'API rate limit exceeded' },
          { index: 5, error: 'Invalid content format' },
          { index: 7, error: 'Timeout' },
          { index: 9, error: 'Authentication failed' },
        ],
        embeddingTime: 3000,
      };

      expect(result.errors).toHaveLength(4);
      expect(result.failed).toBe(4);
    });
  });

  // ==================== EmbeddingStatus ====================

  describe('EmbeddingStatus', () => {
    it('should accept valid embedding status', () => {
      const status: EmbeddingStatus = {
        codeEmbeddings: {
          total: 1000,
          byProject: { 'proj-001': 500, 'proj-002': 500 },
          byChunkType: {
            function: 400,
            class: 200,
            file: 300,
            snippet: 100,
          },
          lastUpdated: new Date(),
        },
        knowledgeEmbeddings: {
          total: 200,
          byDocType: {
            wiki: 100,
            api_doc: 50,
            design_doc: 30,
            runbook: 20,
          },
          lastUpdated: new Date(),
        },
        vectorDocuments: {
          total: 1200,
          byCollection: { code: 1000, knowledge: 200 },
        },
        embeddingProvider: 'openai',
        dimension: 1536,
      };

      expect(status.dimension).toBe(1536);
      expect(status.codeEmbeddings.byChunkType.function).toBe(400);
      expect(status.knowledgeEmbeddings.byDocType.wiki).toBe(100);
    });

    it('should accept status with null dates', () => {
      const status: EmbeddingStatus = {
        codeEmbeddings: {
          total: 0,
          byProject: {},
          byChunkType: { function: 0, class: 0, file: 0, snippet: 0 },
          lastUpdated: null,
        },
        knowledgeEmbeddings: {
          total: 0,
          byDocType: { wiki: 0, api_doc: 0, design_doc: 0, runbook: 0 },
          lastUpdated: null,
        },
        vectorDocuments: {
          total: 0,
          byCollection: {},
        },
        embeddingProvider: 'hash',
        dimension: 1536,
      };

      expect(status.codeEmbeddings.lastUpdated).toBeNull();
      expect(status.knowledgeEmbeddings.lastUpdated).toBeNull();
    });
  });

  // ==================== ChunkingConfig ====================

  describe('ChunkingConfig', () => {
    it('should accept valid chunking config', () => {
      const config: ChunkingConfig = {
        maxChunkSize: 500,
        minChunkSize: 50,
        overlapSize: 50,
        splitBy: 'function',
        language: 'typescript',
      };

      expect(config.maxChunkSize).toBeGreaterThan(config.minChunkSize);
      expect(config.overlapSize).toBeLessThan(config.maxChunkSize);
    });

    it('should accept config without optional language', () => {
      const config: ChunkingConfig = {
        maxChunkSize: 1000,
        minChunkSize: 100,
        overlapSize: 100,
        splitBy: 'paragraph',
      };

      expect(config.language).toBeUndefined();
    });
  });

  // ==================== ChunkedCode ====================

  describe('ChunkedCode', () => {
    it('should accept valid chunked code', () => {
      const chunked: ChunkedCode = {
        chunks: [
          {
            type: 'function',
            name: 'processData',
            content: 'function processData() { ... }',
            metadata: {
              language: 'typescript',
              lineStart: 10,
              lineEnd: 30,
              complexity: 8,
            },
          },
          {
            type: 'class',
            name: 'DataProcessor',
            content: 'class DataProcessor { ... }',
            metadata: {
              language: 'typescript',
              lineStart: 32,
              lineEnd: 100,
            },
          },
        ],
        metadata: {
          filePath: 'src/processor.ts',
          language: 'typescript',
          totalChunks: 2,
          totalLines: 100,
        },
      };

      expect(chunked.chunks).toHaveLength(2);
      expect(chunked.metadata.totalChunks).toBe(chunked.chunks.length);
    });
  });

  // ==================== EmbeddingCacheEntry ====================

  describe('EmbeddingCacheEntry', () => {
    it('should accept valid cache entry', () => {
      const entry: EmbeddingCacheEntry = {
        contentHash: 'sha256-abcdef1234567890',
        embedding: new Array(1536).fill(0.1),
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      };

      expect(entry.contentHash).toBeDefined();
      expect(entry.embedding.length).toBe(1536);
      expect(entry.expiresAt.getTime()).toBeGreaterThan(entry.createdAt.getTime());
    });
  });

  // ==================== EmbeddingCacheConfig ====================

  describe('EmbeddingCacheConfig', () => {
    it('should accept valid cache config', () => {
      const config: EmbeddingCacheConfig = {
        enabled: true,
        ttlDays: 30,
        maxSize: 10000,
      };

      expect(config.enabled).toBe(true);
      expect(config.ttlDays).toBeGreaterThan(0);
      expect(config.maxSize).toBeGreaterThan(0);
    });

    it('should accept disabled cache config', () => {
      const config: EmbeddingCacheConfig = {
        enabled: false,
        ttlDays: 0,
        maxSize: 0,
      };

      expect(config.enabled).toBe(false);
    });
  });

  // ==================== Cross-type compatibility ====================

  describe('cross-type compatibility', () => {
    it('should allow CodeEmbeddingInput to be used in BatchEmbedRequest', () => {
      const input: CodeEmbeddingInput = {
        projectId: 'proj-001',
        filePath: 'src/test.ts',
        chunkType: 'function',
        chunkName: 'test',
        content: 'function test() {}',
        metadata: { language: 'typescript', lineStart: 1, lineEnd: 1 },
      };

      const batch: BatchEmbedRequest = {
        items: [input],
        type: 'code',
      };

      expect(batch.items).toHaveLength(1);
      expect(batch.type).toBe('code');
    });

    it('should allow KnowledgeEmbeddingInput to be used in BatchEmbedRequest', () => {
      const input: KnowledgeEmbeddingInput = {
        docId: 'doc-001',
        docType: 'wiki',
        title: 'Test',
        content: 'Content',
      };

      const batch: BatchEmbedRequest = {
        items: [input],
        type: 'knowledge',
      };

      expect(batch.items).toHaveLength(1);
      expect(batch.type).toBe('knowledge');
    });

    it('should allow mixed inputs in BatchEmbedRequest items array', () => {
      const codeInput: CodeEmbeddingInput = {
        projectId: 'p1',
        filePath: 'src/a.ts',
        chunkType: 'file',
        chunkName: 'a',
        content: '...',
        metadata: { language: 'ts', lineStart: 1, lineEnd: 1 },
      };

      const knowledgeInput: KnowledgeEmbeddingInput = {
        docId: 'd1',
        docType: 'wiki',
        title: 'Wiki',
        content: '...',
      };

      // TypeScript allows union type arrays
      const batch: BatchEmbedRequest = {
        items: [codeInput, knowledgeInput],
        type: 'code',
      };

      expect(batch.items).toHaveLength(2);
    });
  });
});
