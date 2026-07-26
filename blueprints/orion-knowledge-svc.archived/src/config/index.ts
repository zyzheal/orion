/**
 * Configuration module for the Knowledge Service
 */

interface AppConfig {
  port: number;
  nodeEnv: string;
  logLevel: string;
  databaseUrl: string;
  dbMaxConnections: number;
  natsServers: string;
  eventBusEnabled: boolean;
  vectorDimension: number;
  vectorDistanceMetric: 'cosine' | 'euclidean' | 'dot_product';
  ragTopK: number;
  ragScoreThreshold: number;
  corsOrigin: string;
}

function loadConfig(): AppConfig {
  return {
    port: parseInt(process.env.PORT || '3020', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info',
    databaseUrl: process.env.DATABASE_URL || '',
    dbMaxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20', 10),
    natsServers: process.env.NATS_SERVERS || 'nats://localhost:4222',
    eventBusEnabled: process.env.EVENT_BUS_ENABLED === 'true',
    vectorDimension: parseInt(process.env.VECTOR_DIMENSION || '1536', 10),
    vectorDistanceMetric: (process.env.VECTOR_DISTANCE_METRIC || 'cosine') as 'cosine' | 'euclidean' | 'dot_product',
    ragTopK: parseInt(process.env.RAG_TOP_K || '5', 10),
    ragScoreThreshold: parseFloat(process.env.RAG_SCORE_THRESHOLD || '0.7'),
    corsOrigin: process.env.CORS_ORIGIN || '*',
  };
}

const config = loadConfig();

export { config };
export type { AppConfig };
