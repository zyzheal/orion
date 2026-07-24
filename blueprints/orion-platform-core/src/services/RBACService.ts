import type { CreateRoleInput, Role, UpdatePermissionsInput } from '../types/core.js';
import { getPool } from '../utils/database.js';
import { getRedis } from '../utils/redis.js';

export const SYSTEM_ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MEMBER: 'member',
  VIEWER: 'viewer',
} as const;

export const DEFAULT_PERMISSIONS: Record<string, string[]> = {
  [SYSTEM_ROLES.OWNER]: ['*'],
  [SYSTEM_ROLES.ADMIN]: [
    'projects:create', 'projects:read', 'projects:update', 'projects:delete',
    'users:read', 'users:update',
    'roles:read', 'roles:update',
    'config:read', 'config:update',
    'apikeys:create', 'apikeys:read', 'apikeys:revoke',
  ],
  [SYSTEM_ROLES.MEMBER]: [
    'projects:read',
    'config:read',
  ],
  [SYSTEM_ROLES.VIEWER]: [
    'projects:read',
    'config:read',
  ],
};

export async function createRole(tenantId: string, input: CreateRoleInput): Promise<Role> {
  const pool = getPool();
  const id = crypto.randomUUID();
  const now = new Date();

  const role: Role = {
    id,
    tenantId,
    name: input.name,
    description: input.description || null,
    permissions: input.permissions,
    isSystem: false,
    createdAt: now,
    updatedAt: now,
  };

  await pool.query(
    `INSERT INTO roles (id, tenant_id, name, description, permissions, is_system, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [role.id, role.tenantId, role.name, role.description, role.permissions, role.isSystem, role.createdAt, role.updatedAt],
  );

  return role;
}

export async function listRoles(tenantId?: string): Promise<Role[]> {
  const pool = getPool();

  if (tenantId) {
    const result = await pool.query('SELECT * FROM roles WHERE tenant_id = $1 ORDER BY name', [tenantId]);
    return result.rows.map(rowToRole).filter((r): r is Role => r !== null);
  }

  const result = await pool.query('SELECT * FROM roles ORDER BY tenant_id, name');
  return result.rows.map(rowToRole).filter((r): r is Role => r !== null);
}

export async function getRole(id: string): Promise<Role | null> {
  const pool = getPool();
  const result = await pool.query('SELECT * FROM roles WHERE id = $1', [id]);
  return rowToRole(result.rows[0]) || null;
}

export async function updatePermissions(roleId: string, input: UpdatePermissionsInput): Promise<Role | null> {
  const pool = getPool();
  const role = await getRole(roleId);
  if (!role || role.isSystem) return null;

  const result = await pool.query(
    'UPDATE roles SET permissions = $1, updated_at = $2 WHERE id = $3 RETURNING *',
    [input.permissions, new Date(), roleId],
  );

  const updated = rowToRole(result.rows[0]);

  // Invalidate Redis cache
  if (updated) {
    const redis = getRedis();
    if (redis) {
      await redis.del(`rbac:role:${roleId}:permissions`);
    }
  }

  return updated;
}

export async function assignRole(userId: string, roleId: string, scope: string): Promise<boolean> {
  const pool = getPool();
  try {
    await pool.query(
      `INSERT INTO role_assignments (user_id, role_id, scope, granted_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, role_id, scope) DO NOTHING`,
      [userId, roleId, scope, new Date()],
    );
    return true;
  } catch {
    return false;
  }
}

export async function checkPermission(userId: string, permission: string, scope: string): Promise<boolean> {
  const redis = getRedis();
  const cacheKey = `rbac:perm:${userId}:${permission}:${scope}`;

  // Check cache first
  if (redis) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached !== null) {
        return cached === '1';
      }
    } catch {
      // Redis unavailable, fall through to DB
    }
  }

  // Check owner role (wildcard permission)
  const pool = getPool();
  const result = await pool.query(
    `SELECT r.permissions FROM roles r
     JOIN role_assignments ra ON ra.role_id = r.id
     WHERE ra.user_id = $1 AND ra.scope = $2`,
    [userId, scope],
  );

  let hasPermission = false;
  for (const row of result.rows) {
    const perms: string[] = row.permissions || [];
    if (perms.includes('*') || perms.includes(permission)) {
      hasPermission = true;
      break;
    }
  }

  // Cache for 5 minutes
  if (redis) {
    try {
      await redis.setex(cacheKey, 300, hasPermission ? '1' : '0');
    } catch {
      // Redis unavailable, non-critical
    }
  }

  return hasPermission;
}

function rowToRole(row: Record<string, unknown> | undefined): Role | null {
  if (!row) return null;
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    name: row.name as string,
    description: (row.description as string) || null,
    permissions: (row.permissions as string[]) || [],
    isSystem: row.is_system as boolean,
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
  };
}
