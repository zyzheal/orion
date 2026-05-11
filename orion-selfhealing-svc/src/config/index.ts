/**
 * Self-Healing Service Configuration
 * 自愈服务配置
 */

export interface SelfHealingServiceConfig {
  port: number;
  host: string;
  logLevel: string;
  corsOrigin: string | boolean;
}

export function getConfig(): SelfHealingServiceConfig {
  return {
    port: parseInt(process.env.PORT || '3024', 10),
    host: process.env.HOST || '0.0.0.0',
    logLevel: process.env.LOG_LEVEL || 'info',
    corsOrigin: process.env.CORS_ORIGIN || true,
  };
}
