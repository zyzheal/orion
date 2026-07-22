/**
 * CapabilityRepository - 数据库层能力操作
 */

import { DatabasePool } from '../database';

export interface Capability {
  id: string;
  capability_id: string;
  name: string;
  description: string | null;
  category: string;
  parent_capability_id: string | null;
  risk_level: number;
  requires_approval: boolean;
  approval_role: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface CapabilityRoleMapping {
  id: string;
  capability_id: string;
  role_name: string;
  granted_at: string;
  granted_by: string | null;
}

export interface CapabilityUserMapping {
  id: string;
  capability_id: string;
  user_id: string;
  granted_at: string;
  granted_by: string | null;
  expires_at: string | null;
  approval_id?: number | null;
  ticket_id?: number | null;
  reason?: string | null;
}

export interface TemporaryPermission {
  id: number;
  tenant_id: string;
  user_id: string;
  capability_id: string;
  environment_suffix: string | null;
  granted_by: string;
  approval_id: number | null;
  ticket_id: number | null;
  reason: string | null;
  granted_at: string;
  expires_at: string;
  revoked_at: string | null;
  revoked_by: string | null;
  revoke_reason: string | null;
  created_at: string;
}

export interface PermissionAuditLog {
  id: number;
  tenant_id: string;
  user_id: string;
  action: string;
  capability_id: string;
  environment_suffix: string | null;
  actor_id: string | null;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface PermissionRequestRecord {
  id: number;
  ticket_id: number;
  capability_id: string;
  environment_suffix: string | null;
  duration_hours: number;
  requested_for_user_id: string;
  capability_snapshot: Record<string, unknown> | null;
  approved_capability_mapping_id: number | null;
  status?: 'pending' | 'approved' | 'rejected';
  approved_by?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface ChatOpsCommandCapability {
  id: string;
  command_name: string;
  command_action: string;
  capability_id: string;
  environment_suffix: string | null;
}

export class CapabilityRepository {
  constructor(private pool: DatabasePool) {}

  // ==================== Capability CRUD ====================

  async findById(capabilityId: string): Promise<Capability | null> {
    const result = await this.pool.query(
      'SELECT * FROM capabilities WHERE capability_id = $1',
      [capabilityId]
    );
    return result.rows[0] || null;
  }

  async findAll(): Promise<Capability[]> {
    const result = await this.pool.query(
      'SELECT * FROM capabilities ORDER BY category, capability_id'
    );
    return result.rows;
  }

  async findByCategory(category: string): Promise<Capability[]> {
    const result = await this.pool.query(
      'SELECT * FROM capabilities WHERE category = $1 ORDER BY capability_id',
      [category]
    );
    return result.rows;
  }

  async findByParent(parentId: string | null): Promise<Capability[]> {
    const result = await this.pool.query(
      'SELECT * FROM capabilities WHERE parent_capability_id = $1 OR ($2 IS NULL AND parent_capability_id IS NULL) ORDER BY capability_id',
      [parentId, parentId]
    );
    return result.rows;
  }

  async create(data: {
    capability_id: string;
    name: string;
    description?: string;
    category: string;
    parent_capability_id?: string;
    risk_level?: number;
    requires_approval?: boolean;
    approval_role?: string;
    metadata?: Record<string, unknown>;
    created_by?: string;
  }): Promise<Capability> {
    const result = await this.pool.query(
      `INSERT INTO capabilities (capability_id, name, description, category, parent_capability_id, risk_level, requires_approval, approval_role, metadata, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        data.capability_id,
        data.name,
        data.description || null,
        data.category,
        data.parent_capability_id || null,
        data.risk_level || 1,
        data.requires_approval || false,
        data.approval_role || null,
        data.metadata || {},
        data.created_by || null,
      ]
    );
    return result.rows[0];
  }

  async update(capabilityId: string, input: {
    name?: string;
    description?: string;
    risk_level?: number;
    requires_approval?: boolean;
    approval_role?: string;
    metadata?: Record<string, unknown>;
  }): Promise<Capability | null> {
    const updates: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (input.name !== undefined) { updates.push(`name = $${idx++}`); params.push(input.name); }
    if (input.description !== undefined) { updates.push(`description = $${idx++}`); params.push(input.description); }
    if (input.risk_level !== undefined) { updates.push(`risk_level = $${idx++}`); params.push(input.risk_level); }
    if (input.requires_approval !== undefined) { updates.push(`requires_approval = $${idx++}`); params.push(input.requires_approval); }
    if (input.approval_role !== undefined) { updates.push(`approval_role = $${idx++}`); params.push(input.approval_role); }
    if (input.metadata !== undefined) { updates.push(`metadata = $${idx++}`); params.push(input.metadata); }

    if (updates.length === 0) return this.findById(capabilityId);
    updates.push(`updated_at = NOW()`);
    params.push(capabilityId);

    const result = await this.pool.query(
      `UPDATE capabilities SET ${updates.join(', ')} WHERE capability_id = $${idx} RETURNING *`,
      params
    );
    return result.rows[0] || null;
  }

  async delete(capabilityId: string): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM capabilities WHERE capability_id = $1',
      [capabilityId]
    );
    return (result.rowCount || 0) > 0;
  }

  // ==================== Role Mappings ====================

  async grantToRole(capabilityId: string, roleName: string, grantedBy?: string): Promise<CapabilityRoleMapping> {
    const result = await this.pool.query(
      `INSERT INTO capability_role_mappings (capability_id, role_name, granted_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (capability_id, role_name) DO NOTHING
       RETURNING *`,
      [capabilityId, roleName, grantedBy || null]
    );
    return result.rows[0];
  }

  async revokeFromRole(capabilityId: string, roleName: string): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM capability_role_mappings WHERE capability_id = $1 AND role_name = $2',
      [capabilityId, roleName]
    );
    return (result.rowCount || 0) > 0;
  }

  async getCapabilitiesByRole(roleName: string): Promise<string[]> {
    const result = await this.pool.query(
      'SELECT capability_id FROM capability_role_mappings WHERE role_name = $1',
      [roleName]
    );
    return result.rows.map(r => r.capability_id);
  }

  async getCapabilitiesByRoles(roleNames: string[]): Promise<string[]> {
    if (roleNames.length === 0) return [];
    const result = await this.pool.query(
      'SELECT DISTINCT capability_id FROM capability_role_mappings WHERE role_name = ANY($1)',
      [roleNames]
    );
    return result.rows.map(r => r.capability_id);
  }

  // ==================== User Mappings ====================

  async grantToUser(
    capabilityId: string,
    userId: string,
    grantedBy?: string,
    expiresAt?: Date,
    extra?: { approval_id?: number; ticket_id?: number; reason?: string }
  ): Promise<CapabilityUserMapping> {
    const result = await this.pool.query(
      `INSERT INTO capability_user_mappings (capability_id, user_id, granted_by, expires_at, approval_id, ticket_id, reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (capability_id, user_id) DO UPDATE
         SET expires_at = EXCLUDED.expires_at,
             granted_by = EXCLUDED.granted_by,
             approval_id = COALESCE(EXCLUDED.approval_id, capability_user_mappings.approval_id),
             ticket_id = COALESCE(EXCLUDED.ticket_id, capability_user_mappings.ticket_id),
             reason = COALESCE(EXCLUDED.reason, capability_user_mappings.reason)
       RETURNING *`,
      [
        capabilityId,
        userId,
        grantedBy || null,
        expiresAt || null,
        extra?.approval_id || null,
        extra?.ticket_id || null,
        extra?.reason || null,
      ]
    );
    return result.rows[0];
  }

  async revokeFromUser(capabilityId: string, userId: string): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM capability_user_mappings WHERE capability_id = $1 AND user_id = $2',
      [capabilityId, userId]
    );
    return (result.rowCount || 0) > 0;
  }

  async getCapabilitiesByUser(userId: string): Promise<string[]> {
    const result = await this.pool.query(
      `SELECT capability_id FROM capability_user_mappings
       WHERE user_id = $1 AND (expires_at IS NULL OR expires_at > NOW())`,
      [userId]
    );
    return result.rows.map(r => r.capability_id);
  }

  async getExpiredPermissions(): Promise<CapabilityUserMapping[]> {
    const result = await this.pool.query(
      'SELECT * FROM capability_user_mappings WHERE expires_at IS NOT NULL AND expires_at <= NOW()'
    );
    return result.rows;
  }

  async deleteExpiredPermissions(): Promise<number> {
    const result = await this.pool.query(
      'DELETE FROM capability_user_mappings WHERE expires_at IS NOT NULL AND expires_at <= NOW()'
    );
    return result.rowCount || 0;
  }

  // ==================== ChatOps Command Mapping ====================

  async mapCommandToCapability(
    commandName: string,
    commandAction: string,
    capabilityId: string,
    environmentSuffix?: string
  ): Promise<ChatOpsCommandCapability> {
    const result = await this.pool.query(
      `INSERT INTO chatops_command_capabilities (command_name, command_action, capability_id, environment_suffix)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (command_name, command_action, environment_suffix) DO UPDATE SET capability_id = EXCLUDED.capability_id
       RETURNING *`,
      [commandName, commandAction, capabilityId, environmentSuffix || null]
    );
    return result.rows[0];
  }

  async getCapabilityForCommand(commandName: string, commandAction: string, environment?: string): Promise<string | null> {
    // 先查找特定环境的映射
    if (environment) {
      const envSuffix = `_${environment}`;
      const result = await this.pool.query(
        `SELECT capability_id FROM chatops_command_capabilities
         WHERE command_name = $1 AND command_action = $2 AND (environment_suffix = $3 OR environment_suffix IS NULL)
         ORDER BY environment_suffix DESC NULLS LAST LIMIT 1`,
        [commandName, commandAction, envSuffix]
      );
      if (result.rows[0]) return result.rows[0].capability_id;
    }

    // 查找无环境后缀的默认映射
    const result = await this.pool.query(
      `SELECT capability_id FROM chatops_command_capabilities
       WHERE command_name = $1 AND command_action = $2 AND environment_suffix IS NULL`,
      [commandName, commandAction]
    );
    return result.rows[0]?.capability_id || null;
  }

  async getCommandsByCapability(capabilityId: string): Promise<ChatOpsCommandCapability[]> {
    const result = await this.pool.query(
      'SELECT * FROM chatops_command_capabilities WHERE capability_id = $1',
      [capabilityId]
    );
    return result.rows;
  }

  // ==================== Temporary Permissions ====================

  async grantTemporaryPermission(data: {
    tenant_id: string;
    user_id: string;
    capability_id: string;
    environment_suffix?: string;
    granted_by: string;
    approval_id?: number;
    ticket_id?: number;
    reason?: string;
    expires_at: Date;
  }): Promise<TemporaryPermission> {
    const result = await this.pool.query(
      `INSERT INTO chatops_temporary_permissions
       (tenant_id, user_id, capability_id, environment_suffix, granted_by, approval_id, ticket_id, reason, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        data.tenant_id,
        data.user_id,
        data.capability_id,
        data.environment_suffix || null,
        data.granted_by,
        data.approval_id || null,
        data.ticket_id || null,
        data.reason || null,
        data.expires_at,
      ]
    );
    return result.rows[0];
  }

  async revokeTemporaryPermission(id: number, revokedBy: string, reason?: string): Promise<TemporaryPermission | null> {
    const result = await this.pool.query(
      `UPDATE chatops_temporary_permissions
       SET revoked_at = NOW(), revoked_by = $1, revoke_reason = $2
       WHERE id = $3 AND revoked_at IS NULL
       RETURNING *`,
      [revokedBy, reason || null, id]
    );
    return result.rows[0] || null;
  }

  async revokeTemporaryPermissionsByUser(userId: string, revokedBy: string): Promise<number> {
    const result = await this.pool.query(
      `UPDATE chatops_temporary_permissions
       SET revoked_at = NOW(), revoked_by = $1, revoke_reason = '批量撤销'
       WHERE user_id = $2 AND revoked_at IS NULL`,
      [revokedBy, userId]
    );
    return result.rowCount || 0;
  }

  async getActiveTemporaryPermissions(userId: string, tenantId?: string): Promise<TemporaryPermission[]> {
    const conditions = ['revoked_at IS NULL', 'expires_at > NOW()'];
    const params: unknown[] = [userId];
    let idx = 2;

    if (tenantId) {
      conditions.push(`tenant_id = $${idx++}`);
      params.push(tenantId);
    }

    const result = await this.pool.query(
      `SELECT * FROM chatops_temporary_permissions
       WHERE user_id = $1 AND ${conditions.join(' AND ')}
       ORDER BY expires_at ASC`,
      params
    );
    return result.rows;
  }

  async getExpiredTemporaryPermissions(): Promise<TemporaryPermission[]> {
    const result = await this.pool.query(
      `SELECT * FROM chatops_temporary_permissions
       WHERE expires_at <= NOW() AND revoked_at IS NULL`
    );
    return result.rows;
  }

  async cleanupExpiredTemporaryPermissions(): Promise<TemporaryPermission[]> {
    const result = await this.pool.query(
      `UPDATE chatops_temporary_permissions
       SET revoked_at = NOW(), revoked_by = 'system', revoke_reason = '自动过期清理'
       WHERE expires_at <= NOW() AND revoked_at IS NULL
       RETURNING *`
    );
    return result.rows;
  }

  // ==================== Permission Audit Log ====================

  async createAuditLog(data: {
    tenant_id: string;
    user_id: string;
    action: string;
    capability_id: string;
    environment_suffix?: string;
    actor_id?: string;
    reason?: string;
    metadata?: Record<string, unknown>;
  }): Promise<PermissionAuditLog> {
    const result = await this.pool.query(
      `INSERT INTO permission_audit_log
       (tenant_id, user_id, action, capability_id, environment_suffix, actor_id, reason, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        data.tenant_id,
        data.user_id,
        data.action,
        data.capability_id,
        data.environment_suffix || null,
        data.actor_id || null,
        data.reason || null,
        data.metadata || null,
      ]
    );
    return result.rows[0];
  }

  async getAuditLogs(params: {
    user_id?: string;
    capability_id?: string;
    action?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ logs: PermissionAuditLog[]; total: number }> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (params.user_id) { conditions.push(`user_id = $${idx++}`); values.push(params.user_id); }
    if (params.capability_id) { conditions.push(`capability_id = $${idx++}`); values.push(params.capability_id); }
    if (params.action) { conditions.push(`action = $${idx++}`); values.push(params.action); }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await this.pool.query(
      `SELECT COUNT(*) FROM permission_audit_log ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].count, 10);

    values.push(Math.min(params.limit || 50, 200));
    values.push(params.offset || 0);
    const result = await this.pool.query(
      `SELECT * FROM permission_audit_log ${whereClause}
       ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
      values
    );

    return { logs: result.rows, total };
  }

  // ==================== Permission Requests ====================

  async createPermissionRequest(data: {
    ticket_id: number;
    capability_id: string;
    environment_suffix?: string;
    duration_hours: number;
    requested_for_user_id: string;
    capability_snapshot?: Record<string, unknown>;
  }): Promise<PermissionRequestRecord> {
    const result = await this.pool.query(
      `INSERT INTO permission_requests
       (ticket_id, capability_id, environment_suffix, duration_hours, requested_for_user_id, capability_snapshot)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        data.ticket_id,
        data.capability_id,
        data.environment_suffix || null,
        data.duration_hours,
        data.requested_for_user_id,
        data.capability_snapshot || null,
      ]
    );
    return result.rows[0];
  }

  async getPermissionRequestByTicketId(ticketId: number): Promise<PermissionRequestRecord | null> {
    const result = await this.pool.query(
      'SELECT * FROM permission_requests WHERE ticket_id = $1',
      [ticketId]
    );
    return result.rows[0] || null;
  }

  async linkApprovalToPermissionRequest(ticketId: number, mappingId: number): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE permission_requests
       SET approved_capability_mapping_id = $1
       WHERE ticket_id = $2`,
      [mappingId, ticketId]
    );
    return (result.rowCount || 0) > 0;
  }

  // ==================== User Effective Capabilities ====================

  /**
   * 获取用户所有有效能力（用户直接映射 + 角色映射 + 继承）
   * 用于 getUserEffectiveCapabilities 业务逻辑
   */
  async getUserEffectiveCapabilities(userId: string, userRoles: string[] = []): Promise<string[]> {
    const capabilities = new Set<string>();

    // 1. 获取用户直接映射的能力（未过期）
    const directResult = await this.pool.query(
      `SELECT c.capability_id
       FROM capability_user_mappings cum
       JOIN capabilities c ON c.capability_id = cum.capability_id
       WHERE cum.user_id = $1 AND cum.expires_at IS NULL OR cum.expires_at > NOW()
       AND c.enabled = true`,
      [userId]
    );
    directResult.rows.forEach(row => capabilities.add(row.capability_id));

    // 2. 获取角色映射的能力
    if (userRoles.length > 0) {
      const roleResult = await this.pool.query(
        `SELECT DISTINCT c.capability_id
         FROM capability_role_mappings crm
         JOIN capabilities c ON c.capability_id = crm.capability_id
         WHERE crm.role_name = ANY($1) AND c.enabled = true`,
        [userRoles]
      );
      roleResult.rows.forEach(row => capabilities.add(row.capability_id));

      // 3. 获取角色映射能力的父能力（继承）
      const inherited = await this.getInheritedCapabilitiesFromRoles(userRoles);
      inherited.forEach(id => capabilities.add(id));
    }

    return Array.from(capabilities);
  }

  /**
   * 从角色映射获取继承的能力（父能力）
   */
  private async getInheritedCapabilitiesFromRoles(roleNames: string[]): Promise<string[]> {
    if (roleNames.length === 0) return [];

    // 获取角色已有能力
    const roleCapsResult = await this.pool.query(
      `SELECT DISTINCT c.capability_id
       FROM capability_role_mappings crm
       JOIN capabilities c ON c.capability_id = crm.capability_id
       WHERE crm.role_name = ANY($1)`,
      [roleNames]
    );

    const capabilityIds = roleCapsResult.rows.map(r => r.capability_id);
    if (capabilityIds.length === 0) return [];

    // 递归获取父能力
    const inherited: Set<string> = new Set();
    const queue = [...capabilityIds];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const parentResult = await this.pool.query(
        'SELECT parent_capability_id FROM capabilities WHERE capability_id = $1 AND parent_capability_id IS NOT NULL',
        [currentId]
      );

      if (parentResult.rows[0]?.parent_capability_id) {
        const parentId = parentResult.rows[0].parent_capability_id;
        if (!inherited.has(parentId)) {
          inherited.add(parentId);
          queue.push(parentId);
        }
      }
    }

    return Array.from(inherited);
  }

  // ==================== Auto-Approval Rules ====================

  /**
   * 检查是否满足自动审批规则
   * 规则：
   * 1. 风险等级 1-2 的能力自动通过
   * 2. 用户已有该能力父级能力时自动通过
   * 3. 用户角色已拥有该能力时自动通过
   */
  async checkAutoApprovalRules(
    userId: string,
    capabilityId: string,
    userRoles: string[] = []
  ): Promise<{ autoApprove: boolean; reason: string }> {
    // 1. 获取能力定义
    const capResult = await this.pool.query(
      'SELECT risk_level, parent_capability_id FROM capabilities WHERE capability_id = $1',
      [capabilityId]
    );

    if (capResult.rows.length === 0) {
      return { autoApprove: false, reason: 'Capability not found' };
    }

    const { risk_level, parent_capability_id } = capResult.rows[0];

    // 规则1: 风险等级 1-2 自动通过
    if (risk_level <= 2) {
      return { autoApprove: true, reason: 'Low risk capability (auto-approved)' };
    }

    // 规则2: 检查用户是否已有父能力
    if (parent_capability_id) {
      const parentCapResult = await this.pool.query(
        `SELECT 1 FROM capability_user_mappings cum
         JOIN capabilities c ON c.capability_id = cum.capability_id
         WHERE cum.user_id = $1 AND c.capability_id = $2
         AND (cum.expires_at IS NULL OR cum.expires_at > NOW())`,
        [userId, parent_capability_id]
      );
      if (parentCapResult.rows.length > 0) {
        return { autoApprove: true, reason: 'User has parent capability (auto-approved)' };
      }
    }

    // 规则3: 检查用户角色是否已有该能力
    if (userRoles.length > 0) {
      const roleCapResult = await this.pool.query(
        `SELECT 1 FROM capability_role_mappings
         WHERE capability_id = $1 AND role_name = ANY($2)`,
        [capabilityId, userRoles]
      );
      if (roleCapResult.rows.length > 0) {
        return { autoApprove: true, reason: 'User role has capability (auto-approved)' };
      }
    }

    return { autoApprove: false, reason: 'Requires manual approval' };
  }

  // ==================== Permission Request Status ====================

  /**
   * 更新权限申请状态
   */
  async updatePermissionRequestStatus(
    ticketId: number,
    status: 'pending' | 'approved' | 'rejected',
    approvedBy?: string
  ): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE permission_requests
       SET status = $1, approved_by = $2, updated_at = NOW()
       WHERE ticket_id = $3`,
      [status, approvedBy || null, ticketId]
    );
    return (result.rowCount || 0) > 0;
  }

  /**
   * 获取用户的权限申请记录
   */
  async getPermissionRequestsByUser(userId: string): Promise<PermissionRequestRecord[]> {
    const result = await this.pool.query(
      'SELECT * FROM permission_requests WHERE requested_for_user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    return result.rows;
  }
}