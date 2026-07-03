/**
 * User Status Management API Routes
 *
 * Provides endpoints for managing user employment status (active/suspended/terminated).
 * When a user's status changes to non-active, all tokens are revoked and SSO bindings removed.
 *
 * Routes:
 *   PATCH  /api/v1/users/:id/status          - Change user status
 *   POST   /api/v1/users/batch-disable       - Batch disable users by department/role
 *   GET    /api/v1/users/:id/sessions        - Get active session count
 *   GET    /api/v1/users/:id/status-history  - Get status change audit trail
 *
 * Requires:
 *   - authenticateUser middleware
 *   - requirePermission({ resource: 'user', action: 'manage' })
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { TokenBlacklistService } from '../services/auth/TokenBlacklistService';
import { UserStatusService, UserStatus } from '../services/user/UserStatusService';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { createLogger } from '../utils/logger';
import { OrionError, ValidationError, ErrorCode, handleError } from '../errors';

const logger = pino({ name: 'user-status-routes' });

interface UserStatusRoutesOptions {
  database?: DatabasePool;
  tokenBlacklist?: TokenBlacklistService;
}

export default async function userStatusRoutes(
  app: FastifyInstance,
  options: UserStatusRoutesOptions
): Promise<void> {
  if (!options.database || !options.tokenBlacklist) {
    logger.warn('[UserStatusRoutes] Database or TokenBlacklist not available');
    return;
  }

  const userStatusService = new UserStatusService(options.database, options.tokenBlacklist);

  /**
   * PATCH /api/v1/users/:id/status - Change user status
   */
  app.patch(
    '/users/:id/status',
    { onRequest: [authenticateUser, requirePermission({ resource: 'user', action: 'manage' })] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const body = request.body as { status: UserStatus; reason?: string };
        const { status, reason } = body;

        const validStatuses: UserStatus[] = ['active', 'suspended', 'terminated', 'deleted'];
        if (!validStatuses.includes(status)) {
          return handleError(reply, new ValidationError('INVALID_STATUS'))
        }

        // Get operator ID from authenticated user
        const operatorId = (request as any).user?.userId || 'system';

        const result = await userStatusService.changeUserStatus(id, status, reason || '', operatorId);

        return reply.send({ success: true, data: result });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'STATUS_CHANGE_ERROR';
        return handleError(reply, new ValidationError('STATUS_CHANGE_ERROR'));
      }
    }
  );

  /**
   * POST /api/v1/users/batch-disable - Batch disable users
   */
  app.post(
    '/users/batch-disable',
    { onRequest: [authenticateUser, requirePermission({ resource: 'user', action: 'manage' })] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = request.body as {
          department?: string;
          role?: string;
          reason?: string;
        };

        if (!body.department && !body.role) {
          return handleError(reply, new ValidationError('MISSING_FILTER'))
        }

        const operatorId = (request as any).user?.userId || 'system';

        const result = await userStatusService.batchDisable({
          department: body.department,
          role: body.role,
          reason: body.reason || 'Batch disable',
          operatorId,
        });

        return reply.send({
          success: true,
          data: {
            disabledCount: result.disabledCount,
            results: result.results.map((r) => ({
              userId: r.userId,
              oldStatus: r.oldStatus,
              newStatus: r.newStatus,
              revokedTokens: r.revokedTokens,
            })),
          },
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'BATCH_DISABLE_ERROR';
        return handleError(reply, new ValidationError('BATCH_DISABLE_ERROR'));
      }
    }
  );

  /**
   * GET /api/v1/users/:id/sessions - Get active session count
   */
  app.get(
    '/users/:id/sessions',
    { onRequest: [authenticateUser, requirePermission({ resource: 'user', action: 'read' })] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const count = await userStatusService.getActiveSessionCount(id);
        return reply.send({ success: true, data: { userId: id, activeSessions: count } });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'SESSION_COUNT_ERROR';
        return handleError(reply, new OrionError('SESSION_COUNT_ERROR', ErrorCode.INTERNAL_ERROR));
      }
    }
  );

  /**
   * GET /api/v1/users/:id/status-history - Get status change audit trail
   */
  app.get(
    '/users/:id/status-history',
    { onRequest: [authenticateUser, requirePermission({ resource: 'user', action: 'read' })] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };

        const result = await options.database!.query(
          `SELECT id, user_id, old_status, new_status, reason, operator_id, changed_at
           FROM user_status_history
           WHERE user_id = $1
           ORDER BY changed_at DESC`,
          [id]
        );

        return reply.send({ success: true, data: result.rows });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'HISTORY_ERROR';
        return handleError(reply, new OrionError('HISTORY_ERROR', ErrorCode.INTERNAL_ERROR));
      }
    }
  );
}
