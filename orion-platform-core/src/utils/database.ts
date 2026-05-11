import type { Pool } from 'pg';

let _pool: Pool | null = null;

/**
 * 获取 PostgreSQL 连接池 (单例)
 */
export function getPool(): Pool {
  if (!_pool) {
    throw new Error(
      'Database pool not initialized. Call initDatabase() before using getPool().',
    );
  }
  return _pool;
}

/**
 * 初始化数据库连接池
 */
export async function initDatabase(connectionString: string, ssl = false): Promise<Pool> {
  const { Pool: PgPool } = await import('pg');

  _pool = new PgPool({
    connectionString,
    ssl: ssl ? { rejectUnauthorized: false } : false,
    max: Number(process.env.DB_MAX_CONNECTIONS) || 20,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  _pool.on('error', (err) => {
    console.error('Unexpected database pool error', err);
  });

  return _pool;
}

/**
 * 关闭数据库连接池
 */
export async function closeDatabase(): Promise<void> {
  if (_pool) {
    await _pool.end();
    _pool = null;
  }
}

/**
 * 运行迁移脚本
 */
export async function runMigrations(migrationsDir?: string): Promise<void> {
  const fs = await import('node:fs/promises');
  const path = await import('node:path');

  const dir = migrationsDir || path.join(process.cwd(), 'migrations');

  let files: string[];
  try {
    files = await fs.readdir(dir);
  } catch {
    console.warn(`Migrations directory not found: ${dir}`);
    return;
  }

  const migrationFiles = files
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const pool = getPool();

  for (const file of migrationFiles) {
    const filePath = path.join(dir, file);
    const sql = await fs.readFile(filePath, 'utf-8');

    console.log(`Running migration: ${file}`);
    await pool.query(sql);
    console.log(`Migration ${file} completed`);
  }

  console.log(`All ${migrationFiles.length} migrations completed`);
}
