/**
 * AuthorizationEngine - 统一授权评估引擎
 *
 * 整合 RBAC、ABAC、关系检查三层授权模型：
 * - [0] 用户状态检查
 * - [1] super_admin 通配符跳过
 * - [2] RBAC 角色权限检查
 * - [3] ABAC 属性策略检查（deny-only 约束）
 * - [4] 资源关系检查（owner/project/collaborator）
 *
 * 性能优化：
 * - Redis 缓存权限决策结果（PermissionCache）
 * - 缓存命中时 < 1ms，目标命中率 > 80%
 */

import pino from 'pino';
import { RoleService } from '../role/RoleService';
import { TeamService } from '../team/TeamService';
import { CapabilityService } from '../capability/CapabilityService';
import { AbacPolicyEngine, AbacContext } from './AbacPolicyEngine';
import { RelationshipService } from './RelationshipService';
import { PermissionAuditRepository, AuditLogEntry } from '../../repositories/PermissionAuditRepository';
import type { PipelineRBACService } from '../pipeline/PipelineRBACService';
import { PermissionCache } from './PermissionCache';
import type { CacheService } from '../cache/CacheService';

// === 类型定义 ===

export interface UserAttributes {
  id: string;
  username: string;
  roles: string[];
  department?: string;
  level?: 'junior' | 'senior' | 'manager' | 'director';
  teams?: string[];
  tenantId: string;
  clearanceLevel?: 'L1' | 'L2' | 'L3' | 'L4';
  status?: 'active' | 'disabled' | 'suspended';
}

export interface ResourceAttributes {
  type: string;
  id?: string;
  ownerId?: string;
  tenantId: string;
  projectId?: string;
  environment?: 'dev' | 'staging' | 'production';
  sensitivity?: 'public' | 'internal' | 'confidential' | 'restricted';
  department?: string;
  tags?: string[];
  status?: string;
}

export interface EnvAttributes {
  time: Date;
  sourceIp?: string;
  network?: 'internal' | 'external' | 'vpn';
  requestOrigin?: 'web' | 'api' | 'cli' | 'webhook';
  sessionId?: string;
}

export interface ActionAttributes {
  type: string;
  impact?: 'low' | 'medium' | 'high' | 'critical';
  reason?: string;
}

export interface AuthZRequest {
  user: UserAttributes;
  resource: ResourceAttributes;
  environment: EnvAttributes;
  action: ActionAttributes;
}

export type AuthZSource = 'rbac' | 'abac' | 'relationship' | 'super_admin_bypass' | 'capability' | 'all';

