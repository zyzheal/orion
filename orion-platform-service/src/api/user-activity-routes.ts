/**
 * User Activity API Routes
 *
 * Routes under /api/v1/users/:id/activities
 * Provides user activity log management with ownership verification
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { UserActivityService, UserActivity } from '../services/user/UserActivityService';
import { authenticateUser } from '../middleware/authMiddleware';

interface UserActivityRoutesOptions {
  database?: DatabasePool;
}

interface ActivityParams {
  id: string;
}

interface ActivityQuery {
  page?: number;
  pageSize?: number;
}

/**
 * 验证用户只能访问自己的资源
 */
function verifyOwnership(request: FastifyRequest, reply: FastifyReply, targetUserId: string): boolean {
  const currentUserId = (request as any).user?.id;

  if (!currentUserId) {
    reply.status(401).send({ success: false, error: 'Unauthorized' });
    return false;
  }

  if (currentUserId !== targetUserId) {
    reply.status(403).send({ success: false, error: 'Forbidden' });
    return false;
  }

  return true;
}

export default async function userActivityRoutes(
  app: FastifyInstance,
  options: UserActivityRoutesOptions
): Promise<void> {
  // Initialize Service with database pool
  const activityService = options.database
    ? new UserActivityService(options.database)
    : undefined;

  if (!activityService) {
    console.warn('[UserActivityRoutes] No database pool provided, activity routes will not be functional');
    return;
  }

  // ==================== GET /:id/activities - Get User Activities ====================
  app.get('/:id/activities', {
    onRequest: [authenticateUser],
    schema: {
      tags: ['user-activity'],
      summary: 'Get user activity logs',
      description: 'Returns paginated user activity logs. Users can only view their own activities.',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', description: 'User ID' },
        },
      },
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1, description: 'Page number' },
          pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20, description: 'Items per page' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  userId: { type: 'string' },
                  action: { type: 'string' },
                  resourceType: { type: 'string' },
                  resourceId: { type: 'string' },
                  details: { type: 'object' },
                  ipAddress: { type: 'string' },
                  userAgent: { type: 'string' },
                  createdAt: { type: 'string' },
                },
              },
            },
            total: { type: 'integer' },
            page: { type: 'integer' },
            pageSize: { type: 'integer' },
          },
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' },
          },
        },
        403: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const {  id  } = request.params as any;
    const {  page = 1, pageSize = 20  } = request.query as any;

    // Verify ownership
    if (!verifyOwnership(request, reply, id)) {
      return reply;
    }

    // Validate pagination params
    const validPage = Math.max(1, page);
    const validPageSize = Math.min(100, Math.max(1, pageSize));
    const offset = (validPage - 1) * validPageSize;

    try {
      // Get activities with pagination
      const activities = await activityService.getActivities(id, validPageSize, offset);

      // Get total count
      const total = await activityService.getActivityCount(id);

      return reply.send({
        success: true,
        data: activities,
        total,
        page: validPage,
        pageSize: validPageSize,
      });
    } catch (error) {
      console.error('[UserActivityRoutes] Error getting activities:', error);
      return reply.status(500).send({
        success: false,
        error: 'Internal server error',
      });
    }
  });
}