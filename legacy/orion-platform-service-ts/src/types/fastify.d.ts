/**
 * Fastify Type Augmentations
 *
 * Extends Fastify's request type to include authenticated user information.
 * This allows `request.user` to be properly typed after auth middleware runs.
 * Also adds EventEmitter methods to FastifyInstance for event broadcasting.
 */

import { FastifyRequest, FastifyInstance } from 'fastify';
import { EventEmitter } from 'events';

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

  // Augment FastifyInstance to include EventEmitter methods
  interface FastifyInstance {
    emit(event: string, ...args: any[]): boolean;
    on(event: string, listener: (...args: any[]) => void): FastifyInstance;
    removeListener(event: string, listener: (...args: any[]) => void): FastifyInstance;
  }
}
