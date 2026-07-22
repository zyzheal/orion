import dotenv from 'dotenv';

dotenv.config();

export const config = {
  server: {
    port: Number.parseInt(process.env.PORT || '3030', 10),
    host: process.env.HOST || '0.0.0.0',
    nodeEnv: process.env.NODE_ENV || 'development',
  },

  database: {
    host: process.env.DB_HOST || 'localhost',
    port: Number.parseInt(process.env.DB_PORT || '5432', 10),
    name: process.env.DB_NAME || 'orion_governance',
    user: process.env.DB_USER || 'orion',
    password: process.env.DB_PASSWORD || '',
    poolMin: Number.parseInt(process.env.DB_POOL_MIN || '2', 10),
    poolMax: Number.parseInt(process.env.DB_POOL_MAX || '10', 10),
  },

  auth: {
    jwtSecret: process.env.JWT_SECRET || '',
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    pretty: process.env.LOG_PRETTY === 'true',
  },

  rateLimit: {
    max: Number.parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    windowMs: Number.parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  },

  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  },

  governance: {
    strictMode: process.env.GOVERNANCE_STRICT_MODE === 'true',
    autoDeprecationDays: Number.parseInt(process.env.AUTO_DEPRECATION_DAYS || '180', 10),
  },
};

export default config;
