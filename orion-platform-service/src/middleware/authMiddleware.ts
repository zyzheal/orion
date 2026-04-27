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

// JWT_SECRET must be set via environment variable
const JWT_SECRET: string = process.env.JWT_SECRET || '';
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required for authMiddleware');
}

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
    const decoded = jwt.verify(token, JWT_SECRET) as {
      userId: string;
      username: string;
      role: string;
    };

    // Attach user info to the request object for downstream use
    request.user = {
      userId: decoded.userId,
      username: decoded.username,
      role: decoded.role,
    };
  } catch (error) {
    return reply.code(401).send({
      code: 401,
      error: 'INVALID_TOKEN',
      message: 'Token is invalid or expired',
    });
  }
}
