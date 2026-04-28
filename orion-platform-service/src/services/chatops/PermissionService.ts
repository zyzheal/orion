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

import { DatabasePool } from '../../services/database';

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
  private db: DatabasePool;
  // 角色权限缓存 (带 TTL)
  private rolePermsCache: Map<string, { perms: string[]; expiresAt: number }> = new Map();
  // SE-7 修复: TTL 从 60 秒降低到 10 秒，减少缓存不一致窗口
  // 注意: 当 PermissionService 被实际使用时，需在 RBAC 变更处调用 invalidateCache()
  private readonly CACHE_TTL_MS = 10_000; // 10 秒

  constructor(db: DatabasePool) {
    this.db = db;
  }

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
      const result = await this.db.query(
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
      console.warn(`[PermissionService] Failed to query permissions for role ${roleName}:`, err);
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
  async checkResourceLevel(userId: string, resourceType: string, resourceId: string): Promise<PermissionCheckResult> {
    try {
      const result = await this.db.query(
        `SELECT 1 FROM user_resources
         WHERE user_id = $1 AND resource_type = $2 AND resource_id = $3
         LIMIT 1`,
        [userId, resourceType, resourceId],
      );

      if (result.rowCount === 0) {
        return { allowed: false, reason: `无权访问资源: ${resourceType}/${resourceId}`, deniedAt: 'resource_level' };
      }

      return { allowed: true };
    } catch (err) {
      console.warn('[PermissionService] Resource level check failed:', err);
      return { allowed: false, reason: '资源权限校验失败', deniedAt: 'resource_level' };
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
      await this.db.query(
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
      console.warn('[PermissionService] Failed to write audit log:', err);
    }
  }
}
