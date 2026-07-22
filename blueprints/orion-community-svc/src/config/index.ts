function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} environment variable is required`);
  }
  return value;
}

/**
 * Community Service 配置
 */

export const config = {
  server: {
    port: parseInt(process.env.PORT || '3029', 10),
    host: process.env.HOST || '0.0.0.0',
    logLevel: process.env.LOG_LEVEL || 'info',
    nodeEnv: process.env.NODE_ENV || 'development',
  },

  database: {
    connectionString: process.env.DATABASE_URL || 'postgresql://orion:orion_secret@localhost:5432/orion_community',
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20', 10),
    idleTimeoutMs: 30_000,
    connectionTimeoutMs: 5_000,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' } : undefined,
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  nats: {
    url: process.env.NATS_URL || 'nats://localhost:4222',
  },

  jwt: {
    secret: requireEnv('JWT_SECRET'),
  },

  cors: {
    origin: process.env.CORS_ORIGIN || '*',
  },
} as const;

export default config;
