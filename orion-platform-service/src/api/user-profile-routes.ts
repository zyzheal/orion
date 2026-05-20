/**
 * User Profile API Routes
 *
 * Routes under /api/v1/users/:id/profile
 * Provides user profile management with ownership verification
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { UserRepository } from '../services/user/UserRepository';
import { UserProfileService, UpdateProfileInput } from '../services/user/UserProfileService';
import { authenticateUser } from '../middleware/authMiddleware';

interface UserProfileRoutesOptions {
  database?: DatabasePool;
}

interface ProfileParams {
  id: string;
}

interface UpdateProfileBody {
  username?: string;
  email?: string;
  avatar?: string;
  phone?: string;
  name?: string;
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

export default async function userProfileRoutes(
  app: FastifyInstance,
  options: UserProfileRoutesOptions
): Promise<void> {
  // Initialize Repository and Service with database pool
  const repository = options.database
    ? new UserRepository(options.database)
    : undefined;

  if (!repository) {
    console.warn('[UserProfileRoutes] No database pool provided, profile routes will not be functional');
    return;
  }

  const profileService = new UserProfileService(repository);

  // ==================== GET /:id/profile - Get User Profile ====================
  app.get('/:id/profile', {
    onRequest: [authenticateUser],
    schema: {
      tags: ['user-profile'],
      summary: 'Get user profile',
      description: 'Returns user profile information. Users can only view their own profile.',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', description: 'User ID' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                username: { type: 'string' },
                email: { type: 'string' },
                role: { type: 'string' },
                avatar: { type: 'string' },
                phone: { type: 'string' },
                status: { type: 'string' },
                createdAt: { type: 'string' },
                teams: { type: 'array' },
                permissions: { type: 'array' },
              },
            },
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
  }, async (request: FastifyRequest<{ Params: ProfileParams }>, reply: FastifyReply) => {
    const { id } = request.params;

    // Verify ownership
    if (!verifyOwnership(request, reply, id)) {
      return;
    }

    try {
      const profile = await profileService.getProfile(id);

      if (!profile) {
        return reply.status(404).send({
          success: false,
          error: 'User not found',
        });
      }

      return reply.send({
        success: true,
        data: profile,
      });
    } catch (error) {
      console.error('[UserProfileRoutes] Error getting profile:', error);
      return reply.status(500).send({
        success: false,
        error: 'Internal server error',
      });
    }
  });

  // ==================== PUT /:id/profile - Update User Profile ====================
  app.put('/:id/profile', {
    onRequest: [authenticateUser],
    schema: {
      tags: ['user-profile'],
      summary: 'Update user profile',
      description: 'Updates user profile information. Users can only update their own profile.',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', description: 'User ID' },
        },
      },
      body: {
        type: 'object',
        properties: {
          username: { type: 'string', description: 'Username' },
          email: { type: 'string', format: 'email', description: 'Email address' },
          avatar: { type: 'string', description: 'Avatar URL' },
          phone: { type: 'string', description: 'Phone number' },
          name: { type: 'string', description: 'Display name' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' },
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
  }, async (request: FastifyRequest<{ Params: ProfileParams; Body: UpdateProfileBody }>, reply: FastifyReply) => {
    const { id } = request.params;
    const body = request.body;

    // Verify ownership
    if (!verifyOwnership(request, reply, id)) {
      return;
    }

    try {
      const updateInput: Partial<UpdateProfileInput> = {};

      if (body.username !== undefined) {
        updateInput.username = body.username;
      }

      if (body.email !== undefined) {
        updateInput.email = body.email;
      }

      if (body.avatar !== undefined) {
        updateInput.avatar = body.avatar;
      }

      if (body.name !== undefined) {
        updateInput.name = body.name;
      }

      const profile = await profileService.updateProfile(id, updateInput);

      if (!profile) {
        return reply.status(404).send({
          success: false,
          error: 'User not found',
        });
      }

      return reply.send({
        success: true,
        data: profile,
      });
    } catch (error) {
      console.error('[UserProfileRoutes] Error updating profile:', error);
      return reply.status(500).send({
        success: false,
        error: 'Internal server error',
      });
    }
  });

  // ==================== GET /:id/teams - Get User Teams ====================
  app.get('/:id/teams', {
    onRequest: [authenticateUser],
    schema: {
      tags: ['user-profile'],
      summary: 'Get user teams',
      description: 'Returns teams that the user belongs to. Users can only view their own teams.',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', description: 'User ID' },
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
                  name: { type: 'string' },
                  role: { type: 'string' },
                },
              },
            },
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
  }, async (request: FastifyRequest<{ Params: ProfileParams }>, reply: FastifyReply) => {
    const { id } = request.params;

    // Verify ownership
    if (!verifyOwnership(request, reply, id)) {
      return;
    }

    try {
      const teams = await profileService.getUserTeams(id);

      return reply.send({
        success: true,
        data: teams,
      });
    } catch (error) {
      console.error('[UserProfileRoutes] Error getting user teams:', error);
      return reply.status(500).send({
        success: false,
        error: 'Internal server error',
      });
    }
  });

  // ==================== GET /:id/permissions - Get User Permissions ====================
  app.get('/:id/permissions', {
    onRequest: [authenticateUser],
    schema: {
      tags: ['user-profile'],
      summary: 'Get user permissions',
      description: 'Returns permissions that the user has. Users can only view their own permissions.',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', description: 'User ID' },
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
                  resource: { type: 'string' },
                  actions: { type: 'array', items: { type: 'string' } },
                },
              },
            },
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
  }, async (request: FastifyRequest<{ Params: ProfileParams }>, reply: FastifyReply) => {
    const { id } = request.params;

    // Verify ownership
    if (!verifyOwnership(request, reply, id)) {
      return;
    }

    try {
      const permissions = await profileService.getUserPermissions(id);

      return reply.send({
        success: true,
        data: permissions,
      });
    } catch (error) {
      console.error('[UserProfileRoutes] Error getting user permissions:', error);
      return reply.status(500).send({
        success: false,
        error: 'Internal server error',
      });
    }
  });
}