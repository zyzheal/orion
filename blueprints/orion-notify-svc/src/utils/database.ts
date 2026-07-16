import { Pool } from 'pg';

let pool: Pool | null = null;

export interface DatabasePool {
  query(text: string, params?: any[]): Promise<{ rows: any[]; rowCount: number }>;
}

export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is required');
    }
    pool = new Pool({
      connectionString,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false,
    });

    pool.on('error', (err) => {
      console.error('[Database] Unexpected pool error:', err);
    });
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export async function checkHealth(): Promise<{ status: 'up' | 'down'; latency?: number }> {
  try {
    const start = Date.now();
    await getPool().query('SELECT 1');
    return { status: 'up', latency: Date.now() - start };
  } catch {
    return { status: 'down' };
  }
}

export async function testConnection(): Promise<void> {
  await getPool().query('SELECT 1');
}
