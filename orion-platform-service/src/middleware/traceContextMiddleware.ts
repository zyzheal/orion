/**
 * Trace Context Middleware
 *
 * W3C Trace Context propagation middleware for Fastify.
 * Injects traceparent header into requests and attaches trace context to request object.
 *
 * Features:
 *   - Parses incoming traceparent header (W3C Trace Context)
 *   - Generates new trace context if none present
 *   - Attaches traceId to request for downstream use
 *   - Adds traceId to pino logger for structured logging
 *   - Adds X-Trace-ID response header for client correlation
 *
 * W3C Trace Context Format:
 *   traceparent: 00-{traceId:32hex}-{spanId:16hex}-{flags:2hex}
 *
 * Usage:
 *   app.addHook('onRequest', createTraceContextMiddleware());
 *
 * Downstream usage:
 *   const traceId = (request as any).traceId;
 *   const traceContext = (request as any).traceContext;
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { TracingService, TraceContext } from '../services/monitoring/TracingService';
import { createLogger } from '../utils/logger';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface TraceContextMiddlewareOptions {
  /** Header name for trace context (default: traceparent) */
  headerName?: string;
  /** Response header name for trace ID (default: X-Trace-ID) */
  traceIdHeader?: string;
  /** Whether to sample all requests (default: true) */
  sampleAll?: boolean;
  /** Skip paths that don't need tracing */
  skipPaths?: string[];
}

const DEFAULT_OPTIONS: Required<TraceContextMiddlewareOptions> = {
  headerName: 'traceparent',
  traceIdHeader: 'X-Trace-ID',
  sampleAll: true,
  skipPaths: ['/healthz', '/readyz', '/metrics', '/version'],
};

/**
 * Create trace context middleware for Fastify
 */
export function createTraceContextMiddleware(options?: TraceContextMiddlewareOptions) {
  const opts: Required<TraceContextMiddlewareOptions> = { ...DEFAULT_OPTIONS, ...options };

  return async (request: FastifyRequest, reply: FastifyReply) => {
    const path = request.url.split('?')[0];

    // Skip health check and metrics endpoints
    if (opts.skipPaths.some((skip) => path.startsWith(skip))) {
      return;
    }

    const traceparentHeader = request.headers[opts.headerName] as string | undefined;
    let traceContext: TraceContext;

    if (traceparentHeader) {
      // Parse incoming trace context
      const parsed = TracingService.parseTraceParent(traceparentHeader);
      if (parsed) {
        traceContext = {
          ...parsed,
          spanId: TracingService.generateSpanId(), // New span for this service
        };
      } else {
        // Invalid traceparent - generate new one
        logger.debug({ header: traceparentHeader }, '[TraceContext] Invalid traceparent header');
        traceContext = TracingService.generateTraceContext();
      }
    } else {
      // No trace context - generate new trace
      traceContext = TracingService.generateTraceContext();
    }

    // Attach to request for downstream use
    (request as any).traceId = traceContext.traceId;
    (request as any).traceContext = traceContext;
    (request as any).spanId = traceContext.spanId;

    // Add trace ID to response headers
    reply.header(opts.traceIdHeader, traceContext.traceId);

    // Build traceparent for downstream propagation
    const downstreamTraceParent = TracingService.buildTraceParent(
      traceContext.traceId,
      traceContext.spanId,
      traceContext.sampled
    );
    (request as any).downstreamTraceParent = downstreamTraceParent;

    // Log request with trace ID for correlation
    if (traceContext.sampled) {
      logger.info(
        {
          trace_id: traceContext.traceId,
          span_id: traceContext.spanId,
          method: request.method,
          path,
        },
        '[TraceContext] Request started'
      );
    }
  };
}

/**
 * Helper to get trace context from request
 */
export function getTraceContext(request: FastifyRequest): {
  traceId: string;
  spanId: string;
  downstreamTraceParent: string;
} {
  return {
    traceId: (request as any).traceId || '',
    spanId: (request as any).spanId || '',
    downstreamTraceParent: (request as any).downstreamTraceParent || '',
  };
}

/**
 * Helper to add trace context to outgoing HTTP request headers
 */
export function withTraceContext(request: FastifyRequest, headers: Record<string, string> = {}): Record<string, string> {
  const { downstreamTraceParent } = getTraceContext(request);
  if (downstreamTraceParent) {
    return {
      ...headers,
      traceparent: downstreamTraceParent,
    };
  }
  return headers;
}
