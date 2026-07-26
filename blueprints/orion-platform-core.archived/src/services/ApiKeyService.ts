import type { ApiKey, ApiKeyResponse, CreateApiKeyInput } from '../types/core.js';
import crypto from 'node:crypto';
import { getPool } from '../utils/database.js';
import { getRedis } from '../utils/redis.js';

/**
 * Generate a random API keystring
 */
function generateKey(): { raw: string; hash: string; prefix: string } {
  const raw = `orion_${crypto.randomBytes(24).toString('hex')}`;
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  const prefix = raw.slice(0, 11); // orion_xxxxx
  return { raw, hash, prefix };
}

export async function createApiKey(input: CreateApiKeyInput): Promise<ApiKeyResponse> {
  const pool = getPool();
  const id = crypto.randomUUID();
  const keyData = generateKey();
  const now = new Date();

  const apiKey: ApiKey = {
    id,
    tenantId: input.tenantId || null,
    projectId: input.projectId || null,
    name: input.name,
    keyHash: keyData.hash,
    prefix: keyData.prefix,
    scopes: input.scopes,
    expiresAt: input.expiresAt || null,
    lastUsedAt: null,
    createdAt: now,
  };

  await pool.query(
    `INSERT INTO api_keys (id, tenant_id, project_id, name, key_hash, prefix, scopes, expires_at, last_used_at, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [apiKey.id, apiKey.tenantId, apiKey.projectId, apiKey.name, apiKey.keyHash, apiKey.prefix, apiKey.scopes, apiKey.expiresAt, apiKey.lastUsedAt, apiKey.createdAt],
  );

  const response: ApiKeyResponse = {
    ...apiKey,
    key: keyData.raw,
  };

  return response;
}

export async function listApiKeys(params?: {
  tenantId?: string;
  projectId?: string;
  page?: number;
  limit?: number;
}): Promise<{ apiKeys: ApiKeyResponse[]; total: number }> {
  const pool = getPool();
  const page = params?.page || 1;
  const limit = params?.limit || 20;
  const offset = (page - 1) * limit;

  const whereClauses: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (params?.tenantId) {
    whereClauses.push(`tenant_id = $${paramIndex++}`);
    values.push(params.tenantId);
  }
  if (params?.projectId) {
    whereClauses.push(`project_id = $${paramIndex++}`);
    values.push(params.projectId);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const countResult = await pool.query(`SELECT COUNT(*) FROM api_keys ${whereSql}`, values);
  const total = Number(countResult.rows[0]?.count || 0);

  const dataResult = await pool.query(
    `SELECT * FROM api_keys ${whereSql} ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    [...values, limit, offset],
  );

  return {
    apiKeys: dataResult.rows.map((row) => rowToApiKey(row) as ApiKeyResponse),
    total,
  };
}

export async function getApiKeyById(id: string): Promise<ApiKeyResponse | null> {
  const pool = getPool();
  const result = await pool.query('SELECT * FROM api_keys WHERE id = $1', [id]);
  const row = result.rows[0];
  if (!row) return null;

  const apiKey = rowToApiKey(row);
  if (!apiKey) return null;
  // Never expose keyHash in response
  const { keyHash, ...rest } = apiKey;
  return rest as ApiKeyResponse;
}

export async function validateApiKey(key: string): Promise<ApiKey | null> {
  const hash = crypto.createHash('sha256').update(key).digest('hex');

  // Check cache first
  const redis = getRedis();
  if (redis) {
    try {
      const cached = await redis.get(`apikey:valid:${hash.slice(0, 16)}`);
      if (cached) {
        return JSON.parse(cached) as ApiKey;
      }
    } catch {
      // Redis unavailable, fall through to DB
    }
  }

  const pool = getPool();
  const result = await pool.query(
    'SELECT * FROM api_keys WHERE key_hash = $1 AND (expires_at IS NULL OR expires_at > NOW())',
    [hash],
  );

  const apiKey = rowToApiKey(result.rows[0]) || null;

  if (apiKey && redis) {
    try {
      await redis.setex(`apikey:valid:${hash.slice(0, 16)}`, 300, JSON.stringify(apiKey));
    } catch {
      // Redis unavailable, non-critical
    }
  }

  return apiKey;
}

export async function revokeApiKey(id: string): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query('DELETE FROM api_keys WHERE id = $1', [id]);
  return (result.rowCount || 0) > 0;
}

export async function recordApiKeyUsage(keyId: string): Promise<void> {
  const pool = getPool();
  await pool.query(
    'UPDATE api_keys SET last_used_at = $1 WHERE id = $2',
    [new Date(), keyId],
  );
}

function rowToApiKey(row: Record<string, unknown> | undefined): ApiKey | null {
  if (!row) return null;
  return {
    id: row.id as string,
    tenantId: (row.tenant_id as string) || null,
    projectId: (row.project_id as string) || null,
    name: row.name as string,
    keyHash: row.key_hash as string,
    prefix: row.prefix as string,
    scopes: (row.scopes as string[]) || [],
    expiresAt: (row.expires_at as Date) || null,
    lastUsedAt: (row.last_used_at as Date) || null,
    createdAt: row.created_at as Date,
  };
}
