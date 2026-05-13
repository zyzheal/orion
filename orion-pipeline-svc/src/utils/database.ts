import { Pool, PoolConfig } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';

export type DatabasePool = Pool;

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
  const db = getPool();

  // Create migrations tracking table if not exists
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(50) PRIMARY KEY,
      applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);

  // Get list of applied migrations
  const appliedResult = await db.query('SELECT version FROM schema_migrations');
  const appliedMigrations = new Set(appliedResult.rows.map(r => r.version));

  // Get migration files
  const migrationsDir = join(process.cwd(), 'db', 'migrations');
  let migrationFiles: string[] = [];

  try {
    const { readdirSync } = await import('fs');
    migrationFiles = readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();
  } catch (err) {
    console.log('[database] No migrations directory found, skipping');
    return;
  }

  // Apply pending migrations
  for (const file of migrationFiles) {
    const version = file.replace('.sql', '');
    if (!appliedMigrations.has(version)) {
      console.log(`[database] Applying migration: ${file}`);
      try {
        const sql = readFileSync(join(migrationsDir, file), 'utf-8');
        await db.query(sql);
        await db.query('INSERT INTO schema_migrations (version) VALUES ($1)', [version]);
        console.log(`[database] Migration ${file} applied successfully`);
      } catch (err) {
        console.error(`[database] Migration ${file} failed:`, err);
        throw err;
      }
    }
  }

  console.log('[database] Migrations complete');
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
