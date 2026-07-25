/**
 * CMDB Service Configuration
 * CMDB 服务配置
 */

export interface CmdbServiceConfig {
  port: number;
  host: string;
  logLevel: string;
  corsOrigin: string | boolean;
  databaseUrl: string;
}

export function getConfig(): CmdbServiceConfig {
  return {
    port: parseInt(process.env.PORT || '3019', 10),
    host: process.env.HOST || '0.0.0.0',
    logLevel: process.env.LOG_LEVEL || 'info',
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:3000',
    databaseUrl: process.env.DATABASE_URL || 'postgresql://localhost:5432/orion_cmdb',
  };
}
