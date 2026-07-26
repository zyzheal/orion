export const config = {
  port: parseInt(process.env.PORT || '3026', 10),
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://orion:orion_secret@localhost:5432/orion_notify',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:3000',
};
