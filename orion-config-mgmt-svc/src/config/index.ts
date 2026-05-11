/**
 * Config Management Service Configuration
 * 配置管理服务配置
 */

export interface ConfigMgmtServiceConfig {
  port: number;
  host: string;
  logLevel: string;
  corsOrigin: string | boolean;
}

export function getConfig(): ConfigMgmtServiceConfig {
  return {
    port: parseInt(process.env.PORT || '3023', 10),
    host: process.env.HOST || '0.0.0.0',
    logLevel: process.env.LOG_LEVEL || 'info',
    corsOrigin: process.env.CORS_ORIGIN || true,
  };
}