export interface AuthZDecision {
  allowed: boolean;
  reason: string;
  source: AuthZSource;
  evaluatedBy: string[];
  evaluationTime: number;
  fromCache?: boolean;
}

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export class AuthorizationEngine {
  private permissionCache: PermissionCache | null = null;

  constructor(
    private rbacService: RoleService,
    private abacEngine: AbacPolicyEngine,
    private relationshipService: RelationshipService,
    public auditRepo?: PermissionAuditRepository,
    private pipelineRbacService?: PipelineRBACService,
    private teamService?: TeamService,
    private capabilityService?: CapabilityService,
    cacheService?: CacheService | null,
    cacheTtlSeconds: number = 300,
  ) {
    // 初始化权限缓存
    if (cacheService) {
      this.permissionCache = new PermissionCache(cacheService, cacheTtlSeconds);
      logger.info({ ttl: cacheTtlSeconds }, '[AuthZ] Permission cache enabled');
    } else {
      logger.info('[AuthZ] Permission cache disabled (no Redis available)');
    }
  }

  async evaluate(req: AuthZRequest): Promise<AuthZDecision> {
    const startTime = Date.now();

    // 尝试从缓存获取（仅对 allow 路径有效，deny 不缓存）
    if (this.permissionCache) {
      const cached = await this.permissionCache.get({
        userId: req.user.id,
        resourceType: req.resource.type,
        action: req.action.type,
        tenantId: req.user.tenantId,
      });
      if (cached) {
        const decision: AuthZDecision = {
          allowed: true,
          reason: `${cached.reason} (cached)`,
          source: cached.source as AuthZSource,
          evaluatedBy: [cached.source],
          evaluationTime: Date.now() - startTime,
          fromCache: true,
        };
        return decision;
      }
    }

    // [0] 用户状态检查
    if (req.user.status === 'disabled' || req.user.status === 'suspended') {
      return this.deny('User account is disabled or suspended', 'rbac', Date.now() - startTime, req);
    }

    // [1] super_admin / admin 通配符跳过所有检查
    if (req.user.roles.includes('super_admin') || req.user.roles.includes('admin')) {
      return this.allow('Super Admin bypass', 'super_admin_bypass', Date.now() - startTime, req, ['super_admin']);
    }

    // [2] RBAC 检查 — 基于角色权限
    const rbacResult = await this.rbacService.checkPermissions(
      req.user.roles,
      req.resource.type,
      req.action.type,
    );
    if (!rbacResult.allowed) {
      return this.deny(rbacResult.reason, 'rbac', Date.now() - startTime, req);
    }

    // [2.5] Pipeline 级 RBAC 检查（当资源为 pipeline 时）
    if (req.resource.type === 'pipeline' && req.resource.id && this.pipelineRbacService) {
      const actionToPerm: Record<string, string> = {
        read: 'view', write: 'update', execute: 'trigger', delete: 'delete', manage: 'approve',
      };
      const perm = actionToPerm[req.action.type] || req.action.type;
      const pipelinePerm = await this.pipelineRbacService.hasPermission(
        req.resource.id,
        req.user.id,
        perm,
      );
      if (!pipelinePerm.allowed) {
        return this.deny(pipelinePerm.reason || 'Pipeline RBAC denied', 'rbac', Date.now() - startTime, req);
      }
    }

    // [2.7] Team-based permission check
    // User's team roles augment direct RBAC permissions
    if (this.teamService) {
      const teamPermissions = await this.teamService.getUserTeamPermissions(req.user.id, req.user.tenantId);
      const hasPermission = teamPermissions.some(
        p => (p.resource === req.resource.type || p.resource === '*') &&
             (p.action === req.action.type || p.action === '*' || p.action === 'manage')
      );
      if (hasPermission) {
        return this.allow('Team role grants permission', 'rbac', Date.now() - startTime, req, ['team_role']);
      }
    }

    // [2.8] Capability 检查 - 基于能力的细粒度权限
    // 如果配置了 capabilityService，检查用户是否有所需能力
    if (this.capabilityService && req.resource.type) {
      const capabilityId = `${req.resource.type}:${req.action.type}`;
      const capResult = await this.capabilityService.checkPermission({
        userId: req.user.id,
        userRoles: req.user.roles,
        capabilityId,
      });
      if (capResult.allowed) {
        return this.allow(capResult.reason, 'capability', Date.now() - startTime, req, ['capability']);
      }
      // 如果能力检查失败且需要审批，记录原因
      if (capResult.requiresApproval) {
        logger.info({ userId: req.user.id, capabilityId }, 'Capability requires approval');
      }
    }

    // [3] ABAC 检查 — deny-only 约束
    const abacContext = this.toAbacContext(req);
    const abacResult = this.abacEngine.evaluate(abacContext);
    if (abacResult.denied) {
      return this.deny(abacResult.denialReason || 'ABAC policy denied', 'abac', Date.now() - startTime, req);
    }

    // [4] 关系检查（仅当有 resourceId 时）
    if (req.resource.id) {
      const relResult = await this.relationshipService.check({
        userId: req.user.id,
        tenantId: req.user.tenantId,
        projectId: req.resource.projectId,
        resourceId: req.resource.id,
        resourceType: req.resource.type,
        ownerId: req.resource.ownerId,
        ownerTenantId: req.resource.tenantId,
      });
      if (!relResult.allowed) {
        return this.deny(relResult.reason, 'relationship', Date.now() - startTime, req);
      }
    }

    // [5] 全部通过
    return this.allow('All checks passed', 'all', Date.now() - startTime, req, ['rbac', 'team_role', 'abac', 'relationship']);
  }

  /**
   * 失效指定用户的权限缓存
   * 应在角色变更、策略变更时调用
   */
  async invalidateUserCache(userId: string, tenantId?: string): Promise<void> {
    if (this.permissionCache) {
      await this.permissionCache.invalidateUser(userId, tenantId);
    }
  }

  /**
   * 失效整个租户的权限缓存
   * 应在大规模策略变更时调用
   */
  async invalidateTenantCache(tenantId: string): Promise<void> {
    if (this.permissionCache) {
      await this.permissionCache.invalidateTenant(tenantId);
    }
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats() {
    if (this.permissionCache) {
      return this.permissionCache.getStats();
    }
    return { enabled: false };
  }

  /**
   * 将 AuthZRequest 转换为 AbacPolicyEngine 所需的 AbacContext 格式
   */
  private toAbacContext(req: AuthZRequest): AbacContext {
    return {
      user: {
        id: req.user.id,
        role: req.user.roles[0] || '',
        department: req.user.department,
        level: req.user.level,
        teams: req.user.teams,
        tenantId: req.user.tenantId,
      },
      resource: {
        type: req.resource.type,
        id: req.resource.id,
        owner: req.resource.ownerId,
        ownerId: req.resource.ownerId,
        department: req.resource.department,
        tenantId: req.resource.tenantId,
        sensitivity: req.resource.sensitivity,
        status: req.resource.status,
      },
      environment: {
        time: req.environment.time,
        ip: req.environment.sourceIp,
        network: req.environment.network,
        sessionId: req.environment.sessionId,
      },
      action: {
        type: req.action.type,
        impact: req.action.impact,
        reason: req.action.reason,
      },
    };
  }

  private allow(
    reason: string,
    source: AuthZSource,
    time: number,
    authzReq?: AuthZRequest,
    evaluatedBy?: string[],
  ): AuthZDecision {
    // 异步缓存 allow 决策（不阻塞主流程）
    if (this.permissionCache && authzReq) {
      this.permissionCache.set(
        {
          userId: authzReq.user.id,
          resourceType: authzReq.resource.type,
          action: authzReq.action.type,
          tenantId: authzReq.user.tenantId,
        },
        {
          allowed: true,
          reason,
          source,
          cachedAt: Date.now(),
        }
      ).catch(err => {
        logger.debug({ err }, 'Failed to cache permission decision');
      });
    }

    // 异步记录 allow 审计日志（不阻塞主流程）
    if (this.auditRepo && authzReq) {
      this.auditRepo.logDecision({
        userId: authzReq.user.id,
        tenantId: authzReq.resource.tenantId,
        resourceType: authzReq.resource.type,
        resourceId: authzReq.resource.id,
        action: authzReq.action.type,
        decision: 'allow',
        decisionSource: source,
        reason,
      }).catch(err => {
        logger.error({ err }, 'Failed to write permission audit log');
      });
    }

    return {
      allowed: true,
      reason,
      source,
      evaluatedBy: evaluatedBy || [source],
      evaluationTime: time,
    };
  }

  private deny(
    reason: string,
    source: AuthZSource,
    time: number,
    authzReq?: AuthZRequest,
  ): AuthZDecision {
    logger.info({ reason, source, evaluationTime: time }, 'Authorization denied');

    // 异步记录审计日志（不阻塞主流程）
    if (this.auditRepo && authzReq) {
      this.auditRepo.logDecision({
        userId: authzReq.user.id,
        tenantId: authzReq.resource.tenantId,
        resourceType: authzReq.resource.type,
        resourceId: authzReq.resource.id,
        action: authzReq.action.type,
        decision: 'deny',
        decisionSource: source,
        reason,
      }).catch(err => {
        logger.error({ err }, 'Failed to write permission audit log');
      });
    }

    return {
      allowed: false,
      reason,
      source,
      evaluatedBy: [source],
      evaluationTime: time,
    };
  }
}
