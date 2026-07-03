/**
 * Permission Service — 双层权限校验
 *
 * SE-7 修复: ROLE_PERMISSIONS 从数据库查询替代硬编码
 *
 * 功能:
 * 1. 命令级权限 (命令 → 权限点映射硬编码，角色权限从数据库查)
 * 2. 资源级权限 (复用 RBAC user_resources 表)
 * 3. 权限结果审计日志写入
 */

import { DatabasePool } from '../database';
import { createLogger } from '../utils/logger';
import { getCurrentTraceId } from '../../db/tenant-context-storage';

const logger = pino({ name: 'LPermission-LService' });

export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
  deniedAt?: 'command_level' | 'resource_level';
}

// 命令 → 权限点映射 (业务逻辑，保留硬编码)
const COMMAND_PERMISSION: Record<string, string> = {
  'deploy': 'chatops:deploy',
  'rollback': 'chatops:deploy',
  'restart': 'chatops:restart',
  'logs': 'chatops:read',
  'status': 'chatops:read',
  'diagnose': 'chatops:diagnose',
  'pipeline': 'chatops:read',
  'selfhealing_trigger': 'chatops:diagnose',
};

export class PermissionService {
  // 角色权限缓存 (带 TTL)
  private rolePermsCache: Map<string, { perms: string[]; expiresAt: number }> = new Map();
  // SE-7 修复: TTL 从 60 秒降低到 10 秒，减少缓存不一致窗口
  // 注意: 当 PermissionService 被实际使用时，需在 RBAC 变更处调用 invalidateCache()
  private readonly CACHE_TTL_MS = 10_000; // 10 秒

  constructor(private pool: DatabasePool) {}

  /**
   * 从数据库查询角色权限 (带缓存)
   * SE-7 修复: 不再使用硬编码 ROLE_PERMISSIONS
   */
  async getRolePermissions(roleName: string): Promise<string[]> {
    const cached = this.rolePermsCache.get(roleName);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.perms;
    }

    try {
      const result = await this.pool.query(
        `SELECT DISTINCT p.resource, p.action
         FROM role_permissions rp
         JOIN permissions p ON rp.permission_id = p.id
         JOIN roles r ON rp.role_id = r.id
         WHERE r.name = $1`,
        [roleName],
      );

      const perms = result.rows.map((row: { resource: string; action: string }) => `${row.resource}:${row.action}`);
      this.rolePermsCache.set(roleName, { perms, expiresAt: Date.now() + this.CACHE_TTL_MS });
      return perms;
    } catch (err) {
      logger.warn(`[PermissionService] Failed to query permissions for role ${roleName}:`, err);
      // 降级: 返回空权限 (拒绝所有)
      return [];
    }
  }

  /** Step 1: 命令级权限 */
  async checkCommandLevel(userId: string, userRole: string, command: string): Promise<PermissionCheckResult> {
    const requiredPerm = COMMAND_PERMISSION[command];
    if (!requiredPerm) {
      return { allowed: false, reason: '命令不存在', deniedAt: 'command_level' };
    }

    const rolePerms = await this.getRolePermissions(userRole);
    if (!rolePerms.includes(requiredPerm)) {
      return { allowed: false, reason: `缺少权限: ${requiredPerm}`, deniedAt: 'command_level' };
    }

    return { allowed: true };
  }

  /** Step 2: 资源级权限 */
  async checkResourceLevel(userId: string, resourceType: string, resourceId: string, action?: string): Promise<PermissionCheckResult> {
    try {
      const conditions = ['user_id = $1', 'resource_type = $2', 'resource_id = $3'];
      const params: any[] = [userId, resourceType, resourceId];

      if (action) {
        conditions.push(`action = $${params.length + 1}`);
        params.push(action);
      }

      const result = await this.pool.query(
        `SELECT 1 FROM user_resources
         WHERE ${conditions.join(' AND ')}
         LIMIT 1`,
        params,
      );

      if (result.rowCount === 0) {
        return { allowed: false, reason: `无权访问资源: ${resourceType}/${resourceId}`, deniedAt: 'resource_level' };
      }

      return { allowed: true };
    } catch (err) {
      logger.warn('[PermissionService] Resource level check failed:', err);
      return { allowed: false, reason: '资源权限校验失败', deniedAt: 'resource_level' };
    }
  }

  /**
   * Capability 权限检查 — 用于 ChatOps 命令执行前校验
   * 检查用户是否有权限执行某个命令（通过 Capability 映射）
   */
  async checkCommandPermission(userId: string, command: string, environment?: string): Promise<{
    allowed: boolean;
    capability?: string;
    riskLevel?: number;
    requiresApproval?: boolean;
    reason?: string;
  }> {
    try {
      // 1. 获取命令的 Capability 映射
      const mappingResult = await this.pool.query(
        `SELECT cm.*, ac.enabled, ac.approvers, ac.threshold
         FROM chatops_capability_mappings cm
         LEFT JOIN chatops_approval_configs ac ON cm.capability_id = ac.capability
         WHERE cm.command_id = $1 AND (cm.environment = $2 OR cm.environment IS NULL)
         ORDER BY cm.environment DESC NULLS LAST
         LIMIT 1`,
        [command, environment || null]
      );

      if (!mappingResult.rows[0]) {
        return { allowed: false, reason: '命令未配置能力映射' };
      }

      const mapping = mappingResult.rows[0];

      // 2. 获取用户角色
      const userRolesResult = await this.pool.query(
        `SELECT r.name FROM roles r
         JOIN user_roles ur ON r.id = ur.role_id
         WHERE ur.user_id = $1`,
        [userId]
      );

      if (userRolesResult.rows.length === 0) {
        return { allowed: false, reason: '用户无角色' };
      }

      // 3. 检查用户角色是否有该 capability 的权限
      const roleNames = userRolesResult.rows.map((r: any) => r.name);
      const permResult = await this.pool.query(
        `SELECT 1 FROM chatops_command_permissions cp
         JOIN chatops_command_role_assignments cra ON cp.id = cra.command_permission_id
         JOIN chatops_roles r ON cra.role_id = r.id
         WHERE cp.capability = $1 AND r.name = ANY($2)
         LIMIT 1`,
        [mapping.capability_id, roleNames]
      );

      if (permResult.rowCount === 0) {
        // 检查是否为超管角色
        if (roleNames.includes('admin') || roleNames.includes('super_admin')) {
          return {
            allowed: true,
            capability: mapping.capability_id,
            riskLevel: mapping.risk_level,
            requiresApproval: mapping.requires_approval,
          };
        }
        return {
          allowed: false,
          capability: mapping.capability_id,
          riskLevel: mapping.risk_level,
          requiresApproval: mapping.requires_approval,
          reason: `缺少 Capability 权限: ${mapping.capability_id}`,
        };
      }

      return {
        allowed: true,
        capability: mapping.capability_id,
        riskLevel: mapping.risk_level,
        requiresApproval: mapping.requires_approval,
      };
    } catch (err) {
      logger.warn('[PermissionService] Capability check failed:', err);
      return { allowed: false, reason: 'Capability 权限检查失败' };
    }
  }

  /**
   * 获取用户可执行的命令列表
   */
  async getUserAllowedCommands(userId: string): Promise<string[]> {
    try {
      const userRolesResult = await this.pool.query(
        `SELECT r.name FROM roles r
         JOIN user_roles ur ON r.id = ur.role_id
         WHERE ur.user_id = $1`,
        [userId]
      );

      if (userRolesResult.rows.length === 0) return [];

      const roleNames = userRolesResult.rows.map((r: any) => r.name);

      // 超管可执行所有命令
      if (roleNames.includes('admin') || roleNames.includes('super_admin')) {
        const allResult = await this.pool.query('SELECT DISTINCT command_id FROM chatops_capability_mappings');
        return allResult.rows.map((r: any) => r.command_id);
      }

      const result = await this.pool.query(
        `SELECT DISTINCT cp.command FROM chatops_command_permissions cp
         JOIN chatops_command_role_assignments cra ON cp.id = cra.command_permission_id
         JOIN chatops_roles r ON cra.role_id = r.id
         WHERE r.name = ANY($1)`,
        [roleNames]
      );

      return result.rows.map((r: any) => r.command);
    } catch {
      return [];
    }
  }

  /**
   * 串联校验: 命令级 → 资源级
   * 校验结果自动写入审计日志
   */
  async check(
    userId: string,
    userRole: string,
    command: string,
    resourceType?: string,
    resourceId?: string,
  ): Promise<PermissionCheckResult> {
    // Step 1: 命令级
    const cmdResult = await this.checkCommandLevel(userId, userRole, command);
    if (!cmdResult.allowed) {
      await this.writeAuditLog(userId, command, cmdResult, resourceType, resourceId);
      return cmdResult;
    }

    // Step 2: 资源级 (可选)
    if (resourceType && resourceId) {
      const resResult = await this.checkResourceLevel(userId, resourceType, resourceId);
      await this.writeAuditLog(userId, command, resResult, resourceType, resourceId);
      return resResult;
    }

    return { allowed: true };
  }

  /** 清除缓存 (在权限变更后调用) */
  invalidateCache(roleName?: string): void {
    if (roleName) {
      this.rolePermsCache.delete(roleName);
    } else {
      this.rolePermsCache.clear();
    }
  }

  /** 写入审计日志 */
  private async writeAuditLog(
    userId: string,
    command: string,
    result: PermissionCheckResult,
    resourceType?: string,
    resourceId?: string,
  ): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO chatops_audit_logs (actor, command, result, resource_type, resource_id, timestamp)
         VALUES ($1::jsonb, $2, $3, $4, $5, NOW())`,
        [
          JSON.stringify({ userId }),
          command,
          result.allowed ? 'allowed' : `denied: ${result.reason}`,
          resourceType || null,
          resourceId || null,
        ],
      );
    } catch (err) {
      logger.warn('[PermissionService] Failed to write audit log:', err);
    }
  }

  // ==================== Role Management CRUD ====================

  async getAllRoles(): Promise<any[]> {
    const roles = await this.pool.query(
      `SELECT r.id, r.name, r.description, r.created_at, r.updated_at,
              COUNT(DISTINCT cp.id) as command_count,
              COUNT(DISTINCT ur.user_id) as user_count
       FROM chatops_roles r
       LEFT JOIN chatops_command_role_assignments cra ON r.id = cra.role_id
       LEFT JOIN chatops_command_permissions cp ON cra.command_permission_id = cp.id
       LEFT JOIN chatops_user_roles ur ON r.id = ur.role_id
       GROUP BY r.id
       ORDER BY r.name`
    );

    const results: any[] = [];
    for (const row of roles.rows) {
      const perms = await this.pool.query(
        'SELECT permission FROM chatops_role_permissions WHERE role_id = $1 ORDER BY permission',
        [row.id]
      );
      results.push({
        ...row,
        permissions: perms.rows.map((r: any) => r.permission),
      });
    }
    return results;
  }

  async getRoleById(id: string): Promise<any | null> {
    const result = await this.pool.query('SELECT * FROM chatops_roles WHERE id = $1', [id]);
    if (!result.rows[0]) return null;
    const perms = await this.pool.query(
      'SELECT permission FROM chatops_role_permissions WHERE role_id = $1',
      [id]
    );
    return { ...result.rows[0], permissions: perms.rows.map((r: any) => r.permission) };
  }

  async createRole(input: { name: string; description?: string; permissions?: string[] }): Promise<any> {
    const { v4: uuidv4 } = await import('uuid');
    const id = uuidv4();
    const now = new Date();

    await this.pool.query(
      `INSERT INTO chatops_roles (id, name, description, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)`,
      [id, input.name, input.description || '', now, now]
    );

    if (input.permissions?.length) {
      for (const perm of input.permissions) {
        await this.pool.query(
          `INSERT INTO chatops_role_permissions (id, role_id, permission) VALUES ($1, $2, $3)`,
          [uuidv4(), id, perm]
        );
      }
    }

    this.invalidateCache();
    return this.getRoleById(id);
  }

  async updateRole(id: string, input: { name?: string; description?: string; permissions?: string[] }): Promise<any | null> {
    const existing = await this.getRoleById(id);
    if (!existing) return null;

    const { v4: uuidv4 } = await import('uuid');
    const updates: string[] = [];
    const params: any[] = [];
    let pi = 1;

    if (input.name !== undefined) { updates.push(`name = $${pi++}`); params.push(input.name); }
    if (input.description !== undefined) { updates.push(`description = $${pi++}`); params.push(input.description); }

    if (updates.length > 0) {
      updates.push(`updated_at = $${pi++}`);
      params.push(new Date(), id);
      await this.pool.query(
        `UPDATE chatops_roles SET ${updates.join(', ')} WHERE id = $${pi}`,
        params
      );
    }

    if (input.permissions !== undefined) {
      await this.pool.query('DELETE FROM chatops_role_permissions WHERE role_id = $1', [id]);
      for (const perm of input.permissions) {
        await this.pool.query(
          `INSERT INTO chatops_role_permissions (id, role_id, permission) VALUES ($1, $2, $3)`,
          [uuidv4(), id, perm]
        );
      }
    }

    this.invalidateCache();
    return this.getRoleById(id);
  }

  async deleteRole(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM chatops_roles WHERE id = $1', [id]);
    if (result.rowCount ?? 0 > 0) {
      this.invalidateCache();
      return true;
    }
    return false;
  }

  // ==================== Command Permission CRUD ====================

  async getAllCommandPermissions(): Promise<any[]> {
    const result = await this.pool.query(
      `SELECT cp.*,
              COALESCE(ARRAY_AGG(DISTINCT cra.role_id) FILTER (WHERE cra.role_id IS NOT NULL), ARRAY[]::text[]) as assigned_roles
       FROM chatops_command_permissions cp
       LEFT JOIN chatops_command_role_assignments cra ON cp.id = cra.command_permission_id
       GROUP BY cp.id
       ORDER BY cp.command`
    );
    return result.rows;
  }

  async getCommandPermission(id: string): Promise<any | null> {
    const result = await this.pool.query(
      `SELECT cp.*,
              COALESCE(ARRAY_AGG(DISTINCT cra.role_id) FILTER (WHERE cra.role_id IS NOT NULL), ARRAY[]::text[]) as assigned_roles
       FROM chatops_command_permissions cp
       LEFT JOIN chatops_command_role_assignments cra ON cp.id = cra.command_permission_id
       WHERE cp.id = $1 GROUP BY cp.id`,
      [id]
    );
    return result.rows[0] || null;
  }

  async createCommandPermission(input: {
    command: string; description?: string; capability: string;
    risk_level?: number; requires_approval?: boolean; role_ids?: string[];
  }): Promise<any> {
    const { v4: uuidv4 } = await import('uuid');
    const id = uuidv4();
    const now = new Date();

    await this.pool.query(
      `INSERT INTO chatops_command_permissions (id, command, description, capability, risk_level, requires_approval, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, input.command, input.description || '', input.capability,
       input.risk_level || 1, input.requires_approval || false, now, now]
    );

    for (const rid of input.role_ids || []) {
      await this.pool.query(
        `INSERT INTO chatops_command_role_assignments (id, command_permission_id, role_id) VALUES ($1, $2, $3)`,
        [uuidv4(), id, rid]
      );
    }

    return this.getCommandPermission(id);
  }

  async updateCommandPermission(id: string, input: {
    description?: string; capability?: string; risk_level?: number;
    requires_approval?: boolean; role_ids?: string[];
  }): Promise<any | null> {
    const existing = await this.getCommandPermission(id);
    if (!existing) return null;

    const { v4: uuidv4 } = await import('uuid');
    const updates: string[] = [];
    const params: any[] = [];
    let pi = 1;

    if (input.description !== undefined) { updates.push(`description = $${pi++}`); params.push(input.description); }
    if (input.capability !== undefined) { updates.push(`capability = $${pi++}`); params.push(input.capability); }
    if (input.risk_level !== undefined) { updates.push(`risk_level = $${pi++}`); params.push(input.risk_level); }
    if (input.requires_approval !== undefined) { updates.push(`requires_approval = $${pi++}`); params.push(input.requires_approval); }

    if (updates.length > 0) {
      updates.push(`updated_at = $${pi++}`);
      params.push(new Date(), id);
      await this.pool.query(`UPDATE chatops_command_permissions SET ${updates.join(', ')} WHERE id = $${pi}`, params);
    }

    if (input.role_ids !== undefined) {
      await this.pool.query('DELETE FROM chatops_command_role_assignments WHERE command_permission_id = $1', [id]);
      for (const rid of input.role_ids) {
        await this.pool.query(
          `INSERT INTO chatops_command_role_assignments (id, command_permission_id, role_id) VALUES ($1, $2, $3)`,
          [uuidv4(), id, rid]
        );
      }
    }

    return this.getCommandPermission(id);
  }

  async deleteCommandPermission(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM chatops_command_permissions WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  // ==================== Environment Permission CRUD ====================

  async getAllEnvironmentPermissions(): Promise<any[]> {
    const envs = await this.pool.query('SELECT * FROM chatops_environment_permissions ORDER BY environment');
    const results: any[] = [];

    for (const env of envs.rows) {
      const roles = await this.pool.query(
        'SELECT role_id FROM chatops_environment_role_assignments WHERE environment_id = $1', [env.id]
      );
      const cmds = await this.pool.query(
        'SELECT command, is_denied FROM chatops_environment_commands WHERE environment_id = $1', [env.id]
      );

      results.push({
        ...env,
        assigned_roles: roles.rows.map((r: any) => r.role_id),
        allowed_commands: cmds.rows.filter((c: any) => !c.is_denied).map((c: any) => c.command),
        denied_commands: cmds.rows.filter((c: any) => c.is_denied).map((c: any) => c.command),
      });
    }
    return results;
  }

  async getEnvironmentPermission(id: string): Promise<any | null> {
    const result = await this.pool.query(
      'SELECT * FROM chatops_environment_permissions WHERE id = $1', [id]
    );
    if (!result.rows[0]) return null;

    const env = result.rows[0];
    const roles = await this.pool.query(
      'SELECT role_id FROM chatops_environment_role_assignments WHERE environment_id = $1', [id]
    );
    const cmds = await this.pool.query(
      'SELECT command, is_denied FROM chatops_environment_commands WHERE environment_id = $1', [id]
    );

    return {
      ...env,
      assigned_roles: roles.rows.map((r: any) => r.role_id),
      allowed_commands: cmds.rows.filter((c: any) => !c.is_denied).map((c: any) => c.command),
      denied_commands: cmds.rows.filter((c: any) => c.is_denied).map((c: any) => c.command),
    };
  }

  async createEnvironmentPermission(input: {
    environment: string; description?: string; rate_limit?: number;
    require_approval?: boolean; allowed_commands?: string[];
    denied_commands?: string[]; role_ids?: string[];
  }): Promise<any> {
    const { v4: uuidv4 } = await import('uuid');
    const id = uuidv4();
    const now = new Date();

    await this.pool.query(
      `INSERT INTO chatops_environment_permissions (id, environment, description, rate_limit, require_approval, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, input.environment, input.description || '', input.rate_limit || 100,
       input.require_approval || false, now, now]
    );

    for (const rid of input.role_ids || []) {
      await this.pool.query(
        `INSERT INTO chatops_environment_role_assignments (id, environment_id, role_id) VALUES ($1, $2, $3)`,
        [uuidv4(), id, rid]
      );
    }
    for (const cmd of input.allowed_commands || []) {
      await this.pool.query(
        `INSERT INTO chatops_environment_commands (id, environment_id, command, is_denied) VALUES ($1, $2, $3, false)`,
        [uuidv4(), id, cmd]
      );
    }
    for (const cmd of input.denied_commands || []) {
      await this.pool.query(
        `INSERT INTO chatops_environment_commands (id, environment_id, command, is_denied) VALUES ($1, $2, $3, true)`,
        [uuidv4(), id, cmd]
      );
    }

    return this.getEnvironmentPermission(id);
  }

  async updateEnvironmentPermission(id: string, input: {
    description?: string; rate_limit?: number; require_approval?: boolean;
    allowed_commands?: string[]; denied_commands?: string[]; role_ids?: string[];
  }): Promise<any | null> {
    const existing = await this.getEnvironmentPermission(id);
    if (!existing) return null;

    const { v4: uuidv4 } = await import('uuid');
    const updates: string[] = [];
    const params: any[] = [];
    let pi = 1;

    if (input.description !== undefined) { updates.push(`description = $${pi++}`); params.push(input.description); }
    if (input.rate_limit !== undefined) { updates.push(`rate_limit = $${pi++}`); params.push(input.rate_limit); }
    if (input.require_approval !== undefined) { updates.push(`require_approval = $${pi++}`); params.push(input.require_approval); }

    if (updates.length > 0) {
      updates.push(`updated_at = $${pi++}`);
      params.push(new Date(), id);
      await this.pool.query(`UPDATE chatops_environment_permissions SET ${updates.join(', ')} WHERE id = $${pi}`, params);
    }

    if (input.role_ids !== undefined) {
      await this.pool.query('DELETE FROM chatops_environment_role_assignments WHERE environment_id = $1', [id]);
      for (const rid of input.role_ids) {
        await this.pool.query(
          `INSERT INTO chatops_environment_role_assignments (id, environment_id, role_id) VALUES ($1, $2, $3)`,
          [uuidv4(), id, rid]
        );
      }
    }

    if (input.allowed_commands !== undefined || input.denied_commands !== undefined) {
      await this.pool.query('DELETE FROM chatops_environment_commands WHERE environment_id = $1', [id]);
      for (const cmd of input.allowed_commands || []) {
        await this.pool.query(
          `INSERT INTO chatops_environment_commands (id, environment_id, command, is_denied) VALUES ($1, $2, $3, false)`,
          [uuidv4(), id, cmd]
        );
      }
      for (const cmd of input.denied_commands || []) {
        await this.pool.query(
          `INSERT INTO chatops_environment_commands (id, environment_id, command, is_denied) VALUES ($1, $2, $3, true)`,
          [uuidv4(), id, cmd]
        );
      }
    }

    return this.getEnvironmentPermission(id);
  }

  async deleteEnvironmentPermission(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM chatops_environment_permissions WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }
}
