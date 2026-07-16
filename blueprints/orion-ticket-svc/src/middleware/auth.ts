/**
 * Auth Middleware - 认证中间件
 * TODO: 实现 JWT 认证和租户隔离
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export async function authMiddleware(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    // TODO: 实现认证逻辑
    // 1. 从 Authorization header 获取 JWT token
    // 2. 验证 token 签名和过期时间
    // 3. 从 token 中提取 userId 和 tenantId
    // 4. 注入到 request 对象

    // Skip auth for health check and docs
    if (request.url.startsWith('/health') ||
        request.url.startsWith('/ready') ||
        request.url.startsWith('/api/docs')) {
      return;
    }

    const authHeader = request.headers.authorization;
    if (!authHeader) {
      reply.code(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Missing authorization header' },
      });
      return;
    }

    // TODO: 验证 JWT
    // const token = authHeader.replace('Bearer ', '');
    // const payload = await verifyToken(token);
    // (request as any).userId = payload.userId;
    // (request as any).tenantId = payload.tenantId;

    // Placeholder - inject mock tenant for development
    (request as any).tenantId = '00000000-0000-0000-0000-000000000000';
    (request as any).userId = '00000000-0000-0000-0000-000000000001';
  });
}
