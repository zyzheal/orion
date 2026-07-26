import { Pool } from 'pg';
export type DatabasePool = Pool;
let pool: Pool | null = null;
export function getPool(): Pool {
  if (!pool) { pool = new Pool({ connectionString: process.env.DATABASE_URL }); }
  return pool;
}
export async function closePool(): Promise<void> { if (pool) { await pool.end(); pool = null; } }
export async function checkHealth(): Promise<{ status: string }> {
  try { await getPool().query('SELECT 1'); return { status: 'up' }; } catch { return { status: 'down' }; }
}
