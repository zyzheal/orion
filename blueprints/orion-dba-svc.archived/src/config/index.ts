export const config = {
  port: parseInt(process.env.PORT || '3031', 10),
  host: process.env.HOST || '0.0.0.0',
  logLevel: process.env.LOG_LEVEL || 'info',
  yearning: {
    url: process.env.YEARNING_URL || 'http://localhost:8000',
    timeout: parseInt(process.env.YEARNING_TIMEOUT || '60000', 10),
    apiKey: process.env.YEARNING_API_KEY || '',
  },
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'orion_dba',
    user: process.env.DB_USER || 'orion',
    password: process.env.DB_PASSWORD || '',
  },
  nats: {
    servers: (process.env.NATS_SERVERS || 'nats://localhost:4222').split(','),
    user: process.env.NATS_USER,
    pass: process.env.NATS_PASS,
  },
};
