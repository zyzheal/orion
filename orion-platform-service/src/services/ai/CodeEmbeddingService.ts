/**
 * CodeEmbeddingService - Code chunking and embedding generation
 *
 * Features:
 * - Syntax-aware code chunking (function/class/file/snippet)
 * - Embedding generation via OpenAI/Voyage/Claude API
 * - Incremental embedding updates (content hash-based)
 * - Embedding cache for deduplication
 * - Batch processing with rate limiting
 */

import pino from 'pino';
import { CodeEmbeddingRepository } from '../../repositories/CodeEmbeddingRepository';
import {
  CodeEmbedding,
  CodeEmbeddingInput,
  CodeChunkType,
  CodeChunkMetadata,
  ChunkingConfig,
  ChunkedCode,
  BatchEmbedResult,
  EmbeddingCacheConfig,
  EmbeddingCacheEntry,
} from './vector-types';
import { OrionError, ErrorCode } from '../../errors';
import { getCurrentTraceId } from '../../db/tenant-context-storage';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export type EmbeddingProviderType = 'openai' | 'voyage' | 'claude' | 'hash';

export interface EmbeddingProviderConfig {
  type: EmbeddingProviderType;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}

export class CodeEmbeddingService {
  private repository: CodeEmbeddingRepository;
  private providerConfig: EmbeddingProviderConfig;
  private cacheConfig: EmbeddingCacheConfig;
  private embeddingCache: Map<string, EmbeddingCacheEntry> = new Map();

  // Default chunking config
  private defaultChunkingConfig: ChunkingConfig = {
    maxChunkSize: 500,
    minChunkSize: 50,
    overlapSize: 50,
    splitBy: 'function',
  };

  constructor(
    repository: CodeEmbeddingRepository,
    providerConfig: EmbeddingProviderConfig,
    cacheConfig?: EmbeddingCacheConfig
  ) {
    this.repository = repository;
    this.providerConfig = providerConfig;
    this.cacheConfig = cacheConfig || {
      enabled: true,
      ttlDays: 30,
      maxSize: 10000,
    };

    logger.info(
      { provider: providerConfig.type, cacheEnabled: this.cacheConfig.enabled },
      'CodeEmbeddingService initialized'
    );
  }

  // ==================== Code Chunking ====================

  /**
   * Chunk code file into semantic units
   */
  chunkCode(
    content: string,
    filePath: string,
    language: string,
    config?: Partial<ChunkingConfig>
  ): ChunkedCode {
    const finalConfig = { ...this.defaultChunkingConfig, ...config };
    const chunks: Array<{
      type: CodeChunkType;
      name: string;
      content: string;
      metadata: CodeChunkMetadata;
    }> = [];

    const lines = content.split('\n');
    const totalLines = lines.length;

    // Simple syntax-aware chunking (can be enhanced with proper parsers)
    if (finalConfig.splitBy === 'function' || finalConfig.splitBy === 'class') {
      chunks.push(...this.extractCodeBlocks(lines, filePath, language, finalConfig));
    } else {
      // File-level or paragraph chunking
      chunks.push(...this.chunkBySize(content, filePath, language, finalConfig));
    }

    logger.info(
      { filePath, totalChunks: chunks.length, totalLines, language },
      'Code chunked successfully'
    );

    return {
      chunks,
      metadata: {
        filePath,
        language,
        totalChunks: chunks.length,
        totalLines,
      },
    };
  }

  /**
   * Extract function/class blocks (simplified - real implementation would use AST parser)
   */
  private extractCodeBlocks(
    lines: string[],
    filePath: string,
    language: string,
    config: ChunkingConfig
  ): Array<{
    type: CodeChunkType;
    name: string;
    content: string;
    metadata: CodeChunkMetadata;
  }> {
    const blocks: Array<{
      type: CodeChunkType;
      name: string;
      content: string;
      metadata: CodeChunkMetadata;
    }> = [];

    let currentBlock: {
      type: CodeChunkType;
      name: string;
      lines: string[];
      lineStart: number;
    } | null = null;

    // Language-specific patterns for detecting function/class definitions
    const patterns = this.getLanguagePatterns(language);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Check for function/class definition
      const blockMatch = this.matchBlockDefinition(trimmed, patterns);

      if (blockMatch) {
        // Save previous block if exists
        if (currentBlock && currentBlock.lines.length >= config.minChunkSize) {
          blocks.push(this.finalizeBlock(currentBlock, filePath, language));
        }

        // Start new block
        currentBlock = {
          type: blockMatch.type,
          name: blockMatch.name,
          lines: [line],
          lineStart: i + 1,
        };
      } else if (currentBlock) {
        // Continue current block
        currentBlock.lines.push(line);

        // Check if block has ended (next definition or empty lines)
        if (
          currentBlock.lines.length >= config.maxChunkSize ||
          (trimmed === '' && currentBlock.lines.length >= config.minChunkSize)
        ) {
          blocks.push(this.finalizeBlock(currentBlock, filePath, language));
          currentBlock = null;
        }
      }
    }

