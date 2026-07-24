import type { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

declare module 'fastify' {
  interface FastifyRequest {
    tenantId: string;
  }
}

export interface TenantIsolationOptions {
  /**
   * Header name for tenant ID. Default: 'X-Tenant-ID'
   */
  headerName?: string;

  /**
   * Whether to require tenant ID. Default: true
   */
  required?: boolean;
}

/**
 * 租户隔离中间件
 *
 * 从请求头 (X-Tenant-ID)、JWT payload 或 query parameter 中提取 tenantId，
 * 注入到 request.tenantId，后续 Service 层直接使用。
 *
 * 必须在 jwtAuth 之后注册，以确保 request.user 已填充。
 *
 * 用法:
 *   app.register(tenantIsolation, { headerName: 'X-Tenant-ID' });
 */
async function tenantIsolationPlugin(fastify: FastifyInstance, opts: TenantIsolationOptions = {}) {
  const headerName = opts.headerName || 'X-Tenant-ID';
  const required = opts.required !== false;

  fastify.decorate('tenantIsolation', async function tenantIsolationHandler(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    let tenantId: string | undefined;

    // Priority 1: Request header
    const headerValue = request.headers[headerName.toLowerCase()];
    if (typeof headerValue === 'string') {
      tenantId = headerValue;
    }

    // Priority 2: JWT payload
    if (!tenantId && request.user && request.user.tenantId) {
      tenantId = request.user.tenantId;
    }

    // Priority 3: Query parameter
    if (!tenantId && typeof request.query === 'object' && request.query !== null) {
      const q = request.query as Record<string, unknown>;
      if (typeof q.tenantId === 'string') {
        tenantId = q.tenantId;
      }
    }

    if (!tenantId && required) {
      return reply.code(400).send({
        success: false,
        error: {
          code: 'MISSING_TENANT',
          message: `Tenant ID is required. Provide it via ${headerName} header, JWT payload, or ?tenantId= parameter.`,
        },
      });
    }

    if (tenantId) {
      request.tenantId = tenantId;
    }
  });
}

export default fp(tenantIsolationPlugin, {
  name: 'tenantIsolation',
  fastify: '5.x',
});
