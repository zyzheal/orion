/**
 * User Token API Routes
 *
 * Routes under /api/v1/users/:id/tokens
 * Manages API tokens for users
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { UserTokenService, UserToken } from '../services/user/UserTokenService';
import { authenticateUser } from '../middleware/authMiddleware';
import { OrionError, NotFoundError, UnauthorizedError, ForbiddenError, ServiceUnavailableError, ErrorCode, handleError } from '../errors';

interface UserTokenRoutesOptions {
  database?: DatabasePool;
}

export default async function userTokenRoutes(
  app: FastifyInstance,
  options: UserTokenRoutesOptions
): Promise<void> {
  // Initialize UserTokenService with database pool
  let service: UserTokenService | null = null;
  if (options.database) {
    service = new UserTokenService(options.database);
  }

  const unavailableHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    return handleError(reply, new ServiceUnavailableError('SERVICE_UNAVAILABLE'))
  };

  // Middleware to verify user can only access their own tokens
  const verifyTokenOwnership = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    // @ts-ignore - Fastify types for request.user
    const currentUserId = request.user?.id;
    const { id } = request.params as { id: string };

    if (!currentUserId) {
      return handleError(reply, new UnauthorizedError('UNAUTHORIZED'))
    }

    // Users can only access their own tokens (unless admin)
    // @ts-ignore - Fastify types for request.user
    const isAdmin = request.user?.role === 'admin' || request.user?.role === 'superadmin';
    if (currentUserId !== id && !isAdmin) {
      return handleError(reply, new ForbiddenError('FORBIDDEN'))
    }
  };

  // GET /api/v1/users/:id/tokens — Get user's tokens
  app.get('/:id/tokens', {
    onRequest: [authenticateUser, verifyTokenOwnership],
    schema: {
      tags: ['user-token'],
      summary: 'Get user API tokens',
      description: 'Returns a list of API tokens for a user (excluding the raw token)',
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
                  userId: { type: 'string' },
                  name: { type: 'string' },
                  tokenHash: { type: 'string' },
                  expiresAt: { type: 'string', nullable: true },
                  lastUsedAt: { type: 'string', nullable: true },
                  createdAt: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!service) return unavailableHandler(request, reply);

    const { id } = request.params as { id: string };

    try {
      const tokens = await service.getTokens(id);
      return reply.send({
        success: true,
        data: tokens,
      });
    } catch (error: any) {
      request.log.error(error, 'Failed to get user tokens');
      return handleError(reply, new OrionError('GET_TOKENS_FAILED', ErrorCode.INTERNAL_ERROR))
    }
  });

  // POST /api/v1/users/:id/tokens — Create a new token
  app.post('/:id/tokens', {
    onRequest: [authenticateUser, verifyTokenOwnership],
    schema: {
      tags: ['user-token'],
      summary: 'Create user API token',
      description: 'Creates a new API token for a user. The raw token is returned only once.',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', description: 'User ID' },
        },
      },
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', description: 'Token name/description' },
          expiresInDays: { type: 'number', description: 'Token expiration in days (optional)' },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                token: { type: 'string', description: 'The raw token (only returned once)' },
              },
            },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!service) return unavailableHandler(request, reply);

    const { id } = request.params as { id: string };
    const body = request.body as { name: string; expiresInDays?: number };

    try {
      const result = await service.createToken({
        userId: id,
        name: body.name,
        expiresInDays: body.expiresInDays,
      });

      return reply.status(201).send({
        success: true,
        data: {
          token: result.token, // Only returned once on creation
        },
      });
    } catch (error: any) {
      request.log.error(error, 'Failed to create user token');
      return handleError(reply, new OrionError('CREATE_TOKEN_FAILED', ErrorCode.INTERNAL_ERROR))
    }
  });

  // DELETE /api/v1/users/:id/tokens/:tokenId — Delete a token
  app.delete('/:id/tokens/:tokenId', {
    onRequest: [authenticateUser, verifyTokenOwnership],
    schema: {
      tags: ['user-token'],
      summary: 'Delete user API token',
      description: 'Deletes an API token for a user',
      params: {
        type: 'object',
        required: ['id', 'tokenId'],
        properties: {
          id: { type: 'string', description: 'User ID' },
          tokenId: { type: 'string', description: 'Token ID' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
          },
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!service) return unavailableHandler(request, reply);

    const { id, tokenId } = request.params as { id: string; tokenId: string };

    try {
      const deleted = await service.deleteToken(id, tokenId);

      if (!deleted) {
        return handleError(reply, new NotFoundError('TOKEN_NOT_FOUND'))
      }

      return reply.send({
        success: true,
      });
    } catch (error: any) {
      request.log.error(error, 'Failed to delete user token');
      return handleError(reply, new OrionError('DELETE_TOKEN_FAILED', ErrorCode.INTERNAL_ERROR))
    }
  });
}