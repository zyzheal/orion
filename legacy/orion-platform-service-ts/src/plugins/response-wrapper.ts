/**
 * Response Wrapper Hook - Phase 2
 *
 * Auto-wraps legacy API responses with standardized format:
 * { success, data, error, meta, _legacy: true }
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ErrorCodes } from '../types/error-codes';

// Feature flag - default enabled
const ENABLE_RESPONSE_WRAPPER = process.env.ENABLE_RESPONSE_WRAPPER !== 'false';

/**
 * Map HTTP status code to error code
 */
function mapStatusToErrorCode(statusCode: number): string {
  switch (statusCode) {
    case 400:
      return ErrorCodes.CLIENT_PARAM_INVALID;
    case 401:
      return ErrorCodes.CLIENT_AUTH_EXPIRED;
    case 403:
      return ErrorCodes.CLIENT_PERMISSION_DENIED;
    case 404:
      return ErrorCodes.CLIENT_RESOURCE_NOT_FOUND;
    case 409:
      return ErrorCodes.CLIENT_CONFLICT;
    case 429:
      return ErrorCodes.CLIENT_RATE_LIMITED;
    default:
      return ErrorCodes.SYS_INTERNAL_ERROR;
  }
}

/**
 * Check if response is already wrapped
 */
function isAlreadyWrapped(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  const obj = payload as Record<string, unknown>;

  // Check for success field (boolean)
  if (typeof obj.success !== 'boolean') {
    return false;
  }

  // Check for meta.requestId
  if (!obj.meta || typeof obj.meta !== 'object') {
    return false;
  }

  const meta = obj.meta as Record<string, unknown>;
  return typeof meta.requestId === 'string';
}

/**
 * Check if endpoint should skip wrapping
 */
function shouldSkipWrapping(request: FastifyRequest, reply: FastifyReply): boolean {
  const url = request.url;
  const statusCode = reply.statusCode;
  const contentType = reply.getHeader('content-type') as string | undefined;

  // Skip 3xx redirects
  if (statusCode >= 300 && statusCode < 400) {
    return true;
  }

  // Skip empty payloads (204, undefined, null, empty string)
  if (statusCode === 204 || statusCode === 304) {
    return true;
  }

  // Skip SSE endpoints
  if (url.includes('/sse')) {
    return true;
  }

  // Skip health checks
  if (url === '/healthz' || url === '/ready' || url === '/health') {
    return true;
  }

  // Skip binary responses
  if (contentType) {
    const isBinary = contentType.includes('application/octet-stream') ||
                     contentType.includes('image/') ||
                     contentType.includes('audio/') ||
                     contentType.includes('video/') ||
                     contentType.includes('application/pdf') ||
                     contentType.includes('application/zip') ||
                     contentType.includes('application/x-gzip') ||
                     contentType.includes('application/gzip');

    if (isBinary) {
      return true;
    }

    // Skip SSE content-type
    if (contentType.includes('text/event-stream')) {
      return true;
    }
  }

  return false;
}

/**
 * Parse payload safely
 */
function parsePayload(payload: unknown): { data: unknown; isEmpty: boolean } {
  // Handle undefined, null, empty string
  if (payload === undefined || payload === null || payload === '') {
    return { data: null, isEmpty: true };
  }

  // Handle Buffer/Blob
  if (Buffer.isBuffer(payload) || (typeof payload === 'object' && payload !== null && (payload as { type?: string }).type === 'Buffer')) {
    return { data: null, isEmpty: true };
  }

  // Handle string payload
  if (typeof payload === 'string') {
    // Empty string or whitespace-only
    if (payload.trim() === '') {
      return { data: null, isEmpty: true };
    }

    // Try to parse JSON
    try {
      const parsed = JSON.parse(payload);
      return { data: parsed, isEmpty: false };
    } catch {
      // Not JSON, treat as plain text
      return { data: payload, isEmpty: false };
    }
  }

  return { data: payload, isEmpty: false };
}

/**
 * Register the response wrapper hook
 */
export function registerResponseWrapperHook(fastify: FastifyInstance): void {
  // Skip if feature flag is disabled
  if (!ENABLE_RESPONSE_WRAPPER) {
    fastify.log.info('Response wrapper hook disabled via feature flag');
    return;
  }

  fastify.addHook('onSend', async (request: FastifyRequest, reply: FastifyReply, payload: unknown) => {
    // Skip if already handled or should skip
    if (shouldSkipWrapping(request, reply)) {
      return payload;
    }

    // Parse payload
    const { data, isEmpty } = parsePayload(payload);

    // Skip empty payloads
    if (isEmpty) {
      return payload;
    }

    // Skip if already wrapped
    if (isAlreadyWrapped(data)) {
      return payload;
    }

    const statusCode = reply.statusCode;
    const requestId = (request as { id?: string }).id || 'unknown';

    // Determine if response indicates error (4xx, 5xx)
    const isError = statusCode >= 400;

    // Build wrapped response
    const wrappedResponse = isError
      ? {
          success: false,
          data: null,
          error: {
            code: mapStatusToErrorCode(statusCode),
            message: extractErrorMessage(data),
          },
          meta: {
            requestId,
            timestamp: new Date().toISOString(),
            statusCode,
          },
          _legacy: true,
        }
      : {
          success: true,
          data,
          error: null,
          meta: {
            requestId,
            timestamp: new Date().toISOString(),
            statusCode,
          },
          _legacy: true,
        };

    return JSON.stringify(wrappedResponse);
  });

  fastify.log.info('Response wrapper hook registered');
}

/**
 * Extract error message from payload
 */
function extractErrorMessage(payload: unknown): string {
  if (!payload || typeof payload !== 'object') {
    return 'Unknown error';
  }

  const obj = payload as Record<string, unknown>;

  // Try common error message fields
  if (typeof obj.message === 'string') {
    return obj.message;
  }
  if (typeof obj.error === 'string') {
    return obj.error;
  }
  if (typeof obj.msg === 'string') {
    return obj.msg;
  }
  if (typeof obj.detail === 'string') {
    return obj.detail;
  }

  return 'Unknown error';
}