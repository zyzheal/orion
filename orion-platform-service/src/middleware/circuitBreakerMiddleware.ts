/**
 * Circuit Breaker Middleware
 *
 * F002: Fastify pre-handler that checks circuit breaker state before request processing.
 * When a circuit is OPEN, returns 503 with Retry-After header.
 *
 * Usage:
 *   app.register(registerCircuitBreakerMiddleware, {
 *     circuitBreakerService,
 *     targets: [
 *       { pathPrefix: '/api/v1/github', targetKey: 'scm:github' },
 *       { pathPrefix: '/api/v1/docker', targetKey: 'registry:docker' },
 *     ],
 *   });
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { CircuitBreakerService } from '../services/circuit-breaker/circuit-breaker-service';

export interface CircuitBreakerTarget {
  /** URL path prefix that maps to this circuit breaker */
  pathPrefix: string;
  /** Circuit breaker target key */
  targetKey: string;
  /** Optional: only apply to specific HTTP methods */
  methods?: string[];
}

export interface CircuitBreakerMiddlewareOptions {
  circuitBreakerService: CircuitBreakerService;
  targets: CircuitBreakerTarget[];
  /** Custom message for 503 responses */
  message?: string;
}

/**
 * Register circuit breaker pre-handler middleware.
 */
export async function registerCircuitBreakerMiddleware(
  fastify: FastifyInstance,
  options: CircuitBreakerMiddlewareOptions,
): Promise<void> {
  const { circuitBreakerService, targets } = options;

  fastify.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    // Find matching target for this request
    const matched = targets.find(
      (t) => request.url.startsWith(t.pathPrefix) &&
        (!t.methods || t.methods.length === 0 || t.methods.includes(request.method)),
    );

    if (!matched) return;

    try {
      const state = await circuitBreakerService.getState(matched.targetKey);
      if (!state) return; // No circuit breaker for this target, allow through

      if (state.state === 'open') {
        const retryAfterSecs = Math.ceil(state.config.recoveryTimeoutMs / 1000);
        reply.header('Retry-After', retryAfterSecs);
        reply.header('X-Circuit-Breaker-State', 'open');

        return reply.code(503).send({
          success: false,
          error: {
            code: 'CIRCUIT_OPEN',
            message: `Service temporarily unavailable: circuit breaker is open for ${matched.targetKey}. Retry after ${retryAfterSecs}s.`,
            targetKey: matched.targetKey,
            retryAfter: retryAfterSecs,
          },
          timestamp: new Date().toISOString(),
        });
      }

      // HALF_OPEN: allow probe requests through, mark header
      if (state.state === 'half-open') {
        reply.header('X-Circuit-Breaker-State', 'half-open');
      }
    } catch (error) {
      // Fail-closed: if we can't check the circuit breaker state, reject the request
      const errMsg = error instanceof Error ? error.message : String(error);
      request.log.error({ error: errMsg }, 'Failed to check circuit breaker state, rejecting request');
      reply.code(503).send({
        success: false,
        error: {
          code: 'CIRCUIT_CHECK_FAILED',
          message: 'Service temporarily unavailable: unable to check circuit breaker state.',
        },
        timestamp: new Date().toISOString(),
      });
    }
  });
}
