/**
 * SemanticSearchService - Unified semantic search for code and knowledge
 *
 * Features:
 * - Code similarity search (find similar functions/classes)
 * - Document semantic search (find relevant documentation)
 * - Cross-project search
 * - Hybrid search (vector + keyword)
 * - Search result ranking and filtering
 */

import pino from 'pino';
import { CodeEmbeddingRepository } from '../../repositories/CodeEmbeddingRepository';
import { KnowledgeEmbeddingRepository } from '../../repositories/KnowledgeEmbeddingRepository';
import {
  SemanticSearchRequest,
  SemanticSearchResult,
  CodeSearchMatch,
  KnowledgeSearchMatch,
  EmbeddingProviderConfig,
} from './vector-types';
import { CodeEmbeddingService } from './CodeEmbeddingService';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export class SemanticSearchService {
  private codeRepository: CodeEmbeddingRepository;
  private knowledgeRepository: KnowledgeEmbeddingRepository;
  private embeddingService: CodeEmbeddingService;

  constructor(
    codeRepository: CodeEmbeddingRepository,
    knowledgeRepository: KnowledgeEmbeddingRepository,
    embeddingService: CodeEmbeddingService
  ) {
    this.codeRepository = codeRepository;
    this.knowledgeRepository = knowledgeRepository;
    this.embeddingService = embeddingService;

    logger.info('SemanticSearchService initialized');
  }

  // ==================== Unified Search ====================

  /**
   * Perform semantic search across code and knowledge
   */
  async search(request: SemanticSearchRequest): Promise<SemanticSearchResult> {
    const startTime = Date.now();
    const options = request.options;

    // Default options
    const searchType = options.searchType || 'all';
    const limit = options.limit || 10;
    const threshold = options.threshold || 0.7;
    const hybridSearch = options.hybridSearch || false;
    const keywordBoost = options.keywordBoost || 0.3;

    // Generate query embedding
    const queryEmbeddingStart = Date.now();
    const queryEmbedding = await this.embeddingService.generateEmbedding(request.query);
    const queryEmbeddingTime = Date.now() - queryEmbeddingStart;

    logger.debug(
      { query: request.query, embeddingTime: queryEmbeddingTime },
      'Query embedding generated'
    );

    const result: SemanticSearchResult = {
      metadata: {
        queryEmbeddingTime,
        searchTime: 0,
        totalMatches: 0,
      },
    };

    // Search code embeddings
    if (searchType === 'code' || searchType === 'all') {
      const codeMatches = await this.searchCode(
        queryEmbedding,
        request.query,
        {
          projectId: options.projectId,
          chunkType: options.chunkType,
          limit,
          threshold,
          hybridSearch,
          keywordBoost,
        }
      );
      result.codeMatches = codeMatches;
      result.metadata.totalMatches += codeMatches.length;
    }

    // Search knowledge embeddings
    if (searchType === 'knowledge' || searchType === 'all') {
      const knowledgeMatches = await this.searchKnowledge(
        queryEmbedding,
        request.query,
        {
          docType: options.docType,
          limit,
          threshold,
          hybridSearch,
          keywordBoost,
        }
      );
      result.knowledgeMatches = knowledgeMatches;
      result.metadata.totalMatches += knowledgeMatches.length;
    }

    result.metadata.searchTime = Date.now() - startTime;
    result.metadata.hybridKeywordMatches = hybridSearch
      ? this.countKeywordMatches(result)
      : undefined;

    logger.info(
      {
        query: request.query,
        searchType,
        totalMatches: result.metadata.totalMatches,
        searchTime: result.metadata.searchTime,
      },
      'Semantic search completed'
    );

    return result;
  }

  // ==================== Code Search ====================

  /**
   * Search code embeddings with optional hybrid search
   */
  private async searchCode(
    queryEmbedding: number[],
    queryText: string,
    options: {
      projectId?: string;
      chunkType?: string[];
      limit: number;
      threshold: number;
      hybridSearch: boolean;
      keywordBoost: number;
    }
  ): Promise<CodeSearchMatch[]> {
    // Vector search
    const vectorResults = await this.codeRepository.search(
      queryEmbedding,
      options.limit * 2, // Get more results for filtering
      {
        projectId: options.projectId,
        chunkType: options.chunkType as any,
      }
    );

    // Filter by threshold
    const filteredResults = vectorResults.filter(
      (r) => r.similarity >= options.threshold
    );

    let matches: CodeSearchMatch[] = filteredResults.map((r) => ({
      id: r.embedding.id,
      content: r.embedding.content,
      similarity: r.similarity,
      source: {
        filePath: r.embedding.filePath,
        chunkType: r.embedding.chunkType,
        chunkName: r.embedding.chunkName,
        projectId: r.embedding.projectId,
        metadata: r.embedding.metadata,
      },
    }));

    // Hybrid search: combine with keyword search
    if (options.hybridSearch) {
      const keywords = this.extractKeywords(queryText);
      const keywordResults = await this.codeRepository.keywordSearch(keywords, {
        projectId: options.projectId,
        chunkType: options.chunkType as any,
      });

      // Combine and re-rank
      matches = this.combineResults(
        matches,
        keywordResults.map((r) => ({
          id: r.id,
          content: r.content,
          similarity: options.keywordBoost,
          source: {
            filePath: r.filePath,
            chunkType: r.chunkType,
            chunkName: r.chunkName,
            projectId: r.projectId,
            metadata: r.metadata,
          },
        })),
        options.keywordBoost
      );
    }

    // Sort by similarity and limit
    matches.sort((a, b) => b.similarity - a.similarity);
    return matches.slice(0, options.limit);
  }

  // ==================== Knowledge Search ====================

  /**
   * Search knowledge embeddings with optional hybrid search
   */
  private async searchKnowledge(
    queryEmbedding: number[],
    queryText: string,
    options: {
      docType?: string[];
      limit: number;
      threshold: number;
      hybridSearch: boolean;
      keywordBoost: number;
    }
  ): Promise<KnowledgeSearchMatch[]> {
    // Vector search
    const vectorResults = await this.knowledgeRepository.search(
      queryEmbedding,
      options.limit * 2,
      {
        docType: options.docType as any,
      }
    );

    // Filter by threshold
    const filteredResults = vectorResults.filter(
      (r) => r.similarity >= options.threshold
    );

    let matches: KnowledgeSearchMatch[] = filteredResults.map((r) => ({
      id: r.embedding.id,
      content: r.embedding.content,
      similarity: r.similarity,
      source: {
        docId: r.embedding.docId,
        docType: r.embedding.docType,
        title: r.embedding.title,
        metadata: r.embedding.metadata,
      },
    }));

    // Hybrid search: combine with keyword search
    if (options.hybridSearch) {
      const keywords = this.extractKeywords(queryText);
      const keywordResults = await this.knowledgeRepository.keywordSearch(keywords, {
        docType: options.docType as any,
      });

      // Combine and re-rank
      matches = this.combineKnowledgeResults(
        matches,
        keywordResults.map((r) => ({
          id: r.id,
          content: r.content,
          similarity: options.keywordBoost,
          source: {
            docId: r.docId,
            docType: r.docType,
            title: r.title,
            metadata: r.metadata,
          },
        })),
        options.keywordBoost
      );
    }

    // Sort by similarity and limit
    matches.sort((a, b) => b.similarity - a.similarity);
    return matches.slice(0, options.limit);
  }

  // ==================== Specialized Searches ====================

  /**
   * Find similar code (by code snippet)
   */
  async findSimilarCode(
    codeSnippet: string,
    projectId?: string,
    limit: number = 10
  ): Promise<CodeSearchMatch[]> {
    const embedding = await this.embeddingService.generateEmbedding(codeSnippet);

    const results = await this.codeRepository.search(embedding, limit, {
      projectId,
    });

    return results.map((r) => ({
      id: r.embedding.id,
      content: r.embedding.content,
      similarity: r.similarity,
      source: {
        filePath: r.embedding.filePath,
        chunkType: r.embedding.chunkType,
        chunkName: r.embedding.chunkName,
        projectId: r.embedding.projectId,
        metadata: r.embedding.metadata,
      },
    }));
  }

  /**
   * Search documentation by query
   */
  async searchDocs(
    query: string,
    docType?: string[],
    limit: number = 10
  ): Promise<KnowledgeSearchMatch[]> {
    const embedding = await this.embeddingService.generateEmbedding(query);

    const results = await this.knowledgeRepository.search(embedding, limit, {
      docType: docType as any,
    });

    return results.map((r) => ({
      id: r.embedding.id,
      content: r.embedding.content,
      similarity: r.similarity,
      source: {
        docId: r.embedding.docId,
        docType: r.embedding.docType,
        title: r.embedding.title,
        metadata: r.embedding.metadata,
      },
    }));
  }

  /**
   * Cross-project code search
   */
  async crossProjectSearch(
    query: string,
    projectIds?: string[],
    limit: number = 20
  ): Promise<CodeSearchMatch[]> {
    const embedding = await this.embeddingService.generateEmbedding(query);

    // Search across all projects (or specified ones)
    const results: CodeSearchMatch[] = [];

    if (projectIds && projectIds.length > 0) {
      for (const projectId of projectIds) {
        const projectResults = await this.codeRepository.search(embedding, limit, {
          projectId,
        });
        results.push(
          ...projectResults.map((r) => ({
            id: r.embedding.id,
            content: r.embedding.content,
            similarity: r.similarity,
            source: {
              filePath: r.embedding.filePath,
              chunkType: r.embedding.chunkType,
              chunkName: r.embedding.chunkName,
              projectId: r.embedding.projectId,
              metadata: r.embedding.metadata,
            },
          }))
        );
      }
    } else {
      // Search all projects
      const allResults = await this.codeRepository.search(embedding, limit * 2);
      results.push(
        ...allResults.map((r) => ({
          id: r.embedding.id,
          content: r.embedding.content,
          similarity: r.similarity,
          source: {
            filePath: r.embedding.filePath,
            chunkType: r.embedding.chunkType,
            chunkName: r.embedding.chunkName,
            projectId: r.embedding.projectId,
            metadata: r.embedding.metadata,
          },
        }))
      );
    }

    // Sort by similarity and limit
    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, limit);
  }

  // ==================== Helpers ====================

  /**
   * Extract keywords from query text (simple tokenization)
   */
  private extractKeywords(text: string): string[] {
    // Remove common stopwords and extract meaningful keywords
    const stopwords = [
      'the',
      'a',
      'an',
      'is',
      'are',
      'was',
      'were',
      'be',
      'been',
      'being',
      'have',
      'has',
      'had',
      'do',
      'does',
      'did',
      'will',
      'would',
      'could',
      'should',
      'may',
      'might',
      'must',
      'shall',
      'can',
      'need',
      'to',
      'of',
      'in',
      'for',
      'on',
      'with',
      'at',
      'by',
      'from',
      'as',
      'into',
      'through',
      'during',
      'before',
      'after',
      'above',
      'below',
      'between',
      'under',
      'again',
      'further',
      'then',
      'once',
      'here',
      'there',
      'when',
      'where',
      'why',
      'how',
      'all',
      'each',
      'few',
      'more',
      'most',
      'other',
      'some',
      'such',
      'no',
      'nor',
      'not',
      'only',
      'own',
      'same',
      'so',
      'than',
      'too',
      'very',
      'just',
      'and',
      'but',
      'if',
      'or',
      'because',
      'until',
      'while',
      'about',
      'against',
      'between',
      'into',
      'through',
      'during',
      'before',
      'after',
      'above',
      'below',
      'to',
      'from',
      'up',
      'down',
      'in',
      'out',
      'on',
      'off',
      'over',
      'under',
      'again',
      'further',
      'then',
      'once',
    ];

    const tokens = text
      .toLowerCase()
      .split(/\s+/)
      .filter((token) => token.length > 2 && !stopwords.includes(token));

    return tokens.slice(0, 10); // Limit to top 10 keywords
  }

  /**
   * Combine vector and keyword results for hybrid search
   */
  private combineResults(
    vectorResults: CodeSearchMatch[],
    keywordResults: CodeSearchMatch[],
    keywordBoost: number
  ): CodeSearchMatch[] {
    const combined = new Map<string, CodeSearchMatch>();

    // Add vector results
    for (const match of vectorResults) {
      combined.set(match.id, match);
    }

    // Boost keyword matches
    for (const kwMatch of keywordResults) {
      const existing = combined.get(kwMatch.id);
      if (existing) {
        // Combine scores: vector similarity + keyword boost
        existing.similarity = Math.min(1, existing.similarity + keywordBoost);
      } else {
        // Add new keyword-only match
        combined.set(kwMatch.id, kwMatch);
      }
    }

    return Array.from(combined.values());
  }

  /**
   * Combine knowledge results for hybrid search
   */
  private combineKnowledgeResults(
    vectorResults: KnowledgeSearchMatch[],
    keywordResults: KnowledgeSearchMatch[],
    keywordBoost: number
  ): KnowledgeSearchMatch[] {
    const combined = new Map<string, KnowledgeSearchMatch>();

    // Add vector results
    for (const match of vectorResults) {
      combined.set(match.id, match);
    }

    // Boost keyword matches
    for (const kwMatch of keywordResults) {
      const existing = combined.get(kwMatch.id);
      if (existing) {
        // Combine scores
        existing.similarity = Math.min(1, existing.similarity + keywordBoost);
      } else {
        // Add new keyword-only match
        combined.set(kwMatch.id, kwMatch);
      }
    }

    return Array.from(combined.values());
  }

  /**
   * Count keyword-only matches in hybrid search
   */
  private countKeywordMatches(result: SemanticSearchResult): number {
    let count = 0;

    if (result.codeMatches) {
      count += result.codeMatches.filter((m) => m.similarity < 0.5).length;
    }

    if (result.knowledgeMatches) {
      count += result.knowledgeMatches.filter((m) => m.similarity < 0.5).length;
    }

    return count;
  }
}