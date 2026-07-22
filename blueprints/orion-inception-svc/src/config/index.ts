/**
 * Inception Service - Configuration
 *
 * Wraps Inception SQL audit engine (TCP protocol) behind HTTP API.
 * Provides SQL audit/parse/execute interface for the Orion platform.
 */

export const config = {
  port: parseInt(process.env.PORT || '3033', 10),
  host: process.env.HOST || '0.0.0.0',
  logLevel: process.env.LOG_LEVEL || 'info',
  inception: {
    host: process.env.INCEPTION_HOST || 'localhost',
    port: parseInt(process.env.INCEPTION_PORT || '6669', 10),
    timeout: parseInt(process.env.INCEPTION_TIMEOUT || '30000', 10),
    user: process.env.INCEPTION_USER || 'inception',
    password: process.env.INCEPTION_PASSWORD || '',
  },
  nats: {
    servers: (process.env.NATS_SERVERS || 'nats://localhost:4222').split(','),
    user: process.env.NATS_USER,
    pass: process.env.NATS_PASS,
  },
};
