/**
 * PandaWiki Service - Configuration
 *
 * Wraps PandaWiki knowledge base API behind unified HTTP interface.
 * Adds tenant isolation, NATS event integration, and PostgreSQL storage.
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
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    name: process.env.DB_NAME || 'orion_pandawiki',
    user: process.env.DB_USER || 'orion',
    password: process.env.DB_PASSWORD || '',
    poolMin: parseInt(process.env.DB_POOL_MIN || '2', 10),
    poolMax: parseInt(process.env.DB_POOL_MAX || '10', 10),
  },
  nats: {
    servers: (process.env.NATS_SERVERS || 'nats://localhost:4222').split(','),
    user: process.env.NATS_USER,
    pass: process.env.NATS_PASS,
  },
};
