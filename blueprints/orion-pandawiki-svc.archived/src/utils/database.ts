/**
 * Database connection utility for orion-pandawiki-svc.
 */

import { Pool, type PoolConfig } from 'pg';
import { config } from '../config/index.js';

let pool: Pool | null = null;

export function getPool(): Pool {
  if (pool) {
    return pool;
  }

  const poolConfig: PoolConfig = {
    host: config.database.host,
    port: config.database.port,
    database: config.database.name,
    user: config.database.user,
    password: config.database.password,
    min: config.database.poolMin,
    max: config.database.poolMax,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  };

  pool = new Pool(poolConfig);

  pool.on('error', (err) => {
    console.error('Unexpected error on idle PostgreSQL client:', err);
  });

  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export async function initializeDatabase(): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS wiki_spaces (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        tenant_id VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS wiki_documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        space_id UUID NOT NULL REFERENCES wiki_spaces(id) ON DELETE CASCADE,
        title VARCHAR(500) NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        parent_id UUID REFERENCES wiki_documents(id) ON DELETE SET NULL,
        tags TEXT[] NOT NULL DEFAULT '{}',
        created_by VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_spaces_tenant ON wiki_spaces(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_documents_space ON wiki_documents(space_id);
      CREATE INDEX IF NOT EXISTS idx_documents_parent ON wiki_documents(parent_id);
      CREATE INDEX IF NOT EXISTS idx_documents_creator ON wiki_documents(created_by);
      CREATE INDEX IF NOT EXISTS idx_documents_search ON wiki_documents USING GIN(to_tsvector('simple', title || ' ' || content));
    `);

    await client.query(`
      CREATE OR REPLACE FUNCTION update_wiki_docs_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_wiki_docs_updated_at') THEN
          CREATE TRIGGER set_wiki_docs_updated_at
            BEFORE UPDATE ON wiki_documents
            FOR EACH ROW EXECUTE FUNCTION update_wiki_docs_updated_at();
        END IF;
      END
      $$;
    `);

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
