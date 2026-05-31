/**
 * API Key Authentication Middleware
 *
 * Verifies X-API-Key header against stored API key hashes.
 * On success, attaches apiKey and apiKeyTenantId to request.
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { ApiKeyService } from '../services/api-key/ApiKeyService';
import { ApiKeyRepository } from '../services/api-key/ApiKeyRepository';
import { OrionError, ErrorCode } from '../errors';

let apiKeyService: ApiKeyService | null = null;

export function initApiKeyAuth(db: { query: (text: string, params?: unknown[]) => Promise<any> }): void {
  const repo = new ApiKeyRepository(db as any);
  apiKeyService = new ApiKeyService(repo);
}

export async function authenticateApiKey(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (!apiKeyService) {
    throw new OrionError(ErrorCode.OPERATION_FAILED, 'API key auth not initialized. Call initApiKeyAuth() first.');
  }

  const apiKey = request.headers['x-api-key'] as string | undefined;
  if (!apiKey) {
    return reply.code(401).send({
      code: 401,
      error: 'UNAUTHORIZED',
      message: 'Missing X-API-Key header',
    });
  }

  try {
    const result = await apiKeyService.verifyKey(apiKey);
    if (!result) {
      return reply.code(401).send({
        code: 401,
        error: 'INVALID_API_KEY',
        message: 'Invalid or expired API key',
      });
    }

    (request as any).apiKey = result.key;
    (request as any).apiKeyTenantId = result.key.tenant_id;
  } catch {
    return reply.code(500).send({
      code: 500,
      error: 'AUTH_ERROR',
      message: 'API key verification failed',
    });
  }
}
