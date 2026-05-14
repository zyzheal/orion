/**
 * PandaWiki Service - Configuration
 *
 * Wraps PandaWiki knowledge base API behind unified HTTP interface.
 * Adds tenant isolation and NATS event integration.
 */

export const config = {
  port: parseInt(process.env.PORT || '3034', 10),
  host: process.env.HOST || '0.0.0.0',
  logLevel: process.env.LOG_LEVEL || 'info',
  pandawiki: {
    url: process.env.PANDAWIKI_URL || 'http://localhost:8001',
    timeout: parseInt(process.env.PANDAWIKI_TIMEOUT || '30000', 10),
    apiKey: process.env.PANDAWIKI_API_KEY || '',
  },
  nats: {
    servers: (process.env.NATS_SERVERS || 'nats://localhost:4222').split(','),
    user: process.env.NATS_USER,
    pass: process.env.NATS_PASS,
  },
};
