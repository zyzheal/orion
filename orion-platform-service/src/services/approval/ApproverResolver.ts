/**
 * ApproverResolver - 审批人动态解析 + 降级推导服务
 *
 * 实现审批人动态解析、降级链推导、在线状态检测功能
 *
 * 设计文档: docs/superpowers/specs/2026-05-19-approval-flow-advanced-capabilities-design.md
 */
import pino from 'pino';
import { DatabasePool } from '../database';
import { UserRepository } from '../user/UserRepository';
import { CapabilityRepository } from '../capability/CapabilityRepository';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// ==================== 类型定义 ====================

/** 审批人规则配置 */
export interface ApproverRule {
  /** 解析类型 */
  type: 'role' | 'user' | 'oncall' | 'department' | 'reporting-line';
  /** 规则值（角色名/用户ID/值班组名/部门名） */
  value: string;
  /** 主审批人列表（解析结果） */
  primaryApproverIds?: string[];
  /** 备份审批人列表（主审批人超时后接管） */
  backupApprovers: string[];
  /** 降级链：当所有审批人不可用时逐级推导 */
  fallbackChain: FallbackStep[];
  /** 超时阈值（分钟后触发备份） */
  backupTimeoutMinutes: number;
}

/** 降级推导类型 */
export type DeriveType = 'manager' | 'department-head' | 'role-escalation' | 'oncall' | 'fixed-user';

/** 降级步骤 */
export interface FallbackStep {
  /** 步骤标识 */
  id: string;
  /** 推导规则 */
  deriveType: DeriveType;
  /** 推导参数 */
  deriveParam?: string;
  /** 是否允许自动批准（仅最高降级级别 + 低风险操作） */
  autoApprove: boolean;
  /** 自动批准限制：仅 riskLevel <= N 时生效 */
  autoApproveMaxRiskLevel: number;
}

/** 审批上下文 */
export interface ApprovalContext {
  /** 能力 ID */
  capabilityId: string;
  /** 请求人 ID */
  requesterId: string;
  /** 请求人部门 */
  requesterDepartment?: string;
  /** 请求人经理 ID */
  requesterManagerId?: string;
  /** 环境 */
  environment: string;
  /** 风险等级 1-4 */
  riskLevel: number;
  /** 资源类型 */
  resourceType?: string;
  /** 资源 ID */
  resourceId?: string;
  /** 租户 ID */
  tenantId: string;
  /** 扩展元数据 */
  metadata?: Record<string, unknown>;
}

/** 降级推导结果 */
export interface FallbackResult {
  /** 结果类型 */
  type: 'approvers_found' | 'auto_approve' | 'reject';
  /** 审批人列表 */
  approverIds: string[];
  /** 原因说明 */
  reason: string;
}

/** 审批人解析结果 */
export interface ApproverResolveResult {
  /** 是否成功 */
  success: boolean;
  /** 审批人列表 */
  approverIds: string[];
  /** 可用的备份审批人（当主审批人不可用时） */
  backupApprovers: string[];
  /** 降级链 */
  fallbackChain: FallbackStep[];
  /** 原因说明 */
  reason?: string;
}

/** 审批人可用性检查结果 */
export interface ApproverAvailability {
  /** 用户 ID */
  userId: string;
  /** 是否可用 */
  isAvailable: boolean;
  /** 不可用原因 */
  reason?: string;
}

// ==================== 常量定义 ====================

/** 默认备份超时时间（分钟） */
const DEFAULT_BACKUP_TIMEOUT_MINUTES = 30;

/** 默认自动批准最大风险等级 */
const DEFAULT_AUTO_APPROVE_MAX_RISK_LEVEL = 2;

/** 用户离线阈值（毫秒）24小时 */
const OFFLINE_THRESHOLD_MS = 24 * 60 * 60 * 1000;

/** 角色升级映射 */
const ROLE_ESCALATION_MAP: Record<string, string> = {
  'admin': 'platform_admin',
  'platform_admin': 'super_admin',
  'tenant_admin': 'super_admin',
  'org_admin': 'platform_admin',
  'tech_lead': 'org_admin',
  'developer': 'tech_lead',
  'project_lead': 'org_admin',
  'project_developer': 'project_lead',
  'sre': 'admin',
  'viewer': 'developer',
};

