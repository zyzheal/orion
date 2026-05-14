import { Pool, type PoolConfig, type QueryResult } from 'pg';
import { config } from '../config';

const poolConfig: PoolConfig = {
  host: config.database.host,
  port: config.database.port,
  database: config.database.database,
  user: config.database.user,
  password: config.database.password,
  ssl: config.database.ssl ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
};

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

export async function query(text: string, params?: unknown[]): Promise<QueryResult> {
  return pool.query(text, params);
}

export async function closePool(): Promise<void> {
  await pool.end();
}

export async function checkHealth(): Promise<{ status: 'up' | 'down'; latency?: number }> {
  try {
    const start = Date.now();
    await pool.query('SELECT 1');
    return { status: 'up', latency: Date.now() - start };
  } catch {
    return { status: 'down' };
  }
}

export { pool };
export type DatabasePool = typeof pool;
