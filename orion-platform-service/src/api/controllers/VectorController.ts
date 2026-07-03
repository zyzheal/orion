/**
 * VectorController - API endpoints for vector operations
 *
 * Endpoints:
 * - POST /api/v1/vector/embed-code - Embed code chunks
 * - POST /api/v1/vector/search-code - Search similar code
 * - POST /api/v1/vector/embed-doc - Embed documents
 * - POST /api/v1/vector/search-doc - Search documents
 * - POST /api/v1/vector/batch-embed - Batch embedding
 * - GET /api/v1/vector/status - Embedding status
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { createLogger } from '../utils/logger';
import { CodeEmbeddingService } from '../../services/ai/CodeEmbeddingService';
import { SemanticSearchService } from '../../services/ai/SemanticSearchService';
import { CodeEmbeddingRepository } from '../../repositories/CodeEmbeddingRepository';
import { KnowledgeEmbeddingRepository } from '../../repositories/KnowledgeEmbeddingRepository';
import {
  CodeEmbeddingInput,
  KnowledgeEmbeddingInput,
  SemanticSearchRequest,
  BatchEmbedRequest,
  EmbeddingStatus,
} from '../../services/ai/vector-types';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface VectorRoutesOptions {
  database?: {
    query: (
      text: string,
      params?: unknown[]
    ) => Promise<{ rows: any[]; rowCount: number | null }>;
  };
  embeddingProvider?: {
    type: 'openai' | 'voyage' | 'claude' | 'hash';
    apiKey?: string;
    model?: string;
    baseUrl?: string;
  };
}

export class VectorController {
  private codeEmbeddingService?: CodeEmbeddingService;
  private semanticSearchService?: SemanticSearchService;
  private codeRepository?: CodeEmbeddingRepository;
  private knowledgeRepository?: KnowledgeEmbeddingRepository;
  private embeddingProvider: VectorRoutesOptions['embeddingProvider'];

  constructor(options: VectorRoutesOptions) {
    this.embeddingProvider = options.embeddingProvider || { type: 'hash' };

    if (options.database) {
      this.codeRepository = new CodeEmbeddingRepository(options.database);
      this.knowledgeRepository = new KnowledgeEmbeddingRepository(options.database);

      const providerConfig = {
        type: this.embeddingProvider.type,
        apiKey: this.embeddingProvider.apiKey || process.env.OPENAI_API_KEY,
        model: this.embeddingProvider.model,
        baseUrl: this.embeddingProvider.baseUrl,
      };

      this.codeEmbeddingService = new CodeEmbeddingService(
        this.codeRepository,
        providerConfig
      );

      this.semanticSearchService = new SemanticSearchService(
        this.codeRepository,
        this.knowledgeRepository,
        this.codeEmbeddingService
      );

      logger.info(
        { provider: providerConfig.type, hasApiKey: !!providerConfig.apiKey },
        'VectorController initialized with database'
      );
    } else {
      logger.warn('VectorController initialized without database - limited functionality');
    }
  }

  // ==================== Code Embedding ====================

  /**
   * POST /api/v1/vector/embed-code
   * Embed a single code chunk or entire file
   */
  async embedCode(
    request: FastifyRequest<{
      Body: {
        projectId: string;
        filePath: string;
        content?: string; // Optional if chunking a file
        language?: string;
        chunkType?: 'function' | 'class' | 'file' | 'snippet';
        chunkName?: string;
        metadata?: any;
        // Or for file-level embedding
        fileContent?: string;
        chunkingConfig?: any;
      };
    }>,
    reply: FastifyReply
  ): Promise<void> {
    if (!this.codeEmbeddingService) {
      reply.code(503).send({ error: 'Vector service unavailable (no database)' });
      return;
    }

    try {
      const body = request.body;

      // File-level embedding
      if (body.fileContent) {
        const language = body.language || this.detectLanguage(body.filePath);
        const result = await this.codeEmbeddingService.embedFile(
          body.projectId,
          body.filePath,
          body.fileContent,
          language,
          body.chunkingConfig
        );

        reply.code(200).send({
          success: result.success,
          processed: result.processed,
          skipped: result.skipped,
          failed: result.failed,
          embeddingTime: result.embeddingTime,
        });
        return;
      }

      // Single chunk embedding
      if (!body.content) {
        reply.code(400).send({ error: 'Missing content or fileContent' });
        return;
      }

      const input: CodeEmbeddingInput = {
        projectId: body.projectId,
        filePath: body.filePath,
        chunkType: body.chunkType || 'snippet',
        chunkName: body.chunkName || body.filePath,
        content: body.content,
        metadata: body.metadata || {
          language: body.language || this.detectLanguage(body.filePath),
          lineStart: 0,
          lineEnd: 0,
        },
      };

      const embedding = await this.codeEmbeddingService.generateEmbedding(input.content);
      const result = await this.codeRepository!.insert({ ...input, embedding });

      reply.code(200).send({
        success: true,
        id: result.id,
        chunkType: result.chunkType,
        embeddingDimensions: embedding.length,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMsg }, 'embedCode failed');
      reply.code(500).send({ error: errorMsg });
    }
  }

  // ==================== Code Search ====================

  /**
   * POST /api/v1/vector/search-code
   * Search for similar code
   */
  async searchCode(
    request: FastifyRequest<{
      Body: SemanticSearchRequest;
    }>,
    reply: FastifyReply
  ): Promise<void> {
    if (!this.semanticSearchService) {
      reply.code(503).send({ error: 'Vector service unavailable (no database)' });
      return;
    }

    try {
      const body = request.body;

      // Force searchType to 'code'
      body.options.searchType = 'code';

      const result = await this.semanticSearchService.search(body);

      reply.code(200).send({
        matches: result.codeMatches || [],
        metadata: result.metadata,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMsg }, 'searchCode failed');
      reply.code(500).send({ error: errorMsg });
    }
  }

  /**
   * POST /api/v1/vector/similar-code
   * Find similar code by code snippet
   */
  async findSimilarCode(
    request: FastifyRequest<{
      Body: {
        codeSnippet: string;
        projectId?: string;
        limit?: number;
      };
    }>,
    reply: FastifyReply
  ): Promise<void> {
    if (!this.semanticSearchService) {
      reply.code(503).send({ error: 'Vector service unavailable (no database)' });
      return;
    }

    try {
      const { codeSnippet, projectId, limit = 10 } = request.body;

      const matches = await this.semanticSearchService.findSimilarCode(
        codeSnippet,
        projectId,
        limit
      );

      reply.code(200).send({ matches });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMsg }, 'findSimilarCode failed');
      reply.code(500).send({ error: errorMsg });
    }
  }

  // ==================== Knowledge Embedding ====================

  /**
   * POST /api/v1/vector/embed-doc
   * Embed a document
   */
  async embedDoc(
    request: FastifyRequest<{
      Body: {
        docId: string;
        docType: 'wiki' | 'api_doc' | 'design_doc' | 'runbook';
        title: string;
        content: string;
        metadata?: any;
      };
    }>,
    reply: FastifyReply
  ): Promise<void> {
    if (!this.codeEmbeddingService || !this.knowledgeRepository) {
      reply.code(503).send({ error: 'Vector service unavailable (no database)' });
      return;
    }

    try {
      const body = request.body;

      const input: KnowledgeEmbeddingInput = {
        docId: body.docId,
        docType: body.docType,
        title: body.title,
        content: body.content,
        metadata: body.metadata,
      };

      const embedding = await this.codeEmbeddingService.generateEmbedding(input.content);
      const result = await this.knowledgeRepository.insert({ ...input, embedding });

      reply.code(200).send({
        success: true,
        id: result.id,
        docType: result.docType,
        embeddingDimensions: embedding.length,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMsg }, 'embedDoc failed');
      reply.code(500).send({ error: errorMsg });
    }
  }

  // ==================== Document Search ====================

  /**
   * POST /api/v1/vector/search-doc
   * Search for documents
   */
  async searchDoc(
    request: FastifyRequest<{
      Body: SemanticSearchRequest;
    }>,
    reply: FastifyReply
  ): Promise<void> {
    if (!this.semanticSearchService) {
      reply.code(503).send({ error: 'Vector service unavailable (no database)' });
      return;
    }

    try {
      const body = request.body;

      // Force searchType to 'knowledge'
      body.options.searchType = 'knowledge';

      const result = await this.semanticSearchService.search(body);

      reply.code(200).send({
        matches: result.knowledgeMatches || [],
        metadata: result.metadata,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMsg }, 'searchDoc failed');
      reply.code(500).send({ error: errorMsg });
    }
  }

  // ==================== Batch Operations ====================

  /**
   * POST /api/v1/vector/batch-embed
   * Batch embed multiple items
   */
  async batchEmbed(
    request: FastifyRequest<{
      Body: BatchEmbedRequest;
    }>,
    reply: FastifyReply
  ): Promise<void> {
    if (!this.codeEmbeddingService) {
      reply.code(503).send({ error: 'Vector service unavailable (no database)' });
      return;
    }

    try {
      const body = request.body as BatchEmbedRequest;
      const batchSize = body.batchSize || 20;
      const skipExisting = body.skipExisting ?? true;

      if (body.type === 'code') {
        const inputs = body.items as CodeEmbeddingInput[];
        const result = await this.codeEmbeddingService.batchEmbed(
          inputs,
          batchSize,
          skipExisting
        );

        reply.code(200).send(result);
      } else if (body.type === 'knowledge') {
        // Knowledge embedding batch
        const inputs = body.items as KnowledgeEmbeddingInput[];
        const startTime = Date.now();
        const errors: Array<{ index: number; error: string }> = [];
        let processed = 0;
        const skipped = 0;

        for (let i = 0; i < inputs.length; i++) {
          try {
            const input = inputs[i];
            const embedding = await this.codeEmbeddingService.generateEmbedding(
              input.content
            );

            await this.knowledgeRepository!.insert({ ...input, embedding });
            processed++;
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            errors.push({ index: i, error: errorMsg });
          }
        }

        reply.code(200).send({
          success: errors.length === 0,
          processed,
          skipped,
          failed: errors.length,
          errors: errors.length > 0 ? errors : undefined,
          embeddingTime: Date.now() - startTime,
        });
      } else {
        reply.code(400).send({ error: 'Invalid type: must be "code" or "knowledge"' });
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMsg }, 'batchEmbed failed');
      reply.code(500).send({ error: errorMsg });
    }
  }

  // ==================== Status ====================

  /**
   * GET /api/v1/vector/status
   * Get embedding status and statistics
   */
  async getStatus(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    if (!this.codeRepository || !this.knowledgeRepository) {
      reply.code(503).send({ error: 'Vector service unavailable (no database)' });
      return;
    }

    try {
      const codeTotal = await this.codeRepository.count();
      const knowledgeTotal = await this.knowledgeRepository.count();

      // Get counts by type
      const codeByFunction = await this.codeRepository.count({ chunkType: 'function' });
      const codeByClass = await this.codeRepository.count({ chunkType: 'class' });
      const codeByFile = await this.codeRepository.count({ chunkType: 'file' });
      const codeBySnippet = await this.codeRepository.count({ chunkType: 'snippet' });

      const status: EmbeddingStatus = {
        codeEmbeddings: {
          total: codeTotal,
          byProject: {}, // Would need aggregation query
          byChunkType: {
            function: codeByFunction,
            class: codeByClass,
            file: codeByFile,
            snippet: codeBySnippet,
          },
          lastUpdated: null,
        },
        knowledgeEmbeddings: {
          total: knowledgeTotal,
          byDocType: {
            wiki: await this.knowledgeRepository.count({ docType: 'wiki' }),
            api_doc: await this.knowledgeRepository.count({ docType: 'api_doc' }),
            design_doc: await this.knowledgeRepository.count({ docType: 'design_doc' }),
            runbook: await this.knowledgeRepository.count({ docType: 'runbook' }),
          },
          lastUpdated: null,
        },
        vectorDocuments: {
          total: 0, // Would need separate query
          byCollection: {},
        },
        embeddingProvider: this.embeddingProvider!.type,
        dimension: 1536,
      };

      reply.code(200).send(status);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMsg }, 'getStatus failed');
      reply.code(500).send({ error: errorMsg });
    }
  }

  // ==================== Helpers ====================

  /**
   * Detect programming language from file path
   */
  private detectLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const langMap: Record<string, string> = {
      ts: 'typescript',
      tsx: 'typescript',
      js: 'javascript',
      jsx: 'javascript',
      py: 'python',
      go: 'go',
      java: 'java',
      kt: 'kotlin',
      rs: 'rust',
      rb: 'ruby',
      php: 'php',
      c: 'c',
      cpp: 'cpp',
      cs: 'csharp',
      swift: 'swift',
      scala: 'scala',
    };

    return langMap[ext || ''] || 'unknown';
  }
}