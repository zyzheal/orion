import type { User, CreateUserInput, UpdateUserInput } from '../types/core.js';
import { getPool } from '../utils/database.js';
import { getEventPublisher } from '../utils/eventBus.js';

export const UserEvents = {
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  USER_DISABLED: 'user.disabled',
} as const;

export async function createUser(tenantId: string, input: CreateUserInput): Promise<User> {
  const pool = getPool();
  const id = crypto.randomUUID();
  const now = new Date();

  const user: User = {
    id,
    tenantId,
    email: input.email,
    name: input.name || null,
    avatarUrl: input.avatarUrl || null,
    status: 'active',
    metadata: input.metadata || {},
    createdAt: now,
    updatedAt: now,
  };

  await pool.query(
    `INSERT INTO users (id, tenant_id, email, name, avatar_url, status, metadata, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [user.id, user.tenantId, user.email, user.name, user.avatarUrl, user.status, JSON.stringify(user.metadata), user.createdAt, user.updatedAt],
  );

  const publisher = await getEventPublisher();
  await publisher.publish(UserEvents.USER_CREATED, JSON.stringify({ id, tenantId, email: user.email }));

  return user;
}

export async function getUser(id: string): Promise<User | null> {
  const pool = getPool();
  const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  return rowToUser(result.rows[0]) || null;
}

export async function getUserByEmail(tenantId: string, email: string): Promise<User | null> {
  const pool = getPool();
  const result = await pool.query('SELECT * FROM users WHERE tenant_id = $1 AND email = $2', [tenantId, email]);
  return rowToUser(result.rows[0]) || null;
}

export async function listUsers(params: {
  tenantId: string;
  status?: string;
  page?: number;
  limit?: number;
}): Promise<{ users: User[]; total: number }> {
  const pool = getPool();
  const page = params.page || 1;
  const limit = params.limit || 20;
  const offset = (page - 1) * limit;

  const whereClauses = ['tenant_id = $1'];
  const values: unknown[] = [params.tenantId];
  let paramIndex = 2;

  if (params.status) {
    whereClauses.push(`status = $${paramIndex++}`);
    values.push(params.status);
  }

  const whereSql = whereClauses.join(' AND ');

  const countResult = await pool.query(`SELECT COUNT(*) FROM users WHERE ${whereSql}`, values);
  const total = Number(countResult.rows[0].count);

  const dataResult = await pool.query(
    `SELECT * FROM users WHERE ${whereSql} ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    [...values, limit, offset],
  );

  return {
    users: dataResult.rows.map(rowToUser).filter((u): u is User => u !== null),
    total,
  };
}

export async function updateUser(id: string, input: UpdateUserInput): Promise<User | null> {
  const pool = getPool();
  const existing = await getUser(id);
  if (!existing) return null;

  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (input.name !== undefined) {
    updates.push(`name = $${paramIndex++}`);
    values.push(input.name);
  }
  if (input.avatarUrl !== undefined) {
    updates.push(`avatar_url = $${paramIndex++}`);
    values.push(input.avatarUrl);
  }
  if (input.status !== undefined) {
    updates.push(`status = $${paramIndex++}`);
    values.push(input.status);
  }
  if (input.metadata !== undefined) {
    updates.push(`metadata = $${paramIndex++}`);
    values.push(JSON.stringify(input.metadata));
  }

  updates.push(`updated_at = $${paramIndex++}`);
  values.push(new Date());

  values.push(id);
  const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;

  const result = await pool.query(sql, values);
  const updated = rowToUser(result.rows[0]);

  if (updated) {
    const publisher = await getEventPublisher();
    await publisher.publish(UserEvents.USER_UPDATED, JSON.stringify({ id: updated.id, tenantId: updated.tenantId }));
  }

  return updated;
}

export async function disableUser(id: string): Promise<boolean> {
  return updateUser(id, { status: 'disabled' }).then(Boolean);
}

function rowToUser(row: Record<string, unknown> | undefined): User | null {
  if (!row) return null;
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    email: row.email as string,
    name: (row.name as string) || null,
    avatarUrl: (row.avatar_url as string) || null,
    status: row.status as User['status'],
    metadata: (row.metadata as Record<string, unknown>) || {},
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
  };
}
