import type { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { validateApiKey, recordApiKeyUsage } from '../services/ApiKeyService.js';

export interface ApiKeyAuthOptions {
  /**
   * Header name for API key. Default: 'X-API-Key'
   */
  headerName?: string;

  /**
   * Whether to record usage (update last_used_at). Default: true
   */
  recordUsage?: boolean;
}

/**
 * API Key 认证中间件
 *
 * 从请求头 (X-API-Key) 中提取并验证 API Key。
 * 验证通过后将 tenantId/projectId 注入 request 对象。
 *
 * 用法:
 *   app.register(apiKeyAuth, { headerName: 'X-API-Key' });
 */
async function apiKeyAuthPlugin(fastify: FastifyInstance, opts: ApiKeyAuthOptions = {}) {
  const headerName = opts.headerName || 'X-API-Key';
  const recordUsage = opts.recordUsage !== false;

  fastify.decorate('apiKeyAuth', async function apiKeyAuthHandler(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const key = request.headers[headerName.toLowerCase()] as string | undefined;

    if (!key) {
      return reply.code(401).send({
        success: false,
        error: {
          code: 'MISSING_API_KEY',
          message: `API key is required. Provide it via ${headerName} header.`,
        },
      });
    }

    try {
      const apiKey = await validateApiKey(key);

      if (!apiKey) {
        return reply.code(401).send({
          success: false,
          error: {
            code: 'INVALID_API_KEY',
            message: 'Invalid or expired API key.',
          },
        });
      }

      // Inject tenant/project context from API key
      if (apiKey.tenantId) {
        (request as unknown as Record<string, unknown>).apiKeyTenantId = apiKey.tenantId;
      }
      if (apiKey.projectId) {
        (request as unknown as Record<string, unknown>).apiKeyProjectId = apiKey.projectId;
      }

      // Record usage asynchronously (non-blocking)
      if (recordUsage) {
        recordApiKeyUsage(apiKey.id).catch((err) => {
          fastify.log.warn({ err, keyId: apiKey.id }, 'Failed to record API key usage');
        });
      }
    } catch (err) {
      fastify.log.error({ err }, 'API key validation failed');
      return reply.code(500).send({
        success: false,
        error: {
          code: 'API_KEY_VALIDATION_ERROR',
          message: 'Failed to validate API key.',
        },
      });
    }
  });
}

export default fp(apiKeyAuthPlugin, {
  name: 'apiKeyAuth',
  fastify: '5.x',
});
