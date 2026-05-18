/**
 * Unified Health Check Middleware
 *
 * Standardizes health check endpoints across all services to a single format:
 *
 * GET /healthz
 * {
 *   status: 'healthy' | 'unhealthy' | 'degraded',
 *   service: string,
 *   version: string,
 *   timestamp: string,
 *   uptime: number,
 *   checks: {
 *     database?: { status: 'ok' | 'error', latency?: number, error?: string },
 *     redis?: { status: 'ok' | 'error', latency?: number, error?: string },
 *     nats?: { status: 'ok' | 'error', latency?: number, error?: string },
 *     ...custom checks
 *   }
 * }
 *
 * HTTP 200 = healthy, 503 = unhealthy
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

export interface HealthCheckResult {
  status: 'ok' | 'error';
  latency?: number; // ms
  error?: string;
}

export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy' | 'degraded';
  service: string;
  version: string;
  timestamp: string;
  uptime: number;
  checks: Record<string, HealthCheckResult>;
}

export type HealthCheckFn = () => Promise<HealthCheckResult>;

export interface HealthCheckOptions {
  /** Service name (e.g., 'orion-pipeline-svc') */
  serviceName: string;
  /** Service version (from package.json or env) */
  version?: string;
  /** Individual health check functions */
  checks?: Record<string, HealthCheckFn>;
}

/**
 * Register a standardized /healthz endpoint on a Fastify instance.
 */
export function registerHealthCheck(
  fastify: FastifyInstance,
  options: HealthCheckOptions,
): void {
  fastify.get('/healthz', async (_request: FastifyRequest, reply: FastifyReply) => {
    const checks: Record<string, HealthCheckResult> = {};
    let hasError = false;
    let hasDegraded = false;

    // Run all checks in parallel
    if (options.checks) {
      const results = await Promise.allSettled(
        Object.entries(options.checks).map(async ([name, fn]) => {
          const start = Date.now();
          try {
            const result = await fn();
            return [name, { ...result, latency: Date.now() - start }] as [string, HealthCheckResult];
          } catch (err) {
            const error = err instanceof Error ? err.message : String(err);
            return [name, { status: 'error' as const, latency: Date.now() - start, error }] as [string, HealthCheckResult];
          }
        }),
      );

      for (const result of results) {
        if (result.status === 'fulfilled') {
          const [name, checkResult] = result.value;
          checks[name] = checkResult;
          if (checkResult.status === 'error') {
            hasError = true;
          }
        } else {
          // Promise.allSettled rejection (shouldn't happen with our wrapper, but just in case)
          hasError = true;
        }
      }
    }

    // Determine overall status
    const overallStatus: HealthCheckResponse['status'] = hasError
      ? 'unhealthy'
      : hasDegraded
        ? 'degraded'
        : 'healthy';

    const response: HealthCheckResponse = {
      status: overallStatus,
      service: options.serviceName,
      version: options.version || process.env.npm_package_version || 'unknown',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      checks,
    };

    const statusCode = overallStatus === 'unhealthy' ? 503 : 200;
    return reply.code(statusCode).send(response);
  });
}

/**
 * Create a database health check function.
 */
export function createDbHealthCheck(pool: { query: (sql: string) => Promise<unknown> }): HealthCheckFn {
  return async () => {
    await pool.query('SELECT 1');
    return { status: 'ok' };
  };
}

/**
 * Create a Redis health check function.
 */
export function createRedisHealthCheck(redis: { ping: () => Promise<string> }): HealthCheckFn {
  return async () => {
    const result = await redis.ping();
    if (result === 'PONG') return { status: 'ok' };
    return { status: 'error', error: `Unexpected ping response: ${result}` };
  };
}

/**
 * Create a NATS health check function.
 */
export function createNatsHealthCheck(nats: { isConnected: () => boolean }): HealthCheckFn {
  return async () => {
    if (nats.isConnected()) return { status: 'ok' };
    return { status: 'error', error: 'NATS connection lost' };
  };
}
