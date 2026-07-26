/**
 * Orion Runner Service - Configuration
 *
 * CI Runner that executes tasks for the Orion Platform.
 * Registers with Platform, sends heartbeats, and executes jobs.
 */

export const config = {
  port: parseInt(process.env.PORT || '3028', 10),
  host: process.env.HOST || '0.0.0.0',
  logLevel: process.env.LOG_LEVEL || 'info',
  platform: {
    url: process.env.PLATFORM_URL || 'http://localhost:3001',
    timeout: parseInt(process.env.PLATFORM_TIMEOUT || '30000', 10),
  },
  runner: {
    name: process.env.RUNNER_NAME || '',
    labels: (process.env.RUNNER_LABELS || 'linux,nodejs').split(','),
    maxConcurrent: parseInt(process.env.RUNNER_MAX_CONCURRENT || '5', 10),
    heartbeatInterval: parseInt(process.env.HEARTBEAT_INTERVAL || '30000', 10),
    apiToken: process.env.RUNNER_API_TOKEN || '',
  },
  tenant: {
    id: process.env.TENANT_ID || 'default',
  },
};
