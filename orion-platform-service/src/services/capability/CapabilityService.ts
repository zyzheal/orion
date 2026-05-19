/**
 * CapabilityService - 能力服务业务逻辑层
 */

import { CapabilityRepository, Capability, CapabilityUserMapping, TemporaryPermission, PermissionAuditLog, PermissionRequestRecord } from './CapabilityRepository';
import { RoleRepository } from '../role/RoleRepository';

export class CapabilityServiceError extends Error {
  constructor(message: string, public code: string) { super(message); this.name = 'CapabilityServiceError'; }
}

export class CapabilityService {
  constructor(
    private capRepo: CapabilityRepository,
    private roleRepo?: RoleRepository
  ) {}

  // ==================== Capability CRUD ====================

  async getCapability(capabilityId: string): Promise<Capability | null> {
    return this.capRepo.findById(capabilityId);
  }

  async listCapabilities(category?: string): Promise<Capability[]> {
    if (category) {
      return this.capRepo.findByCategory(category);
    }
    return this.capRepo.findAll();
  }

  async getCapabilityTree(rootParentId?: string | null): Promise<Capability[]> {
    const parentId = rootParentId === undefined ? null : rootParentId;
    return this.capRepo.findByParent(parentId);
  }

  async createCapability(data: {
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
    // 验证父能力存在
    if (data.parent_capability_id && data.parent_capability_id.trim()) {
      const parent = await this.capRepo.findById(data.parent_capability_id);
      if (!parent) {
        throw new CapabilityServiceError(`Parent capability not found: ${data.parent_capability_id}`, 'PARENT_NOT_FOUND');
      }
    }

    // 验证风险等级有效
    if (data.risk_level !== undefined && (data.risk_level < 1 || data.risk_level > 4)) {
      throw new CapabilityServiceError('Risk level must be between 1 and 4', 'INVALID_RISK_LEVEL');
    }

    return this.capRepo.create(data);
  }

  async updateCapability(capabilityId: string, input: {
    name?: string;
    description?: string;
    risk_level?: number;
    requires_approval?: boolean;
    approval_role?: string;
    metadata?: Record<string, unknown>;
  }): Promise<Capability> {
    if (input.risk_level !== undefined && (input.risk_level < 1 || input.risk_level > 4)) {
      throw new CapabilityServiceError('Risk level must be between 1 and 4', 'INVALID_RISK_LEVEL');
    }

    const updated = await this.capRepo.update(capabilityId, input);
    if (!updated) {
      throw new CapabilityServiceError('Capability not found', 'NOT_FOUND');
    }
    return updated;
  }

  async deleteCapability(capabilityId: string): Promise<boolean> {
    // 检查是否有子能力
    const children = await this.capRepo.findByParent(capabilityId);
    if (children.length > 0) {
      throw new CapabilityServiceError('Cannot delete capability with children', 'HAS_CHILDREN');
    }
    return this.capRepo.delete(capabilityId);
  }

  // ==================== Role Mappings ====================

  async grantCapabilityToRole(capabilityId: string, roleName: string, grantedBy?: string): Promise<void> {
    // 验证 capability 存在
    const cap = await this.capRepo.findById(capabilityId);
    if (!cap) {
      throw new CapabilityServiceError('Capability not found', 'NOT_FOUND');
    }

    // 验证 role 存在
    if (this.roleRepo) {
      const role = await this.roleRepo.findByName(roleName);
      if (!role) {
        throw new CapabilityServiceError(`Role not found: ${roleName}`, 'ROLE_NOT_FOUND');
      }
    }

    await this.capRepo.grantToRole(capabilityId, roleName, grantedBy);
  }

  async revokeCapabilityFromRole(capabilityId: string, roleName: string): Promise<boolean> {
    return this.capRepo.revokeFromRole(capabilityId, roleName);
  }

  async getCapabilitiesForRole(roleName: string): Promise<string[]> {
    return this.capRepo.getCapabilitiesByRole(roleName);
  }

  async getCapabilitiesForRoles(roleNames: string[]): Promise<string[]> {
    return this.capRepo.getCapabilitiesByRoles(roleNames);
  }

  // ==================== User Mappings ====================

  async grantCapabilityToUser(capabilityId: string, userId: string, grantedBy?: string, expiresInHours?: number): Promise<void> {
    const cap = await this.capRepo.findById(capabilityId);
    if (!cap) {
      throw new CapabilityServiceError('Capability not found', 'NOT_FOUND');
    }

    const expiresAt = expiresInHours ? new Date(Date.now() + expiresInHours * 60 * 60 * 1000) : undefined;
    await this.capRepo.grantToUser(capabilityId, userId, grantedBy, expiresAt);
  }

  async revokeCapabilityFromUser(capabilityId: string, userId: string): Promise<boolean> {
    return this.capRepo.revokeFromUser(capabilityId, userId);
  }

  async getCapabilitiesForUser(userId: string): Promise<string[]> {
    return this.capRepo.getCapabilitiesByUser(userId);
  }

  // ==================== ChatOps Command Mapping ====================

  async mapCommandToCapability(
    commandName: string,
    commandAction: string,
    capabilityId: string,
    environmentSuffix?: string
  ): Promise<void> {
    // 验证 capability 存在
    const cap = await this.capRepo.findById(capabilityId);
    if (!cap) {
      throw new CapabilityServiceError('Capability not found', 'NOT_FOUND');
    }

    await this.capRepo.mapCommandToCapability(commandName, commandAction, capabilityId, environmentSuffix);
  }

  async getCapabilityForCommand(commandName: string, commandAction: string, environment?: string): Promise<string | null> {
    return this.capRepo.getCapabilityForCommand(commandName, commandAction, environment);
  }

  // ==================== Permission Check ====================

  /**
   * 检查用户是否拥有执行某操作的能力
   * @returns { hasPermission: boolean, requiresApproval: boolean, capability: Capability | null }
   */
  async checkPermission(params: {
    userId: string;
    userRoles: string[];
    capabilityId: string;
  }): Promise<{ allowed: boolean; requiresApproval: boolean; reason: string }> {
    const { userId, userRoles, capabilityId } = params;

    // 1. 检查 capability 是否存在
    const capability = await this.capRepo.findById(capabilityId);
    if (!capability) {
      return { allowed: false, requiresApproval: false, reason: `Capability not found: ${capabilityId}` };
    }

    // 2. 检查用户直接映射（临时权限优先）
    const userCapabilities = await this.capRepo.getCapabilitiesByUser(userId);
    if (userCapabilities.includes(capabilityId)) {
      return { allowed: true, requiresApproval: capability.requires_approval, reason: 'User has direct capability' };
    }

    // 3. 检查角色映射
    const roleCapabilities = await this.capRepo.getCapabilitiesByRoles(userRoles);
    if (roleCapabilities.includes(capabilityId)) {
      return { allowed: true, requiresApproval: capability.requires_approval, reason: 'User role has capability' };
    }

    // 4. 无权限
    return { allowed: false, requiresApproval: capability.requires_approval, reason: 'User does not have required capability' };
  }

  // ==================== Cleanup ====================

  async revokeExpiredPermissions(): Promise<number> {
    return this.capRepo.deleteExpiredPermissions();
  }

  async getExpiredPermissions(): Promise<CapabilityUserMapping[]> {
    return this.capRepo.getExpiredPermissions();
  }

  // ==================== Temporary Permissions ====================

  /**
   * 授予临时权限（通过审批或管理员手动）
   */
  async grantTemporaryPermission(data: {
    tenant_id: string;
    user_id: string;
    capability_id: string;
    environment_suffix?: string;
    granted_by: string;
    approval_id?: number;
    ticket_id?: number;
    reason?: string;
    expires_in_hours: number;
  }): Promise<TemporaryPermission> {
    const cap = await this.capRepo.findById(data.capability_id);
    if (!cap) {
      throw new CapabilityServiceError('Capability not found', 'NOT_FOUND');
    }

    const expiresAt = new Date(Date.now() + data.expires_in_hours * 60 * 60 * 1000);

    // 1. 插入临时权限记录
    const tempPerm = await this.capRepo.grantTemporaryPermission({
      ...data,
      expires_at: expiresAt,
    });

    // 2. 同时在 capability_user_mappings 中记录（用于权限检查），携带来源信息
    await this.capRepo.grantToUser(data.capability_id, data.user_id, data.granted_by, expiresAt, {
      approval_id: data.approval_id,
      ticket_id: data.ticket_id,
      reason: data.reason,
    });

    // 3. 写入审计日志
    await this.capRepo.createAuditLog({
      tenant_id: data.tenant_id,
      user_id: data.user_id,
      action: 'granted',
      capability_id: data.capability_id,
      environment_suffix: data.environment_suffix,
      actor_id: data.granted_by,
      reason: data.reason || `临时权限 ${data.expires_in_hours}小时`,
      metadata: { temp_perm_id: tempPerm.id, expires_at: expiresAt.toISOString() },
    });

    return tempPerm;
  }

  /**
   * 撤销临时权限
   */
  async revokeTemporaryPermission(id: number, revokedBy: string, reason?: string): Promise<TemporaryPermission | null> {
    const perm = await this.capRepo.revokeTemporaryPermission(id, revokedBy, reason);
    if (perm) {
      await this.capRepo.createAuditLog({
        tenant_id: perm.tenant_id,
        user_id: perm.user_id,
        action: 'revoked',
        capability_id: perm.capability_id,
        environment_suffix: perm.environment_suffix || undefined,
        actor_id: revokedBy,
        reason: reason || '手动撤销',
        metadata: { temp_perm_id: perm.id, revoked_by: revokedBy },
      });
    }
    return perm;
  }

  /**
   * 查询用户的活跃临时权限
   */
  async getActiveTemporaryPermissions(userId: string, tenantId?: string): Promise<TemporaryPermission[]> {
    return this.capRepo.getActiveTemporaryPermissions(userId, tenantId);
  }

  /**
   * 清理过期的临时权限（定时任务调用）
   */
  async cleanupExpiredTemporaryPermissions(): Promise<{
    cleaned: number;
    auditLogs: number;
  }> {
    // 原子操作：UPDATE ... RETURNING * 一次性获取并标记过期记录
    const expired = await this.capRepo.cleanupExpiredTemporaryPermissions();

    // 为每个过期权限写入审计日志
    let auditLogs = 0;
    for (const perm of expired) {
      await this.capRepo.createAuditLog({
        tenant_id: perm.tenant_id,
        user_id: perm.user_id,
        action: 'expired',
        capability_id: perm.capability_id,
        environment_suffix: perm.environment_suffix || undefined,
        actor_id: 'system',
        reason: '自动过期清理',
        metadata: { temp_perm_id: perm.id, granted_at: perm.granted_at, expires_at: perm.expires_at },
      });
      auditLogs++;
    }

    return { cleaned: expired.length, auditLogs };
  }

  // ==================== Permission Audit ====================

  async getAuditLogs(params: {
    user_id?: string;
    capability_id?: string;
    action?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ logs: PermissionAuditLog[]; total: number }> {
    return this.capRepo.getAuditLogs(params);
  }

  // ==================== Permission Request ====================

  async createPermissionRequest(data: {
    ticket_id: number;
    capability_id: string;
    environment_suffix?: string;
    duration_hours: number;
    requested_for_user_id: string;
    capability_snapshot?: Record<string, unknown>;
  }): Promise<PermissionRequestRecord> {
    const cap = await this.capRepo.findById(data.capability_id);
    if (!cap) {
      throw new CapabilityServiceError('Capability not found', 'NOT_FOUND');
    }

    return this.capRepo.createPermissionRequest(data);
  }

  async getPermissionRequestByTicket(ticketId: number): Promise<PermissionRequestRecord | null> {
    return this.capRepo.getPermissionRequestByTicketId(ticketId);
  }

  /**
   * 审批通过后：授予临时权限并关联工单
   */
  async fulfillPermissionRequest(params: {
    ticket_id: number;
    tenant_id: string;
    user_id: string;
    capability_id: string;
    environment_suffix?: string;
    duration_hours: number;
    approved_by: string;
    approval_id: number;
  }): Promise<{ tempPerm: TemporaryPermission; mappingId: string }> {
    // 1. 授予临时权限（会自动写入 capability_user_mappings 含来源信息）
    const tempPerm = await this.grantTemporaryPermission({
      tenant_id: params.tenant_id,
      user_id: params.user_id,
      capability_id: params.capability_id,
      environment_suffix: params.environment_suffix,
      granted_by: params.approved_by,
      approval_id: params.approval_id,
      ticket_id: params.ticket_id,
      reason: `权限申请工单 #${params.ticket_id} 审批通过`,
      expires_in_hours: params.duration_hours,
    });

    // 2. 更新 permission_requests 关联（使用临时权限 ID 作为引用）
    await this.capRepo.linkApprovalToPermissionRequest(params.ticket_id, 0); // mapping ID 由 grantToUser 返回

    return { tempPerm, mappingId: tempPerm.id.toString() };
  }
}