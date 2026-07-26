import type { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import jwt from 'jsonwebtoken';

export interface JwtPayload {
  userId: string;
  tenantId: string;
  email?: string;
  roles?: string[];
}

declare module 'fastify' {
  interface FastifyRequest {
    user: JwtPayload;
  }
}

export interface JwtAuthOptions {
  secret: string;
  algorithms?: jwt.Algorithm[];
  audience?: string;
  issuer?: string;
}

/**
 * JWT 认证中间件
 *
 * 从 Authorization: Bearer <token> 或 ?token= 中提取并验证 JWT。
 * 验证通过后将 payload 注入 request.user。
 *
 * 用法:
 *   app.register(jwtAuth, { secret: process.env.JWT_SECRET! });
 *   app.register(routes, { preHandler: [app.jwtAuth] });
 */
async function jwtAuthPlugin(fastify: FastifyInstance, opts: JwtAuthOptions) {
  const secret = opts.secret || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is required for jwtAuth middleware');
  }

  fastify.decorate('jwtAuth', async function jwtAuthHandler(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    let token: string | undefined;

    // Extract from Authorization header
    const authHeader = request.headers.authorization;
    if (authHeader) {
      const parts = authHeader.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        token = parts[1];
      }
    }

    // Fallback: query parameter
    if (!token && typeof request.query === 'object' && request.query !== null) {
      const q = request.query as Record<string, unknown>;
      if (typeof q.token === 'string') {
        token = q.token;
      }
    }

    if (!token) {
      return reply.code(401).send({
        success: false,
        error: {
          code: 'MISSING_TOKEN',
          message: 'No JWT token provided. Use Authorization: Bearer <token> or ?token= parameter.',
        },
      });
    }

    try {
      const decoded = jwt.verify(token, secret, {
        algorithms: opts.algorithms || ['HS256'],
        audience: opts.audience,
        issuer: opts.issuer,
      }) as JwtPayload;

      request.user = decoded;
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        return reply.code(401).send({
          success: false,
          error: {
            code: 'TOKEN_EXPIRED',
            message: 'JWT token has expired.',
          },
        });
      }
      if (err instanceof jwt.JsonWebTokenError) {
        return reply.code(401).send({
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Invalid JWT token.',
          },
        });
      }
      return reply.code(401).send({
        success: false,
        error: {
          code: 'AUTH_FAILED',
          message: 'Authentication failed.',
        },
      });
    }
  });
}

export default fp(jwtAuthPlugin, {
  name: 'jwtAuth',
  fastify: '5.x',
});
