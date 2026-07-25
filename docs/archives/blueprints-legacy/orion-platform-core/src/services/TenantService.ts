import type { CreateTenantInput, Tenant, UpdateTenantInput } from '../types/core.js';
import { getPool } from '../utils/database.js';
import { getEventPublisher } from '../utils/eventBus.js';
import { PlatformEvents } from '../types/core.js';

export async function createTenant(input: CreateTenantInput): Promise<Tenant> {
  const pool = getPool();
  const id = crypto.randomUUID();

  const now = new Date();
  const tenant: Tenant = {
    id,
    name: input.name,
    slug: input.slug,
    status: 'active',
    plan: input.plan || 'free',
    settings: {
      maxProjects: 5,
      maxUsersPerProject: 50,
      features: [],
      metadata: {},
      ...input.settings,
    },
    createdAt: now,
    updatedAt: now,
  };

  await pool.query(
    `INSERT INTO tenants (id, name, slug, status, plan, settings, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [tenant.id, tenant.name, tenant.slug, tenant.status, tenant.plan, JSON.stringify(tenant.settings), tenant.createdAt, tenant.updatedAt],
  );

  const publisher = await getEventPublisher();
  await publisher.publish(PlatformEvents.TENANT_CREATED, JSON.stringify({ id, name: tenant.name }));

  return tenant;
}

export async function listTenants(params?: {
  page?: number;
  limit?: number;
  status?: string;
}): Promise<{ tenants: Tenant[]; total: number }> {
  const pool = getPool();
  const page = params?.page || 1;
  const limit = params?.limit || 20;
  const offset = (page - 1) * limit;

  const whereClauses: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (params?.status) {
    whereClauses.push(`status = $${paramIndex++}`);
    values.push(params.status);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const countResult = await pool.query(`SELECT COUNT(*) FROM tenants ${whereSql}`, values);
  const total = Number(countResult.rows[0]?.count || 0);

  const dataResult = await pool.query(
    `SELECT * FROM tenants ${whereSql} ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    [...values, limit, offset],
  );

  return {
    tenants: dataResult.rows.map(rowToTenant).filter((t): t is Tenant => t !== null),
    total,
  };
}

export async function getTenant(id: string): Promise<Tenant | null> {
  const pool = getPool();
  const result = await pool.query('SELECT * FROM tenants WHERE id = $1', [id]);
  return rowToTenant(result.rows[0]) || null;
}

export async function updateTenant(id: string, input: UpdateTenantInput): Promise<Tenant | null> {
  const pool = getPool();
  const existing = await getTenant(id);
  if (!existing) return null;

  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (input.name !== undefined) {
    updates.push(`name = $${paramIndex++}`);
    values.push(input.name);
  }
  if (input.status !== undefined) {
    updates.push(`status = $${paramIndex++}`);
    values.push(input.status);
  }
  if (input.plan !== undefined) {
    updates.push(`plan = $${paramIndex++}`);
    values.push(input.plan);
  }
  if (input.settings !== undefined) {
    updates.push(`settings = $${paramIndex++}`);
    values.push(JSON.stringify({ ...existing.settings, ...input.settings }));
  }

  updates.push(`updated_at = $${paramIndex++}`);
  values.push(new Date());

  values.push(id);
  const sql = `UPDATE tenants SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;

  const result = await pool.query(sql, values);
  const updated = rowToTenant(result.rows[0]);

  if (updated) {
    const publisher = await getEventPublisher();
    await publisher.publish(PlatformEvents.TENANT_UPDATED, JSON.stringify({ id, name: updated.name }));
  }

  return updated;
}

export async function suspendTenant(id: string): Promise<boolean> {
  const updated = await updateTenant(id, { status: 'suspended' });
  if (!updated) return false;

  const publisher = await getEventPublisher();
  await publisher.publish(PlatformEvents.TENANT_SUSPENDED, JSON.stringify({ id }));
  return true;
}

function rowToTenant(row: Record<string, unknown> | undefined): Tenant | null {
  if (!row) return null;
  return {
    id: row.id as string,
    name: row.name as string,
    slug: row.slug as string,
    status: row.status as Tenant['status'],
    plan: row.plan as Tenant['plan'],
    settings: (row.settings as Tenant['settings']) || { maxProjects: 5, maxUsersPerProject: 50, features: [], metadata: {} },
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
  };
}
