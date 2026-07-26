/**
 * PostgreSQL Connection Pool
 * 数据库连接池管理
 */

import { Pool, PoolConfig, QueryResult, QueryResultRow } from 'pg';
import { getConfig } from '../config/index.js';

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    const config = getConfig();
    const poolConfig: PoolConfig = {
      host: config.database.host,
      port: config.database.port,
      database: config.database.name,
      user: config.database.user,
      password: config.database.password,
      ssl: config.database.ssl ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' } : false,
      min: config.database.poolMin,
      max: config.database.poolMax,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    };

    pool = new Pool(poolConfig);

    pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
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

export async function query<T extends QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  const start = Date.now();
  try {
    const result = await getPool().query<T>(text, params);
    const duration = Date.now() - start;
    if (process.env.LOG_LEVEL === 'debug') {
      console.debug(`Executed query in ${duration}ms`, { text, params });
    }
    return result;
  } catch (error) {
    console.error('Database query error', { text, params, error });
    throw error;
  }
}

/**
 * Initialize database tables (CREATE TABLE IF NOT EXISTS)
 */
export async function initializeDatabase(): Promise<void> {
  const ddl = `
    -- 风险评估表
    CREATE TABLE IF NOT EXISTS risk_assessments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      description TEXT,
      entity_type VARCHAR(100) NOT NULL,
      entity_id VARCHAR(255) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'draft',
      assessor_id VARCHAR(255) NOT NULL,
      tenant_id VARCHAR(255) NOT NULL,
      metadata JSONB NOT NULL DEFAULT '{}',
      completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_assessments_entity ON risk_assessments(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_assessments_status ON risk_assessments(status);
    CREATE INDEX IF NOT EXISTS idx_assessments_tenant ON risk_assessments(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_assessments_assessor ON risk_assessments(assessor_id);

    -- 风险评分表
    CREATE TABLE IF NOT EXISTS risk_scores (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      entity_type VARCHAR(100) NOT NULL,
      entity_id VARCHAR(255) NOT NULL,
      total_score INTEGER NOT NULL DEFAULT 0,
      dimension_scores JSONB NOT NULL DEFAULT '{}',
      risk_level VARCHAR(20) NOT NULL DEFAULT 'low',
      comment TEXT,
      assessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_scores_entity ON risk_scores(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_scores_level ON risk_scores(risk_level);
    CREATE INDEX IF NOT EXISTS idx_scores_expires ON risk_scores(expires_at);

    -- 风险事件表
    CREATE TABLE IF NOT EXISTS risk_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      assessment_id UUID NOT NULL REFERENCES risk_assessments(id) ON DELETE CASCADE,
      category VARCHAR(30) NOT NULL,
      level VARCHAR(20) NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      impact TEXT NOT NULL,
      impact_score INTEGER NOT NULL DEFAULT 1,
      probability_score INTEGER NOT NULL DEFAULT 1,
      risk_value INTEGER NOT NULL DEFAULT 1,
      recommendation TEXT,
      assignee_id VARCHAR(255),
      status VARCHAR(20) NOT NULL DEFAULT 'identified',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_events_assessment ON risk_events(assessment_id);
    CREATE INDEX IF NOT EXISTS idx_events_category ON risk_events(category);
    CREATE INDEX IF NOT EXISTS idx_events_level ON risk_events(level);
    CREATE INDEX IF NOT EXISTS idx_events_status ON risk_events(status);
  `;

  await query(ddl);
  console.log('Risk Assessment Service database tables initialized successfully');
}
