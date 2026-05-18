/**
 * AuthorizationEngine - 统一授权评估引擎
 *
 * 整合 RBAC、ABAC、关系检查三层授权模型：
 * - [0] 用户状态检查
 * - [1] super_admin 通配符跳过
 * - [2] RBAC 角色权限检查
 * - [3] ABAC 属性策略检查（deny-only 约束）
 * - [4] 资源关系检查（owner/project/collaborator）
 */

import pino from 'pino';
import { RoleService } from '../role/RoleService';
import { AbacPolicyEngine, AbacContext } from './AbacPolicyEngine';
import { RelationshipService } from './RelationshipService';

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

export interface AuthZDecision {
  allowed: boolean;
  reason: string;
  source: 'rbac' | 'abac' | 'relationship' | 'super_admin_bypass' | 'all';
  evaluatedBy: string[];
  evaluationTime: number;
}

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export class AuthorizationEngine {
  constructor(
    private rbacService: RoleService,
    private abacEngine: AbacPolicyEngine,
    private relationshipService: RelationshipService,
  ) {}

  async evaluate(req: AuthZRequest): Promise<AuthZDecision> {
    const startTime = Date.now();

    // [0] 用户状态检查
    if (req.user.status === 'disabled' || req.user.status === 'suspended') {
      return this.deny('User account is disabled or suspended', 'rbac', Date.now() - startTime);
    }

    // [1] super_admin 通配符跳过所有检查
    if (req.user.roles.includes('super_admin')) {
      return this.allow('Super Admin bypass', 'super_admin_bypass', Date.now() - startTime, ['super_admin']);
    }

    // [2] RBAC 检查 — 基于角色权限
    const rbacResult = await this.rbacService.checkPermissions(
      req.user.roles,
      req.resource.type,
      req.action.type,
    );
    if (!rbacResult.allowed) {
      return this.deny(rbacResult.reason, 'rbac', Date.now() - startTime);
    }

    // [3] ABAC 检查 — deny-only 约束
    const abacContext = this.toAbacContext(req);
    const abacResult = this.abacEngine.evaluate(abacContext);
    if (abacResult.denied) {
      return this.deny(abacResult.denialReason || 'ABAC policy denied', 'abac', Date.now() - startTime);
    }

    // [4] 关系检查（仅当有 resourceId 时）
    if (req.resource.id) {
      const relResult = await this.relationshipService.check({
        userId: req.user.id,
        projectId: req.resource.projectId,
        resourceId: req.resource.id,
        resourceType: req.resource.type,
        ownerId: req.resource.ownerId,
      });
      if (!relResult.allowed) {
        return this.deny(relResult.reason, 'relationship', Date.now() - startTime);
      }
    }

    // [5] 全部通过
    return this.allow('All checks passed', 'all', Date.now() - startTime, ['rbac', 'abac', 'relationship']);
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
    source: AuthZDecision['source'],
    time: number,
    evaluatedBy?: string[],
  ): AuthZDecision {
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
    source: AuthZDecision['source'],
    time: number,
  ): AuthZDecision {
    logger.info({ reason, source, evaluationTime: time }, 'Authorization denied');
    return {
      allowed: false,
      reason,
      source,
      evaluatedBy: [source],
      evaluationTime: time,
    };
  }
}
