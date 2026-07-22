import type { CreateConfigInput, SystemConfig, UpdateConfigInput } from '../types/core.js';
import { getPool } from '../utils/database.js';
import { getRedis } from '../utils/redis.js';

export async function getConfig(key: string, scope?: string, tenantId?: string, projectId?: string): Promise<SystemConfig | null> {
  const redis = getRedis();
  const cacheKey = `config:${scope || 'global'}:${tenantId || '_'}:${projectId || '_'}:${key}`;

  // Check cache first
  if (redis) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as SystemConfig;
      }
    } catch {
      // Redis unavailable, fall through to DB
    }
  }

  const pool = getPool();
  const whereClauses = ['key = $1'];
  const values: unknown[] = [key];
  let paramIndex = 2;

  if (scope) {
    whereClauses.push(`scope = $${paramIndex++}`);
    values.push(scope);
  }

  const result = await pool.query(
    `SELECT * FROM system_configs WHERE ${whereClauses.join(' AND ')} ORDER BY
     CASE scope WHEN 'project' THEN 1 WHEN 'tenant' THEN 2 WHEN 'global' THEN 3 END
     LIMIT 1`,
    values,
  );

  const config = rowToConfig(result.rows[0]);
  if (config && redis) {
    try {
      await redis.setex(cacheKey, 300, JSON.stringify(config));
    } catch {
      // Redis unavailable, non-critical
    }
  }

  return config;
}

export async function createConfig(input: CreateConfigInput): Promise<SystemConfig> {
  const pool = getPool();
  const id = crypto.randomUUID();
  const now = new Date();

  const config: SystemConfig = {
    id,
    key: input.key,
    value: input.value,
    scope: input.scope || 'global',
    tenantId: input.tenantId || null,
    projectId: input.projectId || null,
    isEncrypted: input.isEncrypted || false,
    description: input.description || null,
    createdAt: now,
    updatedAt: now,
  };

  await pool.query(
    `INSERT INTO system_configs (id, key, value, scope, tenant_id, project_id, is_encrypted, description, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [config.id, config.key, config.value, config.scope, config.tenantId, config.projectId, config.isEncrypted, config.description, config.createdAt, config.updatedAt],
  );

  // Invalidate cache
  await invalidateConfigCache(config);

  return config;
}

export async function updateConfig(id: string, input: UpdateConfigInput): Promise<SystemConfig | null> {
  const pool = getPool();
  const existing = await getConfigById(id);
  if (!existing) return null;

  const result = await pool.query(
    'UPDATE system_configs SET value = $1, description = COALESCE($2, description), updated_at = $3 WHERE id = $4 RETURNING *',
    [input.value, input.description, new Date(), id],
  );

  const updated = rowToConfig(result.rows[0]);

  // Invalidate cache
  if (updated) {
    await invalidateConfigCache(updated);
  }

  return updated;
}

export async function listConfigs(params?: {
  scope?: string;
  tenantId?: string;
  projectId?: string;
  page?: number;
  limit?: number;
}): Promise<{ configs: SystemConfig[]; total: number }> {
  const pool = getPool();
  const page = params?.page || 1;
  const limit = params?.limit || 20;
  const offset = (page - 1) * limit;

  const whereClauses: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (params?.scope) {
    whereClauses.push(`scope = $${paramIndex++}`);
    values.push(params.scope);
  }
  if (params?.tenantId) {
    whereClauses.push(`tenant_id = $${paramIndex++}`);
    values.push(params.tenantId);
  }
  if (params?.projectId) {
    whereClauses.push(`project_id = $${paramIndex++}`);
    values.push(params.projectId);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const countResult = await pool.query(`SELECT COUNT(*) FROM system_configs ${whereSql}`, values);
  const total = Number(countResult.rows[0]?.count || 0);

  const dataResult = await pool.query(
    `SELECT * FROM system_configs ${whereSql} ORDER BY key LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    [...values, limit, offset],
  );

  return {
    configs: dataResult.rows.map(rowToConfig).filter((c): c is SystemConfig => c !== null),
    total,
  };
}

export async function deleteConfig(id: string): Promise<boolean> {
  const pool = getPool();
  const config = await getConfigById(id);
  if (!config) return false;

  await pool.query('DELETE FROM system_configs WHERE id = $1', [id]);

  // Invalidate cache
  await invalidateConfigCache(config);

  return true;
}

export async function getConfigById(id: string): Promise<SystemConfig | null> {
  const pool = getPool();
  const result = await pool.query('SELECT * FROM system_configs WHERE id = $1', [id]);
  return rowToConfig(result.rows[0]) || null;
}

async function invalidateConfigCache(config: SystemConfig): Promise<void> {
  const redis = getRedis();
  if (redis) {
    try {
      const cacheKey = `config:${config.scope}:${config.tenantId || '_'}:${config.projectId || '_'}:${config.key}`;
      await redis.del(cacheKey);
    } catch {
      // Redis unavailable, non-critical
    }
  }
}

function rowToConfig(row: Record<string, unknown> | undefined): SystemConfig | null {
  if (!row) return null;
  return {
    id: row.id as string,
    key: row.key as string,
    value: row.value as string,
    scope: row.scope as SystemConfig['scope'],
    tenantId: (row.tenant_id as string) || null,
    projectId: (row.project_id as string) || null,
    isEncrypted: row.is_encrypted as boolean,
    description: (row.description as string) || null,
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
  };
}
