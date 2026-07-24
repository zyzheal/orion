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

export async function testConnection(): Promise<boolean> {
  const client = await getPool().connect();
  try {
    await client.query('SELECT NOW()');
    return true;
  } catch {
    return false;
  } finally {
    client.release();
  }
}

export async function initializeDatabase(): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS api_contracts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        api_name VARCHAR(255) NOT NULL,
        version VARCHAR(50) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'draft',
        schema JSONB NOT NULL DEFAULT '{}',
        endpoint VARCHAR(500) NOT NULL,
        method VARCHAR(10) NOT NULL,
        authentication VARCHAR(50) NOT NULL DEFAULT 'none',
        rate_limit INTEGER,
        tags TEXT[] NOT NULL DEFAULT '{}',
        owner_id VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        deprecated_at TIMESTAMP WITH TIME ZONE
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS api_versions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        contract_id UUID NOT NULL REFERENCES api_contracts(id) ON DELETE CASCADE,
        version VARCHAR(50) NOT NULL,
        changelog TEXT NOT NULL DEFAULT '',
        status VARCHAR(50) NOT NULL DEFAULT 'planned',
        breaking_changes BOOLEAN NOT NULL DEFAULT false,
        migration_guide TEXT,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        UNIQUE(contract_id, version)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS deprecations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        contract_id UUID NOT NULL REFERENCES api_contracts(id) ON DELETE CASCADE,
        version VARCHAR(50) NOT NULL,
        reason TEXT NOT NULL,
        replacement_version VARCHAR(50),
        sunset_date TIMESTAMP WITH TIME ZONE NOT NULL,
        notification_sent BOOLEAN NOT NULL DEFAULT false,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_contracts_api_name ON api_contracts(api_name);
      CREATE INDEX IF NOT EXISTS idx_contracts_status ON api_contracts(status);
      CREATE INDEX IF NOT EXISTS idx_contracts_owner ON api_contracts(owner_id);
      CREATE INDEX IF NOT EXISTS idx_versions_contract ON api_versions(contract_id);
      CREATE INDEX IF NOT EXISTS idx_versions_status ON api_versions(status);
      CREATE INDEX IF NOT EXISTS idx_deprecations_contract ON deprecations(contract_id);
      CREATE INDEX IF NOT EXISTS idx_deprecations_status ON deprecations(status);
    `);

    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
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
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_contracts_updated_at') THEN
          CREATE TRIGGER set_contracts_updated_at BEFORE UPDATE ON api_contracts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_versions_updated_at') THEN
          CREATE TRIGGER set_versions_updated_at BEFORE UPDATE ON api_versions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_deprecations_updated_at') THEN
          CREATE TRIGGER set_deprecations_updated_at BEFORE UPDATE ON deprecations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
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
