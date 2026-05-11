/**
 * Risk Service Configuration
 * 风险评估服务配置
 */

export interface RiskServiceConfig {
  port: number;
  host: string;
  logLevel: string;
  corsOrigin: string | boolean;
}

export function getConfig(): RiskServiceConfig {
  return {
    port: parseInt(process.env.PORT || '3021', 10),
    host: process.env.HOST || '0.0.0.0',
    logLevel: process.env.LOG_LEVEL || 'info',
    corsOrigin: process.env.CORS_ORIGIN || true,
  };
}