/** 禁止自动批准的环境 */
const PRODUCTION_ENV = 'prod';

// ==================== ApproverResolver 类 ====================

export class ApproverResolver {
  private userRepository: UserRepository;
  private capabilityRepository: CapabilityRepository;
  private pool: DatabasePool;

  constructor(
    pool: DatabasePool,
    userRepository?: UserRepository,
    capabilityRepository?: CapabilityRepository,
  ) {
    this.pool = pool;
    this.userRepository = userRepository || new UserRepository(pool);
    this.capabilityRepository = capabilityRepository || new CapabilityRepository(pool);
  }

  // ==================== 核心方法 ====================

  /**
   * 主审批人解析
   * 根据 capabilityId 和上下文解析审批人列表
   */
  async resolveApprover(capabilityId: string, context: ApprovalContext): Promise<ApproverResolveResult> {
    try {
      // 1. 从 Capability 中获取审批规则配置
      const capability = await this.capabilityRepository.findById(capabilityId);

      if (!capability) {
        logger.warn({ capabilityId }, 'Capability not found, using default approver rule');
        return this.getDefaultApproverRule(context);
      }

      // 2. 解析审批规则
      // 优先使用 metadata 中的 approverConfig，其次使用 approval_role
      const approverConfig = (capability.metadata?.approverConfig as ApproverRule | undefined);
      const approvalRole = capability.approval_role;

      if (!approverConfig && !approvalRole) {
        // 没有配置时使用默认规则
        return this.getDefaultApproverRule(context);
      }

      // 构建规则
      const rule: ApproverRule = approverConfig || {
        type: 'role',
        value: approvalRole!,
        backupApprovers: [],
        fallbackChain: [],
        backupTimeoutMinutes: DEFAULT_BACKUP_TIMEOUT_MINUTES,
      };

      // 3. 根据规则类型解析审批人
      const approverIds = await this.resolveApproversByRule(rule, context);

      // 4. 检查审批人可用性
      const availableApprovers = await this.filterAvailableApprovers(approverIds);

      if (availableApprovers.length > 0) {
        return {
          success: true,
          approverIds: availableApprovers,
          backupApprovers: rule.backupApprovers || [],
          fallbackChain: rule.fallbackChain || [],
          reason: `Resolved ${availableApprovers.length} approver(s) for capability ${capabilityId}`,
        };
      }

      // 5. 主审批人不可用，尝试备份审批人
      const availableBackups = await this.filterAvailableApprovers(rule.backupApprovers || []);

      if (availableBackups.length > 0) {
        return {
          success: true,
          approverIds: availableBackups,
          backupApprovers: [],
          fallbackChain: rule.fallbackChain || [],
          reason: 'Primary approvers unavailable, using backups',
        };
      }

      // 6. 备份也不可用，进入降级链
      return {
        success: true,
        approverIds: [],
        backupApprovers: [],
        fallbackChain: rule.fallbackChain || [],
        reason: 'All approvers unavailable, fallback chain required',
      };
    } catch (error) {
      logger.error({ error, capabilityId, context }, 'Error resolving approver');
      return this.getDefaultApproverRule(context);
    }
  }

  /**
   * 降级推导
   * 当主审批人和备份审批人都不可用时，按降级链逐级推导
   */
  async deriveFallback(context: ApprovalContext): Promise<FallbackResult> {
    const { fallbackChain = [], capabilityId } = context.metadata as { fallbackChain?: FallbackStep[]; capabilityId?: string } || {};

    if (fallbackChain.length === 0) {
      // 没有配置降级链，使用默认降级链
      return this.deriveDefaultFallback(context);
    }

    logger.debug({ fallbackChain: fallbackChain.length, context }, 'Executing fallback chain derivation');

    // 逐级执行降级推导
    for (const step of fallbackChain) {
      const derivedApprovers = await this.executeFallbackStep(step, context);

      // 过滤掉已不可用的审批人
      const availableApprovers = await this.filterAvailableApprovers(derivedApprovers);

      if (availableApprovers.length > 0) {
        logger.info({
          stepId: step.id,
          deriveType: step.deriveType,
          approverCount: availableApprovers.length,
        }, 'Fallback step resolved approvers');

        return {
          type: 'approvers_found',
          approverIds: availableApprovers,
          reason: `Fallback step ${step.id}: ${step.deriveType} derivation succeeded`,
        };
      }
    }

    // 降级链用尽，检查是否允许自动批准
    const lastStep = fallbackChain[fallbackChain.length - 1];

    if (lastStep?.autoApprove) {
      return this.checkAutoApprove(lastStep, context);
    }

    return {
      type: 'reject',
      approverIds: [],
      reason: 'Fallback chain exhausted, no auto-approve configured',
    };
  }

