/**
 * Fastify Type Augmentations
 *
 * Extends Fastify's request type to include authenticated user information.
 * This allows `request.user` to be properly typed after auth middleware runs.
 */

import { FastifyRequest } from 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    /**
     * Authenticated user information, set by authMiddleware after JWT verification.
     * Contains userId, username, role, and tenantId extracted from the JWT token payload.
     */
    user?: {
      userId: string;
      username: string;
      role: string;
      tenantId?: number;
    };
  }
}
