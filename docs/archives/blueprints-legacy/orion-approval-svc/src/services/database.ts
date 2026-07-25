/**
 * Database Pool Service for Approval Service
 *
 * PostgreSQL connection pool management using pg.
 */

import * as pg from 'pg';

const { Pool } = pg;

export interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  poolSize?: number;
  connectionTimeout?: number;
  idleTimeout?: number;
}

export type DatabasePool = pg.Pool;

export async function createDatabasePool(config: DatabaseConfig): Promise<DatabasePool> {
  const pool = new Pool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    max: config.poolSize ?? 10,
    connectionTimeoutMillis: config.connectionTimeout ?? 5000,
    idleTimeoutMillis: config.idleTimeout ?? 10000,
  });

  pool.on('error', (err: Error) => {
    console.error('Unexpected database pool error:', err);
  });

  // Verify connection
  const client = await pool.connect();
  try {
    await client.query('SELECT NOW()');
  } finally {
    client.release();
  }

  return pool;
}
