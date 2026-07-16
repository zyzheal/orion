/**
 * Rate Limiter & Circuit Breaker
 *
 * Shared utilities for rate limiting and circuit breaking across services.
 * Uses in-memory storage with optional Redis backing for distributed deployments.
 */

// ─── Rate Limiter ────────────────────────────────────────────────────────────

export interface RateLimitConfig {
  /** Max requests per window */
  maxRequests: number;
  /** Window duration in milliseconds */
  windowMs: number;
  /** Optional key prefix for namespacing */
  keyPrefix?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  current: number;
  limit: number;
  remaining: number;
  resetAt: Date;
}

/**
 * In-memory rate limiter using sliding window counter.
 * For production distributed deployments, use Redis-backed implementation.
 */
export class RateLimiter {
  private counters = new Map<string, { count: number; windowStart: number }>();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  /**
   * Check if a request is allowed for the given key.
   */
  check(key: string): RateLimitResult {
    const prefixedKey = `${this.config.keyPrefix || 'rl'}:${key}`;
    const now = Date.now();
    const entry = this.counters.get(prefixedKey);

    if (!entry || now - entry.windowStart >= this.config.windowMs) {
      // New window
      this.counters.set(prefixedKey, { count: 1, windowStart: now });
      return {
        allowed: true,
        current: 1,
        limit: this.config.maxRequests,
        remaining: this.config.maxRequests - 1,
        resetAt: new Date(now + this.config.windowMs),
      };
    }

    entry.count++;
    const remaining = Math.max(0, this.config.maxRequests - entry.count);
    const allowed = entry.count <= this.config.maxRequests;

    return {
      allowed,
      current: entry.count,
      limit: this.config.maxRequests,
      remaining,
      resetAt: new Date(entry.windowStart + this.config.windowMs),
    };
  }

  /**
   * Reset the counter for a key.
   */
  reset(key: string): void {
    const prefixedKey = `${this.config.keyPrefix || 'rl'}:${key}`;
    this.counters.delete(prefixedKey);
  }

  /**
   * Clear all counters (for testing).
   */
  clear(): void {
    this.counters.clear();
  }
}

// ─── Circuit Breaker ────────────────────────────────────────────────────────

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerConfig {
  /** Failure threshold before opening circuit */
  failureThreshold: number;
  /** Time in ms before attempting recovery */
  recoveryTimeoutMs: number;
  /** Successes needed in half-open to close circuit */
  successThreshold?: number;
}

export class CircuitBreakerError extends Error {
  constructor(message: string = 'Circuit breaker is open') {
    super(message);
    this.name = 'CircuitBreakerError';
  }
}

/**
 * Circuit breaker pattern implementation.
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Failures exceeded threshold, requests fail immediately
 * - HALF-OPEN: Recovery timeout elapsed, allow limited requests to test recovery
 */
export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime: number | null = null;
  private config: CircuitBreakerConfig;

  constructor(config: CircuitBreakerConfig) {
    this.config = {
      successThreshold: 1,
      ...config,
    };
  }

  get currentState(): CircuitState {
    // Auto-transition from open to half-open after recovery timeout
    if (this.state === 'open' && this.lastFailureTime) {
      if (Date.now() - this.lastFailureTime >= this.config.recoveryTimeoutMs) {
        this.state = 'half-open';
        this.successCount = 0;
      }
    }
    return this.state;
  }

  /**
   * Execute a function through the circuit breaker.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const state = this.currentState;

    if (state === 'open') {
      throw new CircuitBreakerError('Circuit breaker is open');
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Manually open the circuit (e.g., for maintenance).
   */
  open(): void {
    this.state = 'open';
    this.lastFailureTime = Date.now();
  }

  /**
   * Manually close the circuit (e.g., after maintenance).
   */
  close(): void {
    this.state = 'closed';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
  }

  /**
   * Get current stats for monitoring.
   */
  getStats(): {
    state: CircuitState;
    failureCount: number;
    successCount: number;
    lastFailureTime: Date | null;
  } {
    return {
      state: this.currentState,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime ? new Date(this.lastFailureTime) : null,
    };
  }

  private onSuccess(): void {
    if (this.state === 'half-open') {
      this.successCount++;
      if (this.successCount >= (this.config.successThreshold || 1)) {
        this.state = 'closed';
        this.failureCount = 0;
        this.successCount = 0;
      }
    } else {
      this.failureCount = 0;
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === 'half-open') {
      // Back to open on any failure in half-open
      this.state = 'open';
    } else if (this.failureCount >= this.config.failureThreshold) {
      this.state = 'open';
    }
  }
}

// ─── Fastify Plugin ─────────────────────────────────────────────────────────

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

export interface RateLimitPluginOptions {
  /** Default rate limit config */
  default: RateLimitConfig;
  /** Per-route overrides */
  routes?: Record<string, RateLimitConfig>;
}

/**
 * Register rate limiting as a Fastify pre-handler.
 */
export function registerRateLimit(
  fastify: FastifyInstance,
  options: RateLimitPluginOptions,
): void {
  const limiter = new RateLimiter(options.default);

  fastify.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    // Find matching route config — strip query params for reliable matching
    const pathOnly = request.url.split('?')[0];
    const routeKey = `${request.method}:${pathOnly}`;
    const routeConfig = options.routes?.[routeKey];

    if (routeConfig) {
      const routeLimiter = new RateLimiter(routeConfig);
      const result = routeLimiter.check(request.ip || 'unknown');

      reply.header('X-RateLimit-Limit', result.limit);
      reply.header('X-RateLimit-Remaining', result.remaining);
      reply.header('X-RateLimit-Reset', result.resetAt.toISOString());

      if (!result.allowed) {
        return reply.code(429).send({
          success: false,
          error: {
            code: 'RATE_LIMITED',
            message: `Rate limit exceeded. Try again after ${result.resetAt.toISOString()}`,
          },
          timestamp: new Date().toISOString(),
        });
      }
    }
  });
}
