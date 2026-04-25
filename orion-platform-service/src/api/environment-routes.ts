/**
 * Environment Management API Routes
 *
 * Provides endpoints for environment CRUD operations.
 * Environments define deployment targets (dev, staging, prod, etc.) for projects.
 *
 * Prefix: /api/v1/environments
 *
 * Routes:
 * - POST   /environments          - Create environment
 * - GET    /environments          - List environments (optional ?projectId= filter)
 * - GET    /environments/:id      - Get environment detail
 * - PUT    /environments/:id      - Update environment
 * - DELETE /environments/:id      - Delete environment
 * - POST   /environments/:id/status - Update environment status
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { EnvironmentRepository } from '../services/environment/EnvironmentRepository';
import { EnvironmentService } from '../services/environment/EnvironmentService';
import { EnvironmentController } from './controllers/EnvironmentController';
import { DatabasePool } from '../services/database';

export interface EnvironmentRoutesOptions {
  database?: DatabasePool;
}

export default async function environmentRoutes(
  app: FastifyInstance,
  options: EnvironmentRoutesOptions
): Promise<void> {
  // Initialize repository with PostgreSQL connection (falls back to in-memory if not provided)
  const envRepo = new EnvironmentRepository(options.database);

  // Initialize service
  const envService = new EnvironmentService(envRepo);

  // Initialize controller
  const envController = new EnvironmentController(envService);

  // ==================== Environment CRUD ====================

  // POST /environments - Create environment
  app.post('/environments', async (request: FastifyRequest, reply: FastifyReply) => {
    return envController.create(request, reply);
  });

  // GET /environments - List environments
  app.get('/environments', async (request: FastifyRequest, reply: FastifyReply) => {
    return envController.list(request, reply);
  });

  // GET /environments/:id - Get environment detail
  app.get('/environments/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return envController.getById(request, reply);
  });

  // PUT /environments/:id - Update environment
  app.put('/environments/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return envController.update(request, reply);
  });

  // DELETE /environments/:id - Delete environment
  app.delete('/environments/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return envController.delete(request, reply);
  });

  // POST /environments/:id/status - Update environment status
  app.post(
    '/environments/:id/status',
    async (request: FastifyRequest, reply: FastifyReply) => {
      return envController.updateStatus(request, reply);
    }
  );
}
