/**
 * Auth middleware - authenticate user requests
 */

import { FastifyRequest, FastifyReply } from 'fastify';

export interface AuthenticatedUser {
  userId: string;
  username: string;
  role: string;
  tenantId?: number;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthenticatedUser;
  }
}

export async function authenticateUser(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  // Simple auth stub: extract user from headers
  const userId = request.headers['x-user-id'] as string;
  if (userId) {
    request.user = {
      userId,
      username: userId,
      role: (request.headers['x-user-role'] as string) || 'user',
      tenantId: request.headers['x-tenant-id'] ? Number(request.headers['x-tenant-id']) : undefined,
    };
  }
}
