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
 */
import pino from 'pino';
import { v4 as uuidv4 } from 'uuid';
import { DatabasePool } from '../database';
import {
  MultiLevelApprovalService,
  ApprovalAction,
  ApprovalMode,
  ApprovalLevel,
  ApprovalRequestDetail,
} from './MultiLevelApprovalService';

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
  private pool: DatabasePool;

  // 流程配置缓存 (tenantId -> flowId -> config)
  private flowConfigCache: Map<string, Map<string, ApprovalFlowConfig>> = new Map();
  private static readonly MAX_CACHE_PER_TENANT = 500;
  // 外部 gRPC 服务客户端
  private externalApprovalClients: Map<string, any> = new Map();

  constructor(
    db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> },
    pool: DatabasePool,
  ) {
    this.multiLevelService = new MultiLevelApprovalService(db);
    this.pool = pool;
    this.ensureTables();
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

    // 2. 从数据库查询匹配规则
    try {
      const result = await this.pool.query(
        `SELECT * FROM approval_flow_configs
         WHERE tenant_id = $1 AND enabled = true
         AND (capability_ids ? $2 OR capability_ids @> '["*"]'::jsonb)
         AND (environments ? $3 OR environments @> '["*"]'::jsonb)
         AND ($4 >= min_risk_level AND $4 <= max_risk_level)
         ORDER BY priority DESC, version DESC
         LIMIT 1`,
        [tenantId, capabilityId, environment, riskLevel],
      );

      if ((result as any).rows.length === 0) {
        logger.warn({ capabilityId, environment, riskLevel, tenantId }, 'No matching flow config found');
        return null;
      }

      const config = this.parseFlowConfig((result as any).rows[0]);
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
      throw new Error(`External approval service not found: ${serviceName}`);
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

    await this.pool.query(
      `INSERT INTO approval_flow_configs (id, tenant_id, flow_id, name, description, enabled, nodes, version, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        id,
        tenantId,
        input.flowId,
        input.name,
        input.description || null,
        input.enabled,
        JSON.stringify(input.nodes),
        1,
        now,
        now,
      ],
    );

    const config: ApprovalFlowConfig = {
      ...input,
      id,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };

    // 更新缓存
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

    // 从数据库查询
    const result = await this.pool.query(
      'SELECT * FROM approval_flow_configs WHERE flow_id = $1 AND tenant_id = $2',
      [flowId, tenantId],
    );

    if ((result as any).rows.length === 0) return null;

    const config = this.parseFlowConfig((result as any).rows[0]);
    this.cacheFlowConfig(tenantId, config);
    return config;
  }

  /**
   * 获取租户下所有审批流程配置
   */
  async listFlowConfigs(tenantId: string): Promise<ApprovalFlowConfig[]> {
    const result = await this.pool.query(
      'SELECT * FROM approval_flow_configs WHERE tenant_id = $1 ORDER BY created_at DESC',
      [tenantId],
    );

    return (result as any).rows.map((row: any) => this.parseFlowConfig(row));
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

    const now = new Date();
    const newVersion = existing.version + 1;

    await this.pool.query(
      `UPDATE approval_flow_configs
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           enabled = COALESCE($3, enabled),
           nodes = COALESCE($4, nodes),
           version = $5,
           updated_at = $6
       WHERE flow_id = $7 AND tenant_id = $8`,
      [
        updates.name,
        updates.description,
        updates.enabled,
        updates.nodes ? JSON.stringify(updates.nodes) : null,
        newVersion,
        now,
        flowId,
        tenantId,
      ],
    );

    // 清除缓存
    this.flowConfigCache.get(tenantId)?.delete(flowId);

    // 返回更新后的配置
    return this.getFlowConfig(flowId, tenantId);
  }

  /**
   * 删除审批流程配置
   */
  async deleteFlowConfig(flowId: string, tenantId: string): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM approval_flow_configs WHERE flow_id = $1 AND tenant_id = $2',
      [flowId, tenantId],
    );

    if ((result as any).rowCount && (result as any).rowCount > 0) {
      this.flowConfigCache.get(tenantId)?.delete(flowId);
      logger.info({ flowId, tenantId }, 'Flow config deleted');
      return true;
    }

    return false;
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
   * 解析数据库返回的配置
   */
  private parseFlowConfig(row: any): ApprovalFlowConfig {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      flowId: row.flow_id,
      name: row.name,
      description: row.description,
      enabled: row.enabled,
      nodes: typeof row.nodes === 'string' ? JSON.parse(row.nodes) : row.nodes,
      version: row.version,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
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
    // TODO: 调用 UserService 或 RoleRepository 获取角色对应的用户
    // 临时返回空数组，实际实现需集成 UserService
    logger.debug({ role, tenantId }, 'Resolving approvers by role');
    return [];
  }

  /**
   * 按值班解析审批人
   */
  private async resolveOnCall(oncallGroup: string, tenantId: string): Promise<string[]> {
    // TODO: 调用值班服务获取当前值班人员
    logger.debug({ oncallGroup, tenantId }, 'Resolving approvers by oncall');
    return [];
  }

  /**
   * 按部门解析审批人
   */
  private async resolveByDepartment(department: string, tenantId: string): Promise<string[]> {
    // TODO: 调用 UserService 获取部门负责人
    logger.debug({ department, tenantId }, 'Resolving approvers by department');
    return [];
  }

  /**
   * 按汇报线解析审批人
   */
  private async resolveByReportingLine(userId: string, tenantId: string): Promise<string[]> {
    // TODO: 调用 UserService 获取用户的直属领导
    logger.debug({ userId, tenantId }, 'Resolving approvers by reporting line');
    return [];
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

  /**
   * 确保必要的表存在
   */
  private async ensureTables(): Promise<void> {
    try {
      // 审批流程配置表
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS approval_flow_configs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id VARCHAR(64) NOT NULL,
          flow_id VARCHAR(100) NOT NULL,
          name VARCHAR(200) NOT NULL,
          description TEXT,
          enabled BOOLEAN DEFAULT true,
          capability_ids JSONB DEFAULT '[]',
          environments JSONB DEFAULT '[]',
          min_risk_level INT DEFAULT 1,
          max_risk_level INT DEFAULT 4,
          priority INT DEFAULT 0,
          nodes JSONB NOT NULL DEFAULT '[]',
          version INT DEFAULT 1,
          created_by VARCHAR(64),
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
          UNIQUE (tenant_id, flow_id)
        )
      `);

      // 审批人规则表
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS approval_approver_rules (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id VARCHAR(64) NOT NULL,
          flow_id UUID REFERENCES approval_flow_configs(id) ON DELETE CASCADE,
          node_id VARCHAR(100) NOT NULL,
          rule_type VARCHAR(30) NOT NULL,
          rule_value VARCHAR(200) NOT NULL,
          backup_approvers JSONB DEFAULT '[]',
          fallback_chain JSONB DEFAULT '[]',
          backup_timeout_minutes INT DEFAULT 30,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);

      // 审批降级日志表
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS approval_fallback_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id VARCHAR(64) NOT NULL,
          approval_id VARCHAR(200) NOT NULL,
          node_id VARCHAR(100) NOT NULL,
          fallback_type VARCHAR(30) NOT NULL,
          from_approver VARCHAR(200),
          to_approver VARCHAR(200),
          reason TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);

      logger.info('Approval flow engine tables ensured');
    } catch (error: any) {
      logger.error({ error: error.message }, 'Failed to ensure approval tables — this is a critical initialization failure');
      // 不吞异常：表创建失败意味着后续所有操作都会失败
      throw new Error(`ApprovalFlowEngine initialization failed: ${error.message}`);
    }
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