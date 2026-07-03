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
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { createLogger } from '../utils/logger';

const logger = pino({ name: 'environment-routes' });

export interface EnvironmentRoutesOptions {
  database?: DatabasePool;
}

export default async function environmentRoutes(
  app: FastifyInstance,
  options: EnvironmentRoutesOptions
): Promise<void> {
  if (!options.database) {
    logger.warn('[EnvironmentRoutes] No database, skipping routes'); return;
  }
  // Initialize repository with PostgreSQL connection
  const envRepo = new EnvironmentRepository(options.database);

  // Initialize service
  const envService = new EnvironmentService(envRepo);

  // Initialize controller
  const envController = new EnvironmentController(envService);

  // ==================== Environment CRUD ====================

  // POST /environments - Create environment
  app.post('/environments', {
    onRequest: [authenticateUser, requirePermission({ resource: 'environment', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return envController.create(request, reply);
  });

  // GET /environments - List environments
  app.get('/environments', {
    onRequest: [authenticateUser, requirePermission({ resource: 'environment', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return envController.list(request, reply);
  });

  // GET /environments/:id - Get environment detail
  app.get('/environments/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'environment', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return envController.getById(request, reply);
  });

  // PUT /environments/:id - Update environment
  app.put('/environments/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'environment', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return envController.update(request, reply);
  });

  // DELETE /environments/:id - Delete environment
  app.delete('/environments/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'environment', action: 'delete' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return envController.delete(request, reply);
  });

  // POST /environments/:id/status - Update environment status
  app.post(
    '/environments/:id/status',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'environment', action: 'write' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      return envController.updateStatus(request, reply);
    }
  );

  // POST /environments/:id/lock - Lock an environment
  app.post(
    '/environments/:id/lock',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'environment', action: 'manage' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      return envController.lockEnvironment(request, reply);
    }
  );

  // POST /environments/:id/unlock - Unlock an environment
  app.post(
    '/environments/:id/unlock',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'environment', action: 'manage' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      return envController.unlockEnvironment(request, reply);
    }
  );

  // GET /environments/:id/lock-status - Check lock status
  app.get(
    '/environments/:id/lock-status',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'environment', action: 'read' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      return envController.getLockStatus(request, reply);
    }
  );

  // GET /environments/:id/deployment-allowed - Check if deployment is allowed
  app.get(
    '/environments/:id/deployment-allowed',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'environment', action: 'read' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      return envController.checkDeploymentAllowed(request, reply);
    }
  );
}