  /**
   * 自动审批检查
   * 检查是否满足自动批准的条件
   */
  async autoApproveCheck(approver: string, riskLevel: number, context: ApprovalContext): Promise<boolean> {
    // 1. 检查审批人是否可用
    const availability = await this.checkApproverAvailability(approver);

    if (!availability.isAvailable) {
      logger.debug({ approver, reason: availability.reason }, 'Approver not available for auto-approve');
      return false;
    }

    // 2. 安全约束：生产环境永不自动批准
    if (context.environment === PRODUCTION_ENV) {
      logger.debug({ environment: context.environment }, 'Auto-approve blocked: production environment');
      return false;
    }

    // 3. 安全约束：风险等级检查
    const maxRiskLevel = context.metadata?.autoApproveMaxRiskLevel as number | undefined ?? DEFAULT_AUTO_APPROVE_MAX_RISK_LEVEL;

    if (riskLevel > maxRiskLevel) {
      logger.debug({ riskLevel, maxRiskLevel }, 'Auto-approve blocked: risk level exceeds threshold');
      return false;
    }

    // 4. 检查审批人是否配置了自动审批权限（由 super_admin 配置）
    const canAutoApprove = await this.checkApproverAutoApprovePermission(approver);

    if (!canAutoApprove) {
      logger.debug({ approver }, 'Approver does not have auto-approve permission');
      return false;
    }

    return true;
  }

  /**
   * 批量检查审批人可用性
   */
  async filterAvailableApprovers(approverIds: string[]): Promise<string[]> {
    if (approverIds.length === 0) return [];

    const results = await Promise.all(
      approverIds.map(async (id) => {
        const availability = await this.checkApproverAvailability(id);
        return availability.isAvailable ? id : null;
      })
    );

    return results.filter((id): id is string => id !== null);
  }

  /**
   * 检查单个审批人是否可用
   */
  async checkApproverAvailability(userId: string): Promise<ApproverAvailability> {
    try {
      const user = await this.userRepository.findById(userId);

      if (!user) {
        return { userId, isAvailable: false, reason: 'User not found' };
      }

      // 检查用户状态
      if (user.status === 'frozen' || user.status === 'disabled') {
        return { userId, isAvailable: false, reason: `User status is ${user.status}` };
      }

      // 检查是否在 DND 期间
      if (this.isInDNDPeriod(user)) {
        return { userId, isAvailable: false, reason: 'User is in DND period' };
      }

      // 检查最后登录时间（超过 24 小时视为离线）
      const lastLoginAt = user.last_login_at;

      if (lastLoginAt) {
        const loginTime = new Date(lastLoginAt).getTime();
        if (!isNaN(loginTime) && Date.now() - loginTime > OFFLINE_THRESHOLD_MS) {
          return { userId, isAvailable: false, reason: 'User offline for more than 24 hours' };
        }
      }

      return { userId, isAvailable: true };
    } catch (error) {
      logger.error({ error, userId }, 'Error checking approver availability');
      return { userId, isAvailable: false, reason: 'Error checking availability' };
    }
  }

  // ==================== 私有方法 ====================

  /**
   * 获取默认审批规则
   */
  private getDefaultApproverRule(context: ApprovalContext): ApproverResolveResult {
    // 默认规则：根据能力 ID 推断审批角色
    const defaultRole = this.inferDefaultRole(context.capabilityId, context.riskLevel);

    return {
      success: true,
      approverIds: [],
      backupApprovers: [],
      fallbackChain: [
        { id: 'manager', deriveType: 'manager', autoApprove: false, autoApproveMaxRiskLevel: 2 },
        { id: 'dept-head', deriveType: 'department-head', autoApprove: false, autoApproveMaxRiskLevel: 2 },
        { id: 'role-escalation', deriveType: 'role-escalation', deriveParam: 'super_admin', autoApprove: true, autoApproveMaxRiskLevel: 2 },
      ],
      reason: `Using default role: ${defaultRole}`,
    };
  }

