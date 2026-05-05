/**
 * Developer Portal API Routes
 *
 * Routes under /api/v1/developer-portal
 * PostgreSQL-backed PortalDocument management.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { PortalDocumentRepository } from '../repositories/PortalDocumentRepository';
import { PortalDocumentService } from '../services/developer-portal/PortalDocumentService';
import { PortalDocumentController } from './controllers/PortalDocumentController';

interface DeveloperPortalRoutesOptions {
  database?: DatabasePool;
}

export default async function developerPortalRoutes(
  app: FastifyInstance,
  options: DeveloperPortalRoutesOptions
): Promise<void> {
  const repository = options.database
    ? new PortalDocumentRepository(options.database)
    : undefined;

  if (!repository) {
    console.warn('[DeveloperPortalRoutes] No database pool provided, developer portal routes will not be functional');
    return;
  }

  const service = new PortalDocumentService(repository);
  const controller = new PortalDocumentController(service);

  // ==================== Document CRUD ====================

  // POST /api/v1/developer-portal/documents — create document
  app.post('/documents', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.create(request, reply);
  });

  // GET /api/v1/developer-portal/documents — list documents
  app.get('/documents', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.list(request, reply);
  });

  // GET /api/v1/developer-portal/documents/search — search documents
  app.get('/documents/search', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.search(request, reply);
  });

  // GET /api/v1/developer-portal/documents/:id — document detail
  app.get('/documents/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getById(request, reply);
  });

  // PUT /api/v1/developer-portal/documents/:id — update document
  app.put('/documents/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.update(request, reply);
  });

  // DELETE /api/v1/developer-portal/documents/:id — delete document
  app.delete('/documents/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.delete(request, reply);
  });

  // ==================== Publishing ====================

  // POST /api/v1/developer-portal/documents/:id/publish — publish document
  app.post('/documents/:id/publish', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.publish(request, reply);
  });

  // POST /api/v1/developer-portal/documents/:id/unpublish — unpublish document
  app.post('/documents/:id/unpublish', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.unpublish(request, reply);
  });

  // ==================== Categories ====================

  // GET /api/v1/developer-portal/categories — get categories
  app.get('/categories', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getCategories(request, reply);
  });

  // ==================== Popular Documents ====================

  // GET /api/v1/developer-portal/popular — popular documents
  app.get('/popular', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getPopular(request, reply);
  });

  // ==================== Helpful Feedback ====================

  // POST /api/v1/developer-portal/documents/:id/helpful — record helpful feedback
  app.post('/documents/:id/helpful', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.recordHelpful(request, reply);
  });
}
