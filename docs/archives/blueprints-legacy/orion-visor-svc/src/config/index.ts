export const config = {
  port: parseInt(process.env.PORT || '3032', 10),
  host: process.env.HOST || '0.0.0.0',
  logLevel: process.env.LOG_LEVEL || 'info',
  visor: {
    url: process.env.VISOR_URL || 'http://localhost:8080',
    timeout: parseInt(process.env.VISOR_TIMEOUT || '60000', 10),
    apiKey: process.env.VISOR_API_KEY || '',
  },
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'orion_visorsvc',
    user: process.env.DB_USER || 'orion',
    password: process.env.DB_PASSWORD || '',
  },
  nats: {
    servers: (process.env.NATS_SERVERS || 'nats://localhost:4222').split(','),
    user: process.env.NATS_USER,
    pass: process.env.NATS_PASS,
  },
};