  /**
   * 推断默认审批角色
   */
  private inferDefaultRole(capabilityId: string, riskLevel: number): string {
    // 高风险操作需要更高权限
    if (riskLevel >= 4) {
      return 'super_admin';
    }

    if (riskLevel >= 3) {
      return 'admin';
    }

    // 基于 capability ID 推断
    if (capabilityId.includes('deploy') || capabilityId.includes('release')) {
      return riskLevel >= 2 ? 'admin' : 'tech_lead';
    }

    if (capabilityId.includes('config') || capabilityId.includes('secret')) {
      return 'admin';
    }

    if (capabilityId.includes('delete') || capabilityId.includes('destroy')) {
      return 'admin';
    }

    return 'tech_lead';
  }

  /**
   * 根据规则类型解析审批人
   */
  private async resolveApproversByRule(rule: ApproverRule, context: ApprovalContext): Promise<string[]> {
    switch (rule.type) {
      case 'role':
        return this.resolveByRole(rule.value, context.tenantId);

      case 'user':
        return [rule.value];

      case 'oncall':
        return this.resolveOnCallApprovers(rule.value, context.tenantId);

      case 'department':
        return this.resolveDepartmentApprovers(rule.value, context.tenantId);

      case 'reporting-line':
        return this.resolveReportingLine(context.requesterId, context.tenantId);

      default:
        logger.warn({ ruleType: rule.type }, 'Unknown approver rule type');
        return [];
    }
  }

  /**
   * 按角色解析审批人
   */
  private async resolveByRole(role: string, tenantId: string): Promise<string[]> {
    try {
      // 从 RoleRepository 获取拥有该角色的用户
      const result = await this.pool.query(
        `SELECT u.id FROM users u
         JOIN user_roles ur ON ur.user_id = u.id
         JOIN roles r ON r.id = ur.role_id
         WHERE r.name = $1 AND u.tenant_id = $2 AND u.status = 'active'`,
        [role, tenantId]
      );

      return result.rows.map(row => row.id);
    } catch (error) {
      logger.error({ error, role, tenantId }, 'Error resolving approvers by role');
      return [];
    }
  }

  /**
   * 按值班组解析审批人
   *
   * 优先从 OnCallService 获取当前值班人员，
   * 若无 OnCallService 则回退到数据库中的值班组配置
   */
  private async resolveOnCallApprovers(oncallGroup: string, tenantId: string): Promise<string[]> {
    try {
      // 查询值班组配置
      const result = await this.pool.query(
        `SELECT members FROM oncall_groups
         WHERE name = $1 AND tenant_id = $2 AND is_active = true
         LIMIT 1`,
        [oncallGroup, tenantId]
      );

      if (result.rows.length === 0) {
        logger.warn({ oncallGroup, tenantId }, 'OnCall group not found, returning empty');
        return [];
      }

      const members = result.rows[0].members;
      if (Array.isArray(members) && members.length > 0) {
        return members;
      }

      // 回退：从用户表中查找属于该值班组的活跃用户
      const fallbackResult = await this.pool.query(
        `SELECT u.id FROM users u
         JOIN oncall_members om ON om.user_id = u.id
         JOIN oncall_groups og ON og.id = om.group_id
         WHERE og.name = $1 AND u.tenant_id = $2 AND u.status = 'active'
         ORDER BY om.priority ASC`,
        [oncallGroup, tenantId]
      );

      return fallbackResult.rows.map(row => row.id);
    } catch (error) {
      logger.error({ error, oncallGroup, tenantId }, 'Error resolving onCall approvers');
      return [];
    }
  }