    // Save final block
    if (currentBlock && currentBlock.lines.length >= config.minChunkSize) {
      blocks.push(this.finalizeBlock(currentBlock, filePath, language));
    }

    // If no blocks found, chunk by size
    if (blocks.length === 0) {
      return this.chunkBySize(lines.join('\n'), filePath, language, config);
    }

    return blocks;
  }

  /**
   * Chunk by character size (fallback for unstructured code)
   */
  private chunkBySize(
    content: string,
    filePath: string,
    language: string,
    config: ChunkingConfig
  ): Array<{
    type: CodeChunkType;
    name: string;
    content: string;
    metadata: CodeChunkMetadata;
  }> {
    const chunks: Array<{
      type: CodeChunkType;
      name: string;
      content: string;
      metadata: CodeChunkMetadata;
    }> = [];

    const lines = content.split('\n');
    let currentChunk: string[] = [];
    let lineStart = 1;

    for (let i = 0; i < lines.length; i++) {
      currentChunk.push(lines[i]);

      const currentLength = currentChunk.join('\n').length;

      if (currentLength >= config.maxChunkSize) {
        const chunkContent = currentChunk.join('\n');
        chunks.push({
          type: 'snippet',
          name: `${filePath}:${lineStart}-${i + 1}`,
          content: chunkContent,
          metadata: {
            language,
            lineStart,
            lineEnd: i + 1,
          },
        });

        // Keep overlap
        const overlapLines = currentChunk.slice(-config.overlapSize);
        currentChunk = overlapLines;
        lineStart = i + 1 - overlapLines.length + 1;
      }
    }

    // Final chunk
    if (currentChunk.length > 0 && currentChunk.join('\n').length >= config.minChunkSize) {
      chunks.push({
        type: 'snippet',
        name: `${filePath}:${lineStart}-${lines.length}`,
        content: currentChunk.join('\n'),
        metadata: {
          language,
          lineStart,
          lineEnd: lines.length,
        },
      });
    }

    return chunks;
  }

  // ==================== Embedding Generation ====================

  /**
   * Generate embedding for a single text
   */
  async generateEmbedding(text: string): Promise<number[]> {
    // Check cache first
    const contentHash = this.hashContent(text);
    if (this.cacheConfig.enabled) {
      const cached = this.embeddingCache.get(contentHash);
      if (cached && cached.expiresAt > new Date()) {
        logger.debug({ contentHash }, 'Using cached embedding');
        return cached.embedding;
      }
    }

    // Generate embedding via provider
    const embedding = await this.callEmbeddingProvider(text);

    // Cache result
    if (this.cacheConfig.enabled) {
      this.addToCache(contentHash, embedding);
    }

    return embedding;
  }

  /**
   * Call external embedding provider API
   */
  private async callEmbeddingProvider(text: string): Promise<number[]> {
    switch (this.providerConfig.type) {
      case 'openai':
        return this.callOpenAI(text);
      case 'voyage':
        return this.callVoyage(text);
      case 'claude':
        return this.callClaude(text);
      case 'hash':
        return this.hashEmbedding(text);
      default:
        throw new OrionError(`Unknown embedding provider: ${this.providerConfig.type}`, 'NOT_FOUND')
    }
  }

  /**
   * OpenAI embedding API
   */
  private async callOpenAI(text: string): Promise<number[]> {
    if (!this.providerConfig.apiKey) {
      throw new OrionError('OpenAI API key not configured', ErrorCode.SERVICE_UNAVAILABLE);
    }

    const model = this.providerConfig.model || 'text-embedding-ada-002';
    const baseUrl = this.providerConfig.baseUrl || 'https://api.openai.com/v1';

    const response = await fetch(`${baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.providerConfig.apiKey}`,
      },
      body: JSON.stringify({ model, input: text }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new OrionError(`OpenAI embedding API error (${response.status}): ${error}`, 'OPERATION_FAILED')
    }

    const data = (await response.json()) as { data?: Array<{ embedding: number[] }> };
    return data.data?.[0]?.embedding ?? [];
  }

  /**
   * Voyage AI embedding API
   */
  private async callVoyage(text: string): Promise<number[]> {
    if (!this.providerConfig.apiKey) {
      throw new OrionError('Voyage API key not configured', ErrorCode.SERVICE_UNAVAILABLE);
    }

    const model = this.providerConfig.model || 'voyage-2';
    const baseUrl = this.providerConfig.baseUrl || 'https://api.voyageai.com/v1';

    const response = await fetch(`${baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.providerConfig.apiKey}`,
      },
      body: JSON.stringify({ input: text, model }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new OrionError(`Voyage embedding API error (${response.status}): ${error}`, 'OPERATION_FAILED')
    }

    const data = (await response.json()) as { data?: Array<{ embedding: number[] }> };
    return data.data?.[0]?.embedding ?? [];
  }

  /**
   * Claude embedding via Anthropic API (future support)
   */
  private async callClaude(text: string): Promise<number[]> {
    // Claude doesn't have dedicated embedding API yet, use hash fallback
    logger.warn({ traceId: getCurrentTraceId() }, 'Claude embedding not yet available, using hash fallback');
    return this.hashEmbedding(text);
  }

  /**
   * Hash-based embedding (fallback, not semantic)
   */
  private hashEmbedding(text: string): number[] {
    const dimension = 1536; // OpenAI compatible dimension
    const hash = this.simpleHash(text);
    const embedding: number[] = [];

    for (let i = 0; i < dimension; i++) {
      embedding.push((hash[i % hash.length] / 255) * 2 - 1);
    }

    return embedding;
  }

  // ==================== Batch Embedding ====================

  /**
   * Batch embed code chunks
   */
  async batchEmbed(
    inputs: CodeEmbeddingInput[],
    batchSize: number = 20,
    skipExisting: boolean = true
  ): Promise<BatchEmbedResult> {
    const startTime = Date.now();
    const errors: Array<{ index: number; error: string }> = [];
    let processed = 0;
    let skipped = 0;

    for (let i = 0; i < inputs.length; i += batchSize) {
      const batch = inputs.slice(i, i + batchSize);

      for (let j = 0; j < batch.length; j++) {
        const input = batch[j];
        const globalIndex = i + j;

        try {
          // Check if already embedded (by content hash)
          if (skipExisting) {
            const existing = await this.findExistingEmbedding(
              input.projectId,
              input.filePath,
              input.content
            );
            if (existing) {
              skipped++;
              continue;
            }
          }

          // Generate embedding
          const embedding = await this.generateEmbedding(input.content);

          // Store in repository
          await this.repository.insert({
            ...input,
            embedding,
          });

          processed++;
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          errors.push({ index: globalIndex, error: errorMsg });
          logger.error(
            { index: globalIndex, filePath: input.filePath, error: errorMsg },
            'Batch embedding failed'
          );
        }
      }

      // Rate limiting delay between batches
      if (this.providerConfig.type !== 'hash') {
        await this.delay(100);
      }
    }

    const embeddingTime = Date.now() - startTime;

    logger.info(
      { processed, skipped, failed: errors.length, embeddingTime },
      'Batch embedding completed'
    );

    return {
      success: errors.length === 0,
      processed,
      skipped,
      failed: errors.length,
      errors: errors.length > 0 ? errors : undefined,
      embeddingTime,
    };
  }

  /**
   * Embed entire file
   */
  async embedFile(
    projectId: string,
    filePath: string,
    content: string,
    language: string,
    chunkingConfig?: Partial<ChunkingConfig>
  ): Promise<BatchEmbedResult> {
    // Chunk the file
    const chunked = this.chunkCode(content, filePath, language, chunkingConfig);

    // Convert to inputs
    const inputs: CodeEmbeddingInput[] = chunked.chunks.map((chunk) => ({
      projectId,
      filePath,
      chunkType: chunk.type,
      chunkName: chunk.name,
      content: chunk.content,
      metadata: chunk.metadata,
    }));

    // Batch embed
    return this.batchEmbed(inputs, 20, true);
  }

  /**
   * Update embeddings for changed file (incremental)
   */
  async updateFileEmbeddings(
    projectId: string,
    filePath: string,
    newContent: string,
    language: string
  ): Promise<BatchEmbedResult> {
    // Delete old embeddings for this file
    const deletedCount = await this.repository.deleteByFilePath(projectId, filePath);
    logger.info({ projectId, filePath, deletedCount }, 'Old embeddings deleted');

    // Embed new content
    return this.embedFile(projectId, filePath, newContent, language);
  }

  // ==================== Helpers ====================

  private getLanguagePatterns(language: string): {
    functionPattern: RegExp;
    classPattern: RegExp;
  } {
    const patterns: Record<
      string,
      { functionPattern: RegExp; classPattern: RegExp }
    > = {
      typescript: {
        functionPattern:
          /^(export\s+)?(async\s+)?function\s+(\w+)\s*\(|^(export\s+)?const\s+(\w+)\s*=\s*(async\s+)?\([^)]*\)\s*=>/,
        classPattern: /^(export\s+)?class\s+(\w+)/,
      },
      javascript: {
        functionPattern:
          /^(export\s+)?(async\s+)?function\s+(\w+)\s*\(|^(export\s+)?const\s+(\w+)\s*=\s*(async\s+)?\([^)]*\)\s*=>/,
        classPattern: /^(export\s+)?class\s+(\w+)/,
      },
      python: {
        functionPattern: /^def\s+(\w+)\s*\(|^async\s+def\s+(\w+)\s*\(/,
        classPattern: /^class\s+(\w+)/,
      },
      go: {
        functionPattern: /^func\s+(\w+)\s*\(/,
        classPattern: /^type\s+(\w+)\s+struct/,
      },
      java: {
        functionPattern:
          /^(public|private|protected)?\s*(static\s+)?(\w+)\s+(\w+)\s*\(/,
        classPattern: /^(public|private|protected)?\s*class\s+(\w+)/,
      },
    };

    return patterns[language] || patterns.javascript;
  }

  private matchBlockDefinition(
    line: string,
    patterns: { functionPattern: RegExp; classPattern: RegExp }
  ): { type: CodeChunkType; name: string } | null {
    const funcMatch = line.match(patterns.functionPattern);
    if (funcMatch) {
      const name = funcMatch[3] || funcMatch[5] || 'anonymous';
      return { type: 'function', name };
    }

    const classMatch = line.match(patterns.classPattern);
    if (classMatch) {
      const name = classMatch[2] || classMatch[1] || 'anonymous';
      return { type: 'class', name };
    }

    return null;
  }

  private finalizeBlock(
    block: { type: CodeChunkType; name: string; lines: string[]; lineStart: number },
    filePath: string,
    language: string
  ): {
    type: CodeChunkType;
    name: string;
    content: string;
    metadata: CodeChunkMetadata;
  } {
    return {
      type: block.type,
      name: block.name,
      content: block.lines.join('\n'),
      metadata: {
        language,
        lineStart: block.lineStart,
        lineEnd: block.lineStart + block.lines.length - 1,
      },
    };
  }

  private async findExistingEmbedding(
    projectId: string,
    filePath: string,
    content: string
  ): Promise<CodeEmbedding | null> {
    // Simple content-based lookup (can be enhanced with content_hash column)
    const existing = await this.repository.findByFilePath(projectId, filePath);
    return existing.find((e) => e.content === content) || null;
  }

  private hashContent(content: string): string {
    // Simple SHA-256-like hash (use crypto.createHash in real implementation)
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  private simpleHash(text: string): number[] {
    const result: number[] = [];
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      result.push(((charCode * 31 + result.reduce((a, b) => a + b, 0)) % 256) + 128);
    }
    while (result.length < 4) result.push(0);
    return result;
  }

  private addToCache(contentHash: string, embedding: number[]): void {
    // Check cache size limit
    if (this.embeddingCache.size >= this.cacheConfig.maxSize) {
      // Remove oldest entries
      const oldestKey = this.embeddingCache.keys().next().value;
      if (oldestKey) {
        this.embeddingCache.delete(oldestKey);
      }
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.cacheConfig.ttlDays);

    this.embeddingCache.set(contentHash, {
      contentHash,
      embedding,
      createdAt: new Date(),
      expiresAt,
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}