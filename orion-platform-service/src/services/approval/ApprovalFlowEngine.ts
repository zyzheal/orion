/**
 * ApprovalFlowEngine - 审批流程引擎
 *
 * V3 系统级通用审批流程引擎，支持：
 * - 审批流程匹配（capability + environment + riskLevel）
 * - 审批流程启动、审批操作、拒绝操作
 * - 串行/并行审批模式
 * - 外部 gRPC 审批服务调用
 *
 * 集成现有 MultiLevelApprovalService 实现多级审批
 * 数据持久化通过 ApprovalFlowConfigRepository（PostgreSQL Repository 模式）
 */
import { createLogger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { ApprovalFlowConfigRepository } from '../../repositories/ApprovalFlowConfigRepository';
import {
  MultiLevelApprovalService,
  ApprovalAction,
  ApprovalMode,
  ApprovalLevel,
  ApprovalRequestDetail,
} from './MultiLevelApprovalService';
import { OrionError, ErrorCode } from '../../errors';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// ==================== 核心类型定义 ====================

/** 审批流程节点类型 */
export type FlowNodeType = 'human' | 'condition' | 'agent' | 'parallel-group' | 'fallback-chain';

/** 审批流程配置 */
export interface ApprovalFlowConfig {
  id: string;
  tenantId: string;
  flowId: string;
  name: string;
  description?: string;
  enabled: boolean;
  nodes: ApprovalFlowNode[];
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

/** 审批流程节点 */
export interface ApprovalFlowNode {
  id: string;
  name: string;
  nodeType: FlowNodeType;

  // human 节点
  approverType?: 'role' | 'user' | 'oncall' | 'department' | 'reporting-line';
  approverValue?: string;
  backupApprovers?: string[];
  fallbackChain?: FallbackStep[];
  backupTimeoutMinutes?: number;

  // agent 节点
  agent?: string;
  agentThreshold?: AgentThreshold;
  onLowConfidence?: 'escalate-to-next' | 'reject' | 'approve';
  onAgentFailure?: 'fallback-to-rules' | 'escalate-to-next' | 'reject';

  // parallel-group 节点
  parallelGroupConfig?: ParallelGroupConfig;

  // fallback-chain 节点
  fallbackChainConfig?: FallbackChainConfig;

  // condition 节点
  autoApproveCondition?: Record<string, unknown>;

  // 通用配置
  timeoutMinutes: number;
  timeoutAction: 'remind' | 'escalate' | 'reject' | 'approve';
  onApprove: 'next' | 'complete';
  onReject: 'reject';
}

/** 降级步骤 */
export interface FallbackStep {
  id: string;
  deriveType: 'manager' | 'department-head' | 'role-escalation' | 'oncall' | 'fixed-user';
  deriveParam?: string;
  autoApprove: boolean;
  autoApproveMaxRiskLevel: number;
}

/** Agent 审批阈值 */
export interface AgentThreshold {
  autoApproveConfidence: number;
  autoRejectConfidence: number;
  autoRejectRiskScore: number;
}

/** 并行审批组配置 */
export interface ParallelGroupConfig {
  approvers: ApproverRule[];
  requiredApprovals: number;
  parallelMode: 'any' | 'all' | 'majority';
  fallbackTimeoutMinutes: number;
}

/** 降级审批链配置 */
export interface FallbackChainConfig {
  primary: ApproverRule;
  backup: ApproverRule[];
  chain: FallbackStep[];
  finalAction: 'auto-approve' | 'reject';
}

/** 审批人规则 */
export interface ApproverRule {
  type: 'role' | 'user' | 'oncall' | 'department' | 'reporting-line';
  value: string;
  backupApprovers: string[];
  fallbackChain: FallbackStep[];
  backupTimeoutMinutes: number;
}

/** 审批流程匹配条件 */
export interface FlowMatchCondition {
  capabilityId: string;
  environment: string;
  riskLevel: number;
  resourceType?: string;
}

/** 审批流程启动上下文 */
export interface FlowStartContext {
  capabilityId: string;
  environment: string;
  riskLevel: number;
  resourceType: string;
  resourceId: string;
  requesterId: string;
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

/** 审批操作输入 */
export interface ApprovalInput {
  ticketId: string;
  approverId: string;
  decision: 'approve' | 'reject';
  comment?: string;
}

/** 审批结果 */
export interface ApprovalResult {
  success: boolean;
  ticketId: string;
  status: 'pending' | 'approved' | 'rejected';
  message: string;
  details?: ApprovalRequestDetail;
}

/** 外部审批服务响应 */
export interface ExternalApprovalResponse {
  approved: boolean;
  approverId: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

// ==================== 审批流程引擎 ====================

export class ApprovalFlowEngine {
  private multiLevelService: MultiLevelApprovalService;
  private repo: ApprovalFlowConfigRepository;
  private db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> };

  // 流程配置缓存 (tenantId -> flowId -> config) — 有效缓存层，主存储在 PostgreSQL
  private flowConfigCache: Map<string, Map<string, ApprovalFlowConfig>> = new Map();
  private static readonly MAX_CACHE_PER_TENANT = 500;
  // 外部 gRPC 服务客户端注册表（非数据存储）
  private externalApprovalClients: Map<string, any> = new Map();

  constructor(
    db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> },
  ) {
    this.db = db;
    this.multiLevelService = new MultiLevelApprovalService(db);
    this.repo = new ApprovalFlowConfigRepository(db);
  }

  // ==================== 核心方法 ====================

  /**
   * 匹配审批流程
   * 根据 capabilityId、environment、riskLevel 匹配最合适的审批流程配置
   */
  async matchFlow(
    capabilityId: string,
    environment: string,
    riskLevel: number,
    tenantId: string = 'default',
  ): Promise<ApprovalFlowConfig | null> {
    // 1. 尝试从缓存获取
    const cachedFlow = this.getCachedFlow(tenantId, capabilityId, environment, riskLevel);
    if (cachedFlow) {
      logger.debug({ capabilityId, environment, riskLevel, tenantId }, 'Using cached flow config');
      return cachedFlow;
    }

    // 2. 从 Repository 查询匹配规则
    try {
      const entity = await this.repo.findMatching(tenantId, capabilityId, environment, riskLevel);
      const config = entity ? this.entityToFlowConfig(entity) : null;

      if (!config) {
        logger.warn({ capabilityId, environment, riskLevel, tenantId }, 'No matching flow config found');
        return null;
      }

      this.cacheFlowConfig(tenantId, config);
      return config;
    } catch (error) {
      logger.error({ error, capabilityId }, 'Error matching flow config');
      return null;
    }
  }

  /**
   * 启动审批流程
   * 根据匹配的流程配置创建审批请求
   */
  async startFlow(
    config: ApprovalFlowConfig,
    context: FlowStartContext,
    tenantId: string = 'default',
  ): Promise<ApprovalResult> {
    try {
      // 1. 解析第一个节点的审批人
      const firstNode = config.nodes[0];
      if (!firstNode) {
        return {
          success: false,
          ticketId: '',
          status: 'rejected',
          message: 'No nodes defined in flow config',
        };
      }

      // 2. 构建审批级别
      const levels = await this.buildApprovalLevels(firstNode, context, tenantId);

      if (levels.length === 0) {
        return {
          success: false,
          ticketId: '',
          status: 'rejected',
          message: 'No approvers resolved for the first node',
        };
      }

      // 3. 确定审批模式
      const mode = this.getApprovalMode(firstNode);

      // 4. 通过 MultiLevelApprovalService 创建审批请求
      const detail = await this.multiLevelApprovalService.submitApprovalRequest(tenantId, {
        title: context.title,
        description: context.description,
        requesterId: context.requesterId,
        resourceType: context.resourceType,
        resourceId: context.resourceId,
        levels,
        mode,
        metadata: {
          ...context.metadata,
          flowConfigId: config.id,
          flowVersion: config.version,
          capabilityId: context.capabilityId,
          environment: context.environment,
          riskLevel: context.riskLevel,
        },
      });

      logger.info({
        ticketId: detail.id,
        flowId: config.flowId,
        requesterId: context.requesterId,
        levels: levels.length,
      }, 'Approval flow started');

      return {
        success: true,
        ticketId: detail.id,
        status: 'pending',
        message: `Approval request created with ${levels.length} level(s)`,
        details: detail,
      };
    } catch (error) {
      logger.error({ error, configId: config.id, context }, 'Failed to start approval flow');
      return {
        success: false,
        ticketId: '',
        status: 'rejected',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 审批操作
   * 对审批工单进行批准
   */
  async approve(
    ticketId: string,
    approverId: string,
    decision: 'approve' | 'reject',
    comment?: string,
  ): Promise<ApprovalResult> {
    try {
      const action = decision === 'approve' ? ApprovalAction.APPROVE : ApprovalAction.REJECT;
      const detail = await this.multiLevelApprovalService.review(ticketId, approverId, action, comment);

      logger.info({
        ticketId,
        approverId,
        action: decision,
        newStatus: detail.status,
      }, 'Approval action processed');

      return {
        success: true,
        ticketId,
        status: detail.status as 'pending' | 'approved' | 'rejected',
        message: decision === 'approve' ? 'Approved successfully' : 'Rejected',
        details: detail,
      };
    } catch (error) {
      logger.error({ error, ticketId, approverId }, 'Approval action failed');
      return {
        success: false,
        ticketId,
        status: 'rejected',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 拒绝操作（approve 方法的便捷包装）
   */
  async reject(
    ticketId: string,
    approverId: string,
    reason?: string,
  ): Promise<ApprovalResult> {
    return this.approve(ticketId, approverId, 'reject', reason);
  }

  // ==================== 外部服务集成 ====================

  /**
   * 注册外部审批服务客户端（gRPC）
   */
  registerExternalClient(serviceName: string, client: any): void {
    this.externalApprovalClients.set(serviceName, client);
    logger.info({ serviceName }, 'External approval client registered');
  }

  /**
   * 调用外部审批服务
   */
  async callExternalApprovalService(
    serviceName: string,
    request: { ticketId: string; context: FlowStartContext },
  ): Promise<ExternalApprovalResponse> {
    const client = this.externalApprovalClients.get(serviceName);
    if (!client) {
      throw new OrionError(`External approval service not found: ${serviceName}`, ErrorCode.NOT_FOUND);
    }

    try {
      // 假设 gRPC 客户端有 Approve 方法
      const response = await client.Approve(request);
      return {
        approved: response.approved,
        approverId: response.approverId,
        reason: response.reason,
        metadata: response.metadata,
      };
    } catch (error) {
      logger.error({ error, serviceName, ticketId: request.ticketId }, 'External approval service call failed');
      throw error;
    }
  }

  // ==================== 流程配置管理 ====================

  /**
   * 创建审批流程配置
   */
  async createFlowConfig(
    tenantId: string,
    input: Omit<ApprovalFlowConfig, 'id' | 'createdAt' | 'updatedAt' | 'version'>,
  ): Promise<ApprovalFlowConfig> {
    const id = `flow_${uuidv4()}`;
    const now = new Date();

    const entity = await this.repo.create({
      id,
      tenant_id: tenantId,
      flow_id: input.flowId,
      name: input.name,
      description: input.description || null,
      enabled: input.enabled,
      nodes: JSON.stringify(input.nodes),
      version: 1,
      created_at: now,
      updated_at: now,
    });
    const config = this.entityToFlowConfig(entity);
    this.cacheFlowConfig(tenantId, config);
    logger.info({ flowId: input.flowId, tenantId }, 'Flow config created');
    return config;
  }

  /**
   * 获取审批流程配置
   */
  async getFlowConfig(flowId: string, tenantId: string): Promise<ApprovalFlowConfig | null> {
    // 先检查缓存
    const cached = this.flowConfigCache.get(tenantId)?.get(flowId);
    if (cached) return cached;

    // 从 Repository 查询
    const entity = await this.repo.findByFlowId(flowId, tenantId);
    if (!entity) return null;
    const config = this.entityToFlowConfig(entity);
    this.cacheFlowConfig(tenantId, config);
    return config;
  }

  /**
   * 获取租户下所有审批流程配置
   */
  async listFlowConfigs(tenantId: string): Promise<ApprovalFlowConfig[]> {
    const entities = await this.repo.findByTenantId(tenantId);
    return entities.map(e => this.entityToFlowConfig(e));
  }

  /**
   * 更新审批流程配置
   */
  async updateFlowConfig(
    flowId: string,
    tenantId: string,
    updates: Partial<Omit<ApprovalFlowConfig, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<ApprovalFlowConfig | null> {
    const existing = await this.getFlowConfig(flowId, tenantId);
    if (!existing) return null;

    const newVersion = existing.version + 1;

    const updateData: any = { version: newVersion };
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.enabled !== undefined) updateData.enabled = updates.enabled;
    if (updates.nodes !== undefined) updateData.nodes = JSON.stringify(updates.nodes);

    const entity = await this.repo.updateByFlowId(flowId, tenantId, updateData);
    if (!entity) return null;

    // 清除缓存
    this.flowConfigCache.get(tenantId)?.delete(flowId);
    const config = this.entityToFlowConfig(entity);
    this.cacheFlowConfig(tenantId, config);
    return config;
  }

  /**
   * 删除审批流程配置
   */
  async deleteFlowConfig(flowId: string, tenantId: string): Promise<boolean> {
    const deleted = await this.repo.deleteByFlowId(flowId, tenantId);
    if (deleted) {
      this.flowConfigCache.get(tenantId)?.delete(flowId);
      logger.info({ flowId, tenantId }, 'Flow config deleted');
    }
    return deleted;
  }

  // ==================== 私有方法 ====================

  /**
   * 从缓存获取流程配置
   */
  private getCachedFlow(
    tenantId: string,
    capabilityId: string,
    environment: string,
    riskLevel: number,
  ): ApprovalFlowConfig | null {
    const tenantCache = this.flowConfigCache.get(tenantId);
    if (!tenantCache) return null;

    for (const config of tenantCache.values()) {
      if (this.matchesCondition(config, capabilityId, environment, riskLevel)) {
        return config;
      }
    }

    return null;
  }

  /**
   * 检查是否匹配条件
   */
  private matchesCondition(
    config: ApprovalFlowConfig,
    capabilityId: string,
    environment: string,
    riskLevel: number,
  ): boolean {
    const cfg = config as any;
    if (!config.enabled) return false;

    // 匹配 capability
    const capabilityIds = cfg.capabilityIds || [];
    if (capabilityIds.length > 0 && !capabilityIds.includes(capabilityId)) {
      return false;
    }

    // 匹配环境
    const environments = cfg.environments || [];
    if (environments.length > 0 && !environments.includes(environment)) {
      return false;
    }

    // 匹配风险等级
    const minRisk = cfg.minRiskLevel ?? 1;
    const maxRisk = cfg.maxRiskLevel ?? 4;
    if (riskLevel < minRisk || riskLevel > maxRisk) {
      return false;
    }

    return true;
  }

  /**
   * 缓存流程配置
   */
  private cacheFlowConfig(tenantId: string, config: ApprovalFlowConfig): void {
    if (!this.flowConfigCache.has(tenantId)) {
      this.flowConfigCache.set(tenantId, new Map());
    }
    const tenantCache = this.flowConfigCache.get(tenantId)!;
    tenantCache.set(config.flowId, config);

    // 限制每个租户的缓存大小，防止内存泄漏
    while (tenantCache.size > ApprovalFlowEngine.MAX_CACHE_PER_TENANT) {
      const firstKey = tenantCache.keys().next().value;
      if (firstKey !== undefined) {
        tenantCache.delete(firstKey);
      } else {
        break;
      }
    }
  }

  /**
   * 将 Repository Entity 转换为服务层 ApprovalFlowConfig
   */
  private entityToFlowConfig(entity: any): ApprovalFlowConfig {
    return {
      id: entity.id,
      tenantId: entity.tenant_id,
      flowId: entity.flow_id,
      name: entity.name,
      description: entity.description,
      enabled: entity.enabled,
      nodes: Array.isArray(entity.nodes) ? entity.nodes : (typeof entity.nodes === 'string' ? JSON.parse(entity.nodes) : []),
      version: entity.version,
      createdAt: entity.created_at instanceof Date ? entity.created_at : new Date(entity.created_at),
      updatedAt: entity.updated_at instanceof Date ? entity.updated_at : new Date(entity.updated_at),
    };
  }

  /**
   * 构建审批级别
   */
  private async buildApprovalLevels(
    node: ApprovalFlowNode,
    context: FlowStartContext,
    tenantId: string,
  ): Promise<ApprovalLevel[]> {
    const levels: ApprovalLevel[] = [];

    if (node.nodeType === 'human') {
      // 解析审批人
      const approverIds = await this.resolveApprovers(node, context, tenantId);

      if (approverIds.length > 0) {
        levels.push({
          levelIndex: 0,
          approverIds,
          requiredApprovals: 1,
        });
      }

      // 添加备份审批人作为下一级别
      if (node.backupApprovers && node.backupApprovers.length > 0) {
        levels.push({
          levelIndex: 1,
          approverIds: node.backupApprovers,
          requiredApprovals: 1,
        });
      }
    } else if (node.nodeType === 'parallel-group' && node.parallelGroupConfig) {
      // 并行审批组：每个 approver 一个级别
      for (const rule of node.parallelGroupConfig.approvers) {
        const approverIds = await this.resolveApproversByRule(rule, context, tenantId);
        levels.push({
          levelIndex: levels.length,
          approverIds,
          requiredApprovals: 1,
        });
      }
    } else if (node.nodeType === 'fallback-chain' && node.fallbackChainConfig) {
      // 降级审批链
      const primaryApprovers = await this.resolveApproversByRule(
        node.fallbackChainConfig.primary,
        context,
        tenantId,
      );

      if (primaryApprovers.length > 0) {
        levels.push({
          levelIndex: 0,
          approverIds: primaryApprovers,
          requiredApprovals: 1,
        });
      }

      // 添加备份审批人
      for (const backup of node.fallbackChainConfig.backup) {
        const backupApprovers = await this.resolveApproversByRule(backup, context, tenantId);
        if (backupApprovers.length > 0) {
          levels.push({
            levelIndex: levels.length,
            approverIds: backupApprovers,
            requiredApprovals: 1,
          });
        }
      }
    }

    return levels;
  }

  /**
   * 根据节点配置解析审批人
   */
  private async resolveApprovers(
    node: ApprovalFlowNode,
    context: FlowStartContext,
    tenantId: string,
  ): Promise<string[]> {
    if (!node.approverType || !node.approverValue) {
      return [];
    }

    const rule: ApproverRule = {
      type: node.approverType,
      value: node.approverValue,
      backupApprovers: node.backupApprovers || [],
      fallbackChain: node.fallbackChain || [],
      backupTimeoutMinutes: node.backupTimeoutMinutes || 30,
    };

    return this.resolveApproversByRule(rule, context, tenantId);
  }

  /**
   * 根据规则解析审批人
   */
  private async resolveApproversByRule(
    rule: ApproverRule,
    context: FlowStartContext,
    tenantId: string,
  ): Promise<string[]> {
    try {
      switch (rule.type) {
        case 'user':
          return [rule.value];

        case 'role':
          return await this.resolveByRole(rule.value, tenantId);

        case 'oncall':
          return await this.resolveOnCall(rule.value, tenantId);

        case 'department':
          return await this.resolveByDepartment(rule.value, tenantId);

        case 'reporting-line':
          return await this.resolveByReportingLine(context.requesterId, tenantId);

        default:
          return [];
      }
    } catch (error) {
      logger.error({ error, rule }, 'Failed to resolve approvers');
      return [];
    }
  }

  /**
   * 按角色解析审批人
   */
  private async resolveByRole(role: string, tenantId: string): Promise<string[]> {
    logger.debug({ role, tenantId }, 'Resolving approvers by role');
    const result = await this.db.query(
      `SELECT user_id FROM user_roles
       WHERE role = $1 AND tenant_id = $2`,
      [role, tenantId],
    );
    return result.rows.map((r: any) => r.user_id);
  }

  /**
   * 按值班解析审批人
   */
  private async resolveOnCall(oncallGroup: string, tenantId: string): Promise<string[]> {
    logger.debug({ oncallGroup, tenantId }, 'Resolving approvers by oncall');
    const result = await this.db.query(
      `SELECT user_id FROM oncall_schedule
       WHERE group_name = $1 AND tenant_id = $2
         AND is_active = true
         AND NOW() BETWEEN shift_start AND shift_end
       ORDER BY shift_start`,
      [oncallGroup, tenantId],
    );
    return result.rows.map((r: any) => r.user_id);
  }

  /**
   * 按部门解析审批人
   */
  private async resolveByDepartment(department: string, tenantId: string): Promise<string[]> {
    logger.debug({ department, tenantId }, 'Resolving approvers by department');
    const result = await this.db.query(
      `SELECT user_id FROM department_members
       WHERE department = $1 AND tenant_id = $2
         AND role IN ('head', 'manager')
       ORDER BY role`,
      [department, tenantId],
    );
    return result.rows.map((r: any) => r.user_id);
  }

  /**
   * 按汇报线解析审批人
   */
  private async resolveByReportingLine(userId: string, tenantId: string): Promise<string[]> {
    logger.debug({ userId, tenantId }, 'Resolving approvers by reporting line');
    const result = await this.db.query(
      `SELECT manager_id FROM user_reporting_lines
       WHERE user_id = $1 AND tenant_id = $2
       LIMIT 1`,
      [userId, tenantId],
    );
    return result.rows.map((r: any) => r.manager_id).filter(Boolean);
  }

  /**
   * 获取审批模式
   */
  private getApprovalMode(node: ApprovalFlowNode): ApprovalMode {
    if (node.nodeType === 'parallel-group') {
      return ApprovalMode.PARALLEL;
    }

    // fallback-chain 默认串行
    if (node.nodeType === 'fallback-chain') {
      return ApprovalMode.SERIAL;
    }

    // 其他情况根据配置或默认串行
    return ApprovalMode.SERIAL;
  }

  // ==================== Getter for MultiLevelApprovalService ====================

  private get multiLevelApprovalService(): MultiLevelApprovalService {
    return this.multiLevelService;
  }
}

// ==================== 便捷函数 ====================

/**
 * 创建默认审批流程配置
 */
export function createDefaultFlowConfig(
  name: string,
  flowId: string,
  options: {
    approverType?: 'role' | 'user' | 'oncall';
    approverValue?: string;
    riskLevels?: number[];
    environments?: string[];
  } = {},
): Omit<ApprovalFlowConfig, 'id' | 'createdAt' | 'updatedAt' | 'version'> {
  const nodes: ApprovalFlowNode[] = [
    {
      id: 'default-approval',
      name: 'Default Approval',
      nodeType: 'human',
      approverType: options.approverType || 'role',
      approverValue: options.approverValue || 'admin',
      timeoutMinutes: 60,
      timeoutAction: 'remind',
      onApprove: 'complete',
      onReject: 'reject',
    },
  ];

  return {
    tenantId: 'default',
    flowId,
    name,
    description: `Default approval flow for ${name}`,
    enabled: true,
    nodes,
  };
}

/**
 * 风险等级标签
 */
export function getRiskLevelLabel(level: number): string {
  switch (level) {
    case 1:
      return '低风险';
    case 2:
      return '中低风险';
    case 3:
      return '中高风险';
    case 4:
      return '高风险';
    default:
      return '未知';
  }
}

/**
 * 风险等级颜色
 */
export function getRiskLevelColor(level: number): string {
  switch (level) {
    case 1:
      return 'success';
    case 2:
      return 'info';
    case 3:
      return 'warning';
    case 4:
      return 'error';
    default:
      return 'default';
  }
}