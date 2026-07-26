/**
 * Config Management Service Configuration
 * 配置管理服务配置
 */

export interface ConfigMgmtServiceConfig {
  port: number;
  host: string;
  logLevel: string;
  corsOrigin: string | boolean;
  databaseUrl?: string;
}

export function getConfig(): ConfigMgmtServiceConfig {
  return {
    port: parseInt(process.env.PORT || '3024', 10),
    host: process.env.HOST || '0.0.0.0',
    logLevel: process.env.LOG_LEVEL || 'info',
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:3000',
    databaseUrl: process.env.DATABASE_URL,
  };
}