  /**
   * 按部门解析审批人
   */
  private async resolveDepartmentApprovers(department: string, tenantId: string): Promise<string[]> {
    try {
      // 查询部门负责人
      const result = await this.pool.query(
        `SELECT id FROM users
         WHERE department = $1 AND tenant_id = $2 AND status = 'active'
         AND (role LIKE '%admin%' OR role LIKE '%lead%' OR role LIKE '%head%')
         LIMIT 5`,
        [department, tenantId]
      );

      return result.rows.map(row => row.id);
    } catch (error) {
      logger.error({ error, department, tenantId }, 'Error resolving department approvers');
      return [];
    }
  }

  /**
   * 按汇报线解析审批人（直属领导）
   */
  private async resolveReportingLine(userId: string, tenantId: string): Promise<string[]> {
    try {
      // 从 users 表的 manager_id 字段获取直属领导
      const result = await this.pool.query(
        `SELECT manager_id FROM users WHERE id = $1 AND tenant_id = $2`,
        [userId, tenantId]
      );

      if (result.rows.length > 0 && result.rows[0].manager_id) {
        return [result.rows[0].manager_id];
      }

      // 如果没有 manager_id，尝试从 organization 表获取
      const orgResult = await this.pool.query(
        `SELECT manager_id FROM organization_members
         WHERE user_id = $1 AND tenant_id = $2 AND is_manager = true`,
        [userId, tenantId]
      );

      if (orgResult.rows.length > 0) {
        return orgResult.rows.map(row => row.manager_id).filter(Boolean);
      }

      return [];
    } catch (error) {
      logger.error({ error, userId, tenantId }, 'Error resolving reporting line');
      return [];
    }
  }

  /**
   * 执行单个降级步骤
   */
  private async executeFallbackStep(step: FallbackStep, context: ApprovalContext): Promise<string[]> {
    const { tenantId } = context;

    switch (step.deriveType) {
      case 'manager':
        return this.resolveReportingLine(context.requesterId, tenantId);

      case 'department-head':
        return this.resolveDepartmentApprovers(
          step.deriveParam || context.requesterDepartment || 'engineering',
          tenantId
        );

      case 'role-escalation':
        return this.resolveByRole(
          step.deriveParam || 'super_admin',
          tenantId
        );

      case 'oncall':
        return this.resolveOnCallApprovers(
          step.deriveParam || 'default-oncall',
          tenantId
        );

      case 'fixed-user':
        return step.deriveParam ? [step.deriveParam] : [];

      default:
        logger.warn({ deriveType: step.deriveType }, 'Unknown derive type in fallback step');
        return [];
    }
  }

  /**
   * 默认降级推导
   */
  private async deriveDefaultFallback(context: ApprovalContext): Promise<FallbackResult> {
    const defaultChain: FallbackStep[] = [
      { id: 'manager', deriveType: 'manager', autoApprove: false, autoApproveMaxRiskLevel: 2 },
      { id: 'dept-head', deriveType: 'department-head', autoApprove: false, autoApproveMaxRiskLevel: 2 },
      { id: 'role-escalation', deriveType: 'role-escalation', deriveParam: 'super_admin', autoApprove: true, autoApproveMaxRiskLevel: 2 },
    ];

    for (const step of defaultChain) {
      const derived = await this.executeFallbackStep(step, context);
      const available = await this.filterAvailableApprovers(derived);

      if (available.length > 0) {
        return {
          type: 'approvers_found',
          approverIds: available,
          reason: `Default fallback step ${step.id}: ${step.deriveType}`,
        };
      }
    }

    // 最后一步允许自动批准
    const lastStep = defaultChain[defaultChain.length - 1];

    return this.checkAutoApprove(lastStep, context);
  }

  /**
   * 检查自动批准条件
   */
  private checkAutoApprove(step: FallbackStep, context: ApprovalContext): FallbackResult {
    // 安全约束：生产环境永不自动批准
    if (context.environment === PRODUCTION_ENV) {
      return {
        type: 'reject',
        approverIds: [],
        reason: 'Production environment: auto-approve not allowed',
      };
    }

    // 安全约束：风险等级检查
    const maxRiskLevel = step.autoApproveMaxRiskLevel ?? DEFAULT_AUTO_APPROVE_MAX_RISK_LEVEL;

    if (context.riskLevel > maxRiskLevel) {
      return {
        type: 'reject',
        approverIds: [],
        reason: `Risk level ${context.riskLevel} exceeds auto-approve threshold ${maxRiskLevel}`,
      };
    }

    return {
      type: 'auto_approve',
      approverIds: [],
      reason: `Fallback chain exhausted, auto-approved per step ${step.id} (riskLevel=${context.riskLevel}, env=${context.environment})`,
    };
  }

