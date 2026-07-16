/**
 * Vector Routes - API endpoints for vector embeddings and semantic search
 *
 * Prefix: /api/v1/vector
 *
 * Endpoints:
 * - POST /embed-code        - Embed code chunks
 * - POST /search-code       - Search similar code
 * - POST /similar-code      - Find similar code by snippet
 * - POST /embed-doc         - Embed documents
 * - POST /search-doc        - Search documents
 * - POST /batch-embed       - Batch embedding
 * - GET  /status            - Embedding status
 */

import { FastifyInstance } from 'fastify';
import { VectorController, VectorRoutesOptions } from './controllers/VectorController';

export async function vectorRoutes(
  fastify: FastifyInstance,
  options: VectorRoutesOptions
): Promise<void> {
  const controller = new VectorController(options);

  // ==================== Code Embedding ====================

  /**
   * POST /api/v1/vector/embed-code
   * Embed a single code chunk or entire file
   */
  fastify.post('/embed-code', async (request, reply) => {
    return controller.embedCode(request as any, reply);
  });

  /**
   * POST /api/v1/vector/search-code
   * Search for similar code
   */
  fastify.post('/search-code', async (request, reply) => {
    return controller.searchCode(request as any, reply);
  });

  /**
   * POST /api/v1/vector/similar-code
   * Find similar code by code snippet
   */
  fastify.post('/similar-code', async (request, reply) => {
    return controller.findSimilarCode(request as any, reply);
  });

  // ==================== Knowledge Embedding ====================

  /**
   * POST /api/v1/vector/embed-doc
   * Embed a document
   */
  fastify.post('/embed-doc', async (request, reply) => {
    return controller.embedDoc(request as any, reply);
  });

  /**
   * POST /api/v1/vector/search-doc
   * Search for documents
   */
  fastify.post('/search-doc', async (request, reply) => {
    return controller.searchDoc(request as any, reply);
  });

  // ==================== Batch Operations ====================

  /**
   * POST /api/v1/vector/batch-embed
   * Batch embed multiple items
   */
  fastify.post('/batch-embed', async (request, reply) => {
    return controller.batchEmbed(request as any, reply);
  });

  // ==================== Status ====================

  /**
   * GET /api/v1/vector/status
   * Get embedding status and statistics
   */
  fastify.get('/status', async (request, reply) => {
    return controller.getStatus(request as any, reply);
  });
}