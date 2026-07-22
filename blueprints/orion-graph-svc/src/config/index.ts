/**
 * Graph Service - Configuration
 *
 * Wraps Neo4j knowledge graph and service topology behind HTTP API.
 * Provides graph queries, node/relationship management, and topology discovery.
 */

function requireEnv(name: string, fallback?: string): string {
  const value = process.env[name] || fallback;
  if (!value && process.env.NODE_ENV === 'production') {
    throw new Error(`${name} is required in production`);
  }
  return value || '';
}

export const config = {
  port: parseInt(process.env.PORT || '3035', 10),
  host: process.env.HOST || '0.0.0.0',
  logLevel: process.env.LOG_LEVEL || 'info',
  neo4j: {
    uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
    user: process.env.NEO4J_USER || 'neo4j',
    password: requireEnv('NEO4J_PASSWORD', 'password'),
    database: process.env.NEO4J_DATABASE || 'neo4j',
  },
  nats: {
    servers: (process.env.NATS_SERVERS || 'nats://localhost:4222').split(','),
    user: process.env.NATS_USER,
    pass: process.env.NATS_PASS,
  },
};
