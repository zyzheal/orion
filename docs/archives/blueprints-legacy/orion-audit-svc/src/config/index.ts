import dotenv from 'dotenv';

dotenv.config();

export const config = {
  server: {
    port: parseInt(process.env.PORT || '3027', 10),
    host: process.env.HOST || '0.0.0.0',
    nodeEnv: process.env.NODE_ENV || 'development',
  },

  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    name: process.env.DB_NAME || 'orion_audit',
    user: process.env.DB_USER || 'orion',
    password: process.env.DB_PASSWORD || '',
    ssl: process.env.DB_SSL === 'true',
    poolMin: parseInt(process.env.DB_POOL_MIN || '2', 10),
    poolMax: parseInt(process.env.DB_POOL_MAX || '20', 10),
  },

  audit: {
    chainGenesisHash:
      process.env.AUDIT_CHAIN_GENESIS_HASH ||
      '0000000000000000000000000000000000000000000000000000000000000000',
    hashAlgorithm: process.env.AUDIT_HASH_ALGORITHM || 'sha256',
  },

  security: {
    apiSecret: process.env.API_SECRET || '',
    jwtSecret: process.env.JWT_SECRET || '',
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '1000', 10),
    rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '60000', 10),
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    pretty: process.env.LOG_PRETTY === 'true',
  },

  compliance: {
    evaluationTimeout: parseInt(process.env.COMPLIANCE_EVALUATION_TIMEOUT || '30000', 10),
    reportRetentionDays: parseInt(process.env.COMPLIANCE_REPORT_RETENTION_DAYS || '365', 10),
  },
};

export function getDatabaseUrl(): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  const { host, port, name, user, password, ssl } = config.database;
  const sslParam = ssl ? '?sslmode=require' : '';
  return `postgresql://${user}:${password}@${host}:${port}/${name}${sslParam}`;
}
