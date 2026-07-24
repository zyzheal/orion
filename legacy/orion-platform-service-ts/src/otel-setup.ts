// orion-platform-service/src/otel-setup.ts
// OpenTelemetry initialization stub

import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

/**
 * OpenTelemetry initialization
 * Phase 4: stub - will be wired to @opentelemetry packages when installed
 */
export async function initializeOpenTelemetry(): Promise<void> {
  logger.info('OpenTelemetry initialization (simulated - package not yet installed)');

  // Future implementation:
  // npm install @opentelemetry/api @opentelemetry/sdk-node @opentelemetry/sdk-trace-node
  //   @opentelemetry/exporter-trace-otlp-http @opentelemetry/resource-detector-alpine
  //   @opentelemetry/instrumentation-express @opentelemetry/instrumentation-http

  // Global tracer stub for plugin execution spans
  (global as any).otelTracer = {
    startSpan: (name: string, options?: any) => ({
      setAttribute: (key: string, value: any) => {},
      setAttributes: (attrs: Record<string, any>) => {},
      setStatus: (status: any) => {},
      end: () => {},
    }),
  };

  logger.info('OpenTelemetry tracer stub registered');
}
