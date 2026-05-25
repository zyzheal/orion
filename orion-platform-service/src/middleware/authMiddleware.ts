/**
 * Authentication Middleware
 *
 * Verifies JWT tokens from the Authorization header and attaches
 * the decoded user information to request.user.
 *
 * Usage:
 *   app.addHook('onRequest', authenticateUser);
 *
 * Or as a per-route hook:
 *   app.get('/protected', { onRequest: [authenticateUser] }, handler);
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { k8sSecretStorage } from '../services/auth/K8sSecretKeyStorage';

/**
 * Authentication hook - verifies JWT and attaches user to request.
 * Returns 401 if no token or invalid token is provided.
 */
export async function authenticateUser(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.code(401).send({
      code: 401,
      error: 'UNAUTHORIZED',
      message: 'Missing or invalid authorization header',
    });
  }

  const token = authHeader.split(' ')[1];
  try {
    // Get current key from K8s Secret storage
    const currentKeyId = process.env.JWT_CURRENT_KEY_ID;
    const currentKeyHash = process.env.JWT_CURRENT_KEY_HASH;

    // If K8s key is available, use it for verification
    const secret = currentKeyHash
      ? currentKeyHash // In production, this would be the actual key from K8s
      : process.env.JWT_SECRET || 'dev-fallback-secret-not-for-production';

    const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] }) as {
      userId: string;
      username: string;
      roles?: string[];
      role?: string;
    };

    // Attach user info to the request object for downstream use
    request.user = {
      userId: decoded.userId,
      username: decoded.username,
      roles: decoded.roles || (decoded.role ? [decoded.role] : []),
    };
  } catch (error) {
    return reply.code(401).send({
      code: 401,
      error: 'INVALID_TOKEN',
      message: 'Token is invalid or expired',
    });
  }
}