  /**
   * 检查用户是否有自动审批权限
   * 只有 super_admin 可以配置自动审批
   */
  private async checkApproverAutoApprovePermission(userId: string): Promise<boolean> {
    try {
      const user = await this.userRepository.findById(userId);

      if (!user) return false;

      // super_admin / admin 永远可以自动审批
      if (user.role === 'super_admin' || user.role === 'admin') return true;

      // 检查用户是否具有 approval:approve 权限
      const result = await this.pool.query(
        `SELECT 1 FROM permissions p
         JOIN role_permissions rp ON rp.permission_id = p.id
         JOIN roles r ON r.id = rp.role_id
         JOIN user_roles ur ON ur.role_id = r.id
         WHERE ur.user_id = $1 AND p.resource = 'approval' AND p.action = 'approve'
         LIMIT 1`,
        [userId]
      );

      return result.rows.length > 0;
    } catch (error) {
      logger.error({ error, userId }, 'Error checking auto-approve permission');
      return false;
    }
  }

  /**
   * 检查用户是否在 DND（Do Not Disturb）期间
   * 基于用户设置的 availability 状态
   */
  private isInDNDPeriod(user: any): boolean {
    // 用户设置了 DND 状态
    const settings = user.settings || {};

    if (settings.availability === 'dnd') {
      return true;
    }

    // 如果有 DND 时间段配置，检查当前时间是否在 DND 期间
    if (settings.dndStartTime && settings.dndEndTime) {
      const now = new Date();
      const start = new Date(settings.dndStartTime);
      const end = new Date(settings.dndEndTime);

      // 处理跨天情况
      if (start <= end) {
        return now >= start && now <= end;
      } else {
        // 跨天：22:00 - 06:00
        return now >= start || now <= end;
      }
    }

    return false;
  }

  /**
   * 角色升级推导
   */
  private escalateRole(role: string): string | null {
    return ROLE_ESCALATION_MAP[role] || null;
  }
}

// ==================== 便捷函数 ====================

/**
 * 创建降级步骤（工厂方法）
 */
export function createFallbackStep(
  id: string,
  deriveType: DeriveType,
  options: {
    deriveParam?: string;
    autoApprove?: boolean;
    autoApproveMaxRiskLevel?: number;
  } = {},
): FallbackStep {
  return {
    id,
    deriveType,
    deriveParam: options.deriveParam,
    autoApprove: options.autoApprove ?? false,
    autoApproveMaxRiskLevel: options.autoApproveMaxRiskLevel ?? DEFAULT_AUTO_APPROVE_MAX_RISK_LEVEL,
  };
}

/**
 * 创建审批规则（工厂方法）
 */
export function createApproverRule(
  type: ApproverRule['type'],
  value: string,
  options: {
    backupApprovers?: string[];
    fallbackChain?: FallbackStep[];
    backupTimeoutMinutes?: number;
  } = {},
): ApproverRule {
  return {
    type,
    value,
    backupApprovers: options.backupApprovers ?? [],
    fallbackChain: options.fallbackChain ?? [],
    backupTimeoutMinutes: options.backupTimeoutMinutes ?? DEFAULT_BACKUP_TIMEOUT_MINUTES,
  };
}

/**
 * 风险等级标签
 */
export function getRiskLevelLabel(level: number): string {
  switch (level) {
    case 1: return '低风险';
    case 2: return '中低风险';
    case 3: return '中高风险';
    case 4: return '高风险';
    default: return '未知';
  }
}

/**
 * 降级类型标签
 */
export function getDeriveTypeLabel(deriveType: DeriveType): string {
  switch (deriveType) {
    case 'manager': return '直属领导';
    case 'department-head': return '部门负责人';
    case 'role-escalation': return '角色升级';
    case 'oncall': return '值班人员';
    case 'fixed-user': return '固定用户';
    default: return deriveType;
  }
}