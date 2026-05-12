import { Pool, PoolConfig } from 'pg';

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    const config: PoolConfig = {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' } : undefined,
      max: parseInt(process.env.DB_MAX_CONNECTIONS || '20', 10),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    };
    pool = new Pool(config);
    pool.on('error', (err) => {
      console.error('[database] Unexpected error on idle client:', err);
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

export async function runMigrations(): Promise<void> {
  // Placeholder: actual migrations would be defined in a migrations/ directory
  console.log('[database] Migrations would run here');
}

export async function checkHealth(): Promise<{ status: string; message?: string }> {
  try {
    const p = getPool();
    await p.query('SELECT 1');
    return { status: 'up' };
  } catch (error) {
    return { status: 'down', message: (error as Error).message };
  }
}
