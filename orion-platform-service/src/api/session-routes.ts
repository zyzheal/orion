/**
 * Session Management API Routes
 *
 * Routes under /api/v1/sessions
 * Migrated to PostgreSQL Repository pattern
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { DatabasePool } from '../services/database';
import { SessionRepository } from '../services/session/SessionRepository';
import { SessionService } from '../services/session/SessionService';
import { SessionController } from './controllers/SessionController';
import { createLogger } from '../utils/logger';

const logger = createLogger('session-routes');

interface SessionRoutesOptions {
  database?: DatabasePool;
}

export default async function sessionRoutes(
  app: FastifyInstance,
  options: SessionRoutesOptions
): Promise<void> {
  // Initialize Repository and Service with database pool
  const repository = options.database
    ? new SessionRepository(options.database)
    : undefined;

  if (!repository) {
    logger.warn('[SessionRoutes] No database pool provided, session routes will not be functional');
    return;
  }

  const service = new SessionService(repository);
  const controller = new SessionController(service);

  // ==================== Session Lifecycle ====================

  // POST /api/v1/sessions — Create a new session (login)
  app.post('/', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.create(request, reply);
  });

  // POST /api/v1/sessions/verify — Verify a session token
  app.post('/verify', {
    onRequest: [authenticateUser, requirePermission({ resource: 'session', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.verify(request, reply);
  });

  // DELETE /api/v1/sessions/:token — Revoke a session (logout)
  app.delete('/:token', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.revoke(request, reply);
  });

  // POST /api/v1/sessions/cleanup — Clean up expired sessions (admin)
  app.post('/cleanup', {
    onRequest: [
      authenticateUser,
      requirePermission({ resource: 'session', action: 'manage' }),
    ],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.cleanup(request, reply);
  });

  // GET /api/v1/sessions/user/:userId — list user sessions
  app.get('/user/:userId', {
    onRequest: [authenticateUser, requirePermission({ resource: 'session', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listByUser(request, reply);
  });

  // POST /api/v1/sessions/:token/refresh — refresh session token
  app.post('/:token/refresh', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.refreshToken(request, reply);
  });
}
