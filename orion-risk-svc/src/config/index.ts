/**
 * Orion Risk Assessment Service Configuration
 * 风险评估服务配置
 */

export interface RiskServiceConfig {
  port: number;
  host: string;
  logLevel: string;
  corsOrigin: string | boolean;
  database: {
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
    ssl: boolean;
    poolMin: number;
    poolMax: number;
  };
}

export function getConfig(): RiskServiceConfig {
  return {
    port: parseInt(process.env.PORT || '3018', 10),
    host: process.env.HOST || '0.0.0.0',
    logLevel: process.env.LOG_LEVEL || 'info',
    corsOrigin: process.env.CORS_ORIGIN || true,
    database: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      name: process.env.DB_NAME || 'orion_risk',
      user: process.env.DB_USER || 'orion',
      password: process.env.DB_PASSWORD || 'orion_password',
      ssl: process.env.DB_SSL === 'true',
      poolMin: parseInt(process.env.DB_POOL_MIN || '2', 10),
      poolMax: parseInt(process.env.DB_POOL_MAX || '20', 10),
    },
  };
}

export function getDatabaseUrl(config: RiskServiceConfig): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  const { host, port, name, user, password, ssl } = config.database;
  const sslParam = ssl ? '?sslmode=require' : '';
  return `postgresql://${user}:${password}@${host}:${port}/${name}${sslParam}`;
}
