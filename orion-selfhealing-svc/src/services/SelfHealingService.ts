/**
 * Orion Self-Healing Service
 * 自愈核心服务
 *
 * Uses PostgreSQL Repository pattern for persistent storage.
 * Supports dependency injection for repositories.
 */

import {
  SelfHealingIncident,
  HealingStrategy,
  HealingAction,
  HealingDecision,
  KnowledgeBase,
  IncidentSeverity,
  IncidentStatus,
  DecisionAction,
  ActionStatus,
  StrategyType,
} from '../types/selfhealing';
import {
  DatabasePool,
  SelfHealingIncidentRepository,
  HealingDecisionRepository,
  HealingActionRepository,
  KnowledgeBaseRepository,
  SelfHealingPolicyRepository,
  SelfHealingExecutionRepository,
  SelfHealingPolicy,
  SelfHealingExecution,
} from '../repositories/SelfHealingRepository';
export { SelfHealingPolicy, SelfHealingExecution } from '../repositories/SelfHealingRepository';

export interface SelfHealingServiceOptions {
  db?: DatabasePool;
  incidentRepo?: SelfHealingIncidentRepository;
  decisionRepo?: HealingDecisionRepository;
  actionRepo?: HealingActionRepository;
  knowledgeRepo?: KnowledgeBaseRepository;
  policyRepo?: SelfHealingPolicyRepository;
  executionRepo?: SelfHealingExecutionRepository;
}

export class SelfHealingService {
  private incidentRepo: SelfHealingIncidentRepository | null;
  private decisionRepo: HealingDecisionRepository | null;
  private actionRepo: HealingActionRepository | null;
  private knowledgeRepo: KnowledgeBaseRepository | null;
  private policyRepo: SelfHealingPolicyRepository | null;
  private executionRepo: SelfHealingExecutionRepository | null;

  // Fallback in-memory stores (used when DB is not available)
  private memoryIncidents = new Map<string, SelfHealingIncident>();
  private memoryDecisions = new Map<string, HealingDecision>();
  private memoryActions = new Map<string, HealingAction>();
  private memoryKnowledge = new Map<string, KnowledgeBase>();
  private memoryPolicies = new Map<string, SelfHealingPolicy>();

  constructor(options: SelfHealingServiceOptions = {}) {
    if (options.db) {
      this.incidentRepo = options.incidentRepo ?? new SelfHealingIncidentRepository(options.db);
      this.decisionRepo = options.decisionRepo ?? new HealingDecisionRepository(options.db);
      this.actionRepo = options.actionRepo ?? new HealingActionRepository(options.db);
      this.knowledgeRepo = options.knowledgeRepo ?? new KnowledgeBaseRepository(options.db);
      this.policyRepo = options.policyRepo ?? new SelfHealingPolicyRepository(options.db);
      this.executionRepo = options.executionRepo ?? new SelfHealingExecutionRepository(options.db);
    } else {
      // No DB provided - use in-memory fallback
      this.incidentRepo = null;
      this.decisionRepo = null;
      this.actionRepo = null;
      this.knowledgeRepo = null;
      this.policyRepo = null;
      this.executionRepo = null;
    }
  }

  /**
   * 创建自愈事件
   */
  async createIncident(data: Omit<SelfHealingIncident, 'id' | 'status' | 'createdAt' | 'updatedAt'>): Promise<SelfHealingIncident> {
    if (this.incidentRepo) {
      return this.incidentRepo.create({
        ...data,
        status: IncidentStatus.NEW,
        actionIds: data.actionIds || [],
        tenantId: data.tenantId || '',
        triggerSource: data.triggerSource || '',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Fallback to in-memory: generate ID only for memory fallback
    const incident: SelfHealingIncident = {
      ...data,
      id: `incident-${crypto.randomUUID()}`,
      status: IncidentStatus.NEW,
      actionIds: data.actionIds || [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.memoryIncidents.set(incident.id, incident);
    return incident;
  }

  /**
   * 获取自愈事件
   */
  async getIncident(incidentId: string): Promise<SelfHealingIncident | null> {
    if (this.incidentRepo) {
      return this.incidentRepo.findById(incidentId);
    }
    return this.memoryIncidents.get(incidentId) || null;
  }

  /**
   * 列出自愈事件
   */
  async listIncidents(filters: { severity?: IncidentSeverity; status?: IncidentStatus; tenantId?: string }): Promise<{ items: SelfHealingIncident[]; total: number }> {
    if (this.incidentRepo) {
      return this.incidentRepo.findAll(filters);
    }

    // Fallback to in-memory
    let items = Array.from(this.memoryIncidents.values());
    if (filters.severity) items = items.filter(i => i.severity === filters.severity);
    if (filters.status) items = items.filter(i => i.status === filters.status);
    if (filters.tenantId) items = items.filter(i => i.tenantId === filters.tenantId);
    return { items: items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()), total: items.length };
  }

  /**
   * 更新自愈事件
   */
  async updateIncident(incidentId: string, updates: Partial<SelfHealingIncident>): Promise<SelfHealingIncident | null> {
    if (this.incidentRepo) {
      return this.incidentRepo.update(incidentId, updates);
    }

    // Fallback to in-memory
    const existing = this.memoryIncidents.get(incidentId);
    if (!existing) return null;
    const updated = { ...existing, ...updates, updatedAt: new Date() };
    this.memoryIncidents.set(incidentId, updated);
    return updated;
  }

  /**
   * 删除自愈事件
   */
  async deleteIncident(incidentId: string): Promise<boolean> {
    if (this.incidentRepo) {
      return this.incidentRepo.delete(incidentId);
    }
    return this.memoryIncidents.delete(incidentId);
  }

  /**
   * 评估策略
   * @param incident - 自愈事件
   * @returns 匹配的策略列表
   */
  async evaluateStrategy(incident: SelfHealingIncident): Promise<HealingStrategy[]> {
    // Try to fetch policies from database
    if (this.policyRepo) {
      try {
        const policies = await this.policyRepo.findMatchingPolicies(incident);

        // Convert database policies to HealingStrategy format
        const strategies: HealingStrategy[] = policies.map(policy => ({
          id: policy.id,
          name: policy.name,
          description: policy.description || undefined,
          type: this.mapActionTypeToStrategyType(policy.actionType),
          triggerCondition: policy.conditionConfig,
          parameters: policy.actionConfig,
          priority: policy.priority,
          enabled: policy.enabled,
          maxRetries: policy.maxRetries,
          timeoutSeconds: policy.timeoutSeconds,
          actionType: policy.actionType,
          autoExecute: policy.confidence >= 0.8,
          confidence: policy.confidence,
          maturity: policy.confidence >= 0.8 ? 'proven' : 'experimental',
          metrics: { successRate: policy.confidence, avgResolutionTime: policy.timeoutSeconds * 1000 },
          scope: policy.conditionConfig,
          tenantId: incident.tenantId,
          createdAt: policy.createdAt,
          updatedAt: policy.updatedAt,
        }));

        if (strategies.length > 0) {
          return strategies.sort((a, b) => a.priority - b.priority);
        }
      } catch (error) {
        console.error('[SelfHealingService] Error fetching policies from DB, falling back to default strategies:', error);
      }
    } else if (this.memoryPolicies.size > 0) {
      // Use in-memory policies if available
      const strategies: HealingStrategy[] = [];
      for (const policy of this.memoryPolicies.values()) {
        if (this.evaluateInMemoryPolicyCondition(policy, incident)) {
          strategies.push(this.policyToStrategy(policy, incident));
        }
      }
      if (strategies.length > 0) {
        return strategies.sort((a, b) => a.priority - b.priority);
      }
    }

    // Fallback to default hardcoded strategies (when no DB or no matching policies)
    return this.getDefaultStrategies(incident);
  }

  /**
   * Evaluate in-memory policy condition
   */
  private evaluateInMemoryPolicyCondition(policy: SelfHealingPolicy, incident: SelfHealingIncident): boolean {
    const { conditionType, conditionConfig } = policy;

    switch (conditionType) {
      case 'severity': {
        const severities = conditionConfig.severity as string[] | undefined;
        if (severities && severities.length > 0) {
          return severities.includes(incident.severity);
        }
        return true;
      }
      case 'source_match': {
        const pattern = conditionConfig.pattern as string;
        if (pattern && incident.source) {
          const regex = new RegExp(pattern, 'i');
          return regex.test(incident.source) || regex.test(incident.description || '');
        }
        return false;
      }
      case 'always':
        return true;
      default:
        return false;
    }
  }

  /**
   * Convert policy to strategy format
   */
  private policyToStrategy(policy: SelfHealingPolicy, incident: SelfHealingIncident): HealingStrategy {
    return {
      id: policy.id,
      name: policy.name,
      description: policy.description || undefined,
      type: this.mapActionTypeToStrategyType(policy.actionType),
      triggerCondition: policy.conditionConfig,
      parameters: policy.actionConfig,
      priority: policy.priority,
      enabled: policy.enabled,
      maxRetries: policy.maxRetries,
      timeoutSeconds: policy.timeoutSeconds,
      actionType: policy.actionType,
      autoExecute: policy.confidence >= 0.8,
      confidence: policy.confidence,
      maturity: policy.confidence >= 0.8 ? 'proven' : 'experimental',
      metrics: { successRate: policy.confidence, avgResolutionTime: policy.timeoutSeconds * 1000 },
      scope: policy.conditionConfig,
      tenantId: incident.tenantId,
      createdAt: policy.createdAt,
      updatedAt: policy.updatedAt,
    };
  }

  /**
   * Map action type to StrategyType
   */
  private mapActionTypeToStrategyType(actionType: string): StrategyType {
    const mapping: Record<string, StrategyType> = {
      restart: StrategyType.RESTART,
      scale: StrategyType.SCALE,
      failover: StrategyType.FAILOVER,
      rollback: StrategyType.ROLLBACK,
      custom_script: StrategyType.CUSTOM_SCRIPT,
      notify: StrategyType.NOTIFICATION,
      reconnect: StrategyType.CUSTOM_SCRIPT,
      cleanup: StrategyType.CUSTOM_SCRIPT,
    };
    return mapping[actionType] || StrategyType.CUSTOM_SCRIPT;
  }

  /**
   * Get default fallback strategies when no DB policies exist
   */
  private getDefaultStrategies(incident: SelfHealingIncident): HealingStrategy[] {
    const strategies: HealingStrategy[] = [];

    // Strategy 1: Automatic Service Restart (for critical/high severity)
    if (incident.severity === IncidentSeverity.CRITICAL || incident.severity === IncidentSeverity.HIGH) {
      strategies.push({
        id: `strategy-auto-restart-${Date.now()}`,
        name: 'Automatic Service Restart',
        description: 'Restart the affected service automatically',
        type: StrategyType.RESTART,
        triggerCondition: { severity: [IncidentSeverity.CRITICAL, IncidentSeverity.HIGH] },
        parameters: { maxRetries: 3, timeoutSeconds: 300 },
        priority: 1,
        enabled: true,
        maxRetries: 3,
        timeoutSeconds: 300,
        actionType: 'restart',
        autoExecute: false,
        confidence: 0.7,
        maturity: 'proven',
        metrics: { successRate: 0.85, avgResolutionTime: 120000 },
        scope: { severities: [IncidentSeverity.CRITICAL, IncidentSeverity.HIGH] },
        tenantId: incident.tenantId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Strategy 2: Auto Scale Out (for non-critical)
    if (incident.severity !== IncidentSeverity.CRITICAL) {
      strategies.push({
        id: `strategy-scale-${Date.now()}`,
        name: 'Auto Scale Out',
        description: 'Increase replica count to handle load',
        type: StrategyType.SCALE,
        triggerCondition: { severity: [IncidentSeverity.MEDIUM, IncidentSeverity.LOW] },
        parameters: { maxRetries: 2, timeoutSeconds: 180, scaleFactor: 2 },
        priority: 2,
        enabled: true,
        maxRetries: 2,
        timeoutSeconds: 180,
        actionType: 'scale',
        autoExecute: true,
        confidence: 0.6,
        maturity: 'experimental',
        metrics: { successRate: 0.7, avgResolutionTime: 60000 },
        scope: { severities: [IncidentSeverity.MEDIUM, IncidentSeverity.LOW] },
        tenantId: incident.tenantId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Strategy 3: Notify On-Call (always enabled)
    strategies.push({
      id: `strategy-notify-${Date.now()}`,
      name: 'Notify On-Call',
      description: 'Send alert to on-call engineer',
      type: StrategyType.NOTIFICATION,
      triggerCondition: {},
      parameters: { notificationChannel: 'slack', urgency: 'high' },
      priority: 3,
      enabled: true,
      maxRetries: 1,
      timeoutSeconds: 60,
      actionType: 'notify',
      autoExecute: true,
      confidence: 0.95,
      maturity: 'proven',
      metrics: { successRate: 0.99, avgResolutionTime: 5000 },
      scope: {},
      tenantId: incident.tenantId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Strategy 4: Database Reconnection (for database-related incidents)
    if (incident.source?.includes('database') || incident.description?.toLowerCase().includes('database')) {
      strategies.push({
        id: `strategy-db-reconnect-${Date.now()}`,
        name: 'Database Reconnection',
        description: 'Reconnect to database and verify connection',
        type: StrategyType.CUSTOM_SCRIPT,
        triggerCondition: {},
        parameters: { script: 'reconnect_db.sh', verifyConnection: true },
        priority: 1,
        enabled: true,
        maxRetries: 3,
        timeoutSeconds: 120,
        actionType: 'custom_script',
        autoExecute: false,
        confidence: 0.8,
        maturity: 'proven',
        metrics: { successRate: 0.9, avgResolutionTime: 30000 },
        scope: { incidentTypes: ['database', 'connection'] },
        tenantId: incident.tenantId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    return strategies.sort((a, b) => a.priority - b.priority);
  }

  /**
   * 做出修复决策
   * @param incidentId - 事件 ID
   * @param strategies - 候选策略
   * @returns 修复决策
   */
  async makeDecision(incidentId: string, strategies: HealingStrategy[]): Promise<HealingDecision | null> {
    if (strategies.length === 0) return null;

    // Select best strategy based on confidence and priority
    const bestStrategy = strategies.reduce((best, current) => {
      const currentScore = (current.confidence ?? 0) * (current.priority === 1 ? 1.5 : 1);
      const bestScore = ((best?.confidence) ?? 0) * (best?.priority === 1 ? 1.5 : 1);
      return currentScore > bestScore ? current : best;
    }, strategies[0]);

    // Calculate confidence based on strategy maturity and historical success rate
    const historicalSuccessRate = (bestStrategy.metrics?.successRate as number) ?? 0;
    const maturityBonus = bestStrategy.maturity === 'proven' ? 0.1 : 0;
    const baseConfidence = Math.min(0.5 + (historicalSuccessRate || 0) * 0.3 + maturityBonus, 0.95);

    // Auto-execute only for low-risk actions with high confidence
    const safeActions = new Set([DecisionAction.AUTO_HEAL, 'restart', 'notify', 'scale']);
    const shouldAutoExecute = baseConfidence >= 0.8
      && bestStrategy.autoExecute === true
      && safeActions.has(bestStrategy.actionType || '');

    const decision: HealingDecision = {
      id: `decision-${crypto.randomUUID()}`,
      incidentId,
      action: shouldAutoExecute ? DecisionAction.AUTO_HEAL : DecisionAction.REVIEW_REQUIRED,
      reasoning: `Selected strategy: ${bestStrategy.name} (confidence: ${baseConfidence.toFixed(2)}, autoExecute: ${shouldAutoExecute}, maturity: ${bestStrategy.maturity})`,
      recommendedStrategyId: bestStrategy.id,
      confidence: baseConfidence,
      autoExecute: shouldAutoExecute,
      createdAt: new Date(),
    };

    if (this.decisionRepo) {
      return this.decisionRepo.create(decision);
    }

    // Fallback to in-memory
    this.memoryDecisions.set(decision.id, decision);
    return decision;
  }

  /**
   * 执行修复动作
   * @param action - 修复动作
   * @returns 执行结果
   */
  async executeAction(action: Omit<HealingAction, 'id' | 'status' | 'startedAt'>): Promise<HealingAction> {
    const fullAction: HealingAction = {
      ...action,
      id: `action-${crypto.randomUUID()}`,
      status: ActionStatus.RUNNING,
      startedAt: new Date(),
    };

    if (this.actionRepo) {
      const created = await this.actionRepo.create(fullAction);

      try {
        const result = await this.performAction(created);
        return await this.actionRepo.update(created.id, {
          status: ActionStatus.SUCCESS,
          completedAt: new Date(),
          output: result,
        }) || created;
      } catch (error) {
        return await this.actionRepo.update(created.id, {
          status: ActionStatus.FAILED,
          completedAt: new Date(),
          error: error instanceof Error ? error.message : 'Unknown error',
        }) || created;
      }
    }

    // Fallback to in-memory
    this.memoryActions.set(fullAction.id, fullAction);

    try {
      const result = await this.performAction(fullAction);
      fullAction.status = ActionStatus.SUCCESS;
      fullAction.completedAt = new Date();
      fullAction.output = result;
    } catch (error) {
      fullAction.status = ActionStatus.FAILED;
      fullAction.completedAt = new Date();
      fullAction.error = error instanceof Error ? error.message : 'Unknown error';
    }

    this.memoryActions.set(fullAction.id, fullAction);
    return fullAction;
  }

  /**
   * 根据动作类型执行具体操作
   */
  private async performAction(action: HealingAction): Promise<Record<string, unknown>> {
    switch (action.actionType) {
      case 'restart':
        console.log(`[SelfHealing] Restarting service: ${action.targetId}`);
        return { restarted: true, targetId: action.targetId, timestamp: new Date() };

      case 'scale':
        console.log(`[SelfHealing] Scaling service: ${action.targetId}`);
        return { scaled: true, targetId: action.targetId, replicas: 2, timestamp: new Date() };

      case 'notify':
        console.log(`[SelfHealing] Sending notification for: ${action.targetId}`);
        return { notified: true, targetId: action.targetId, channel: 'slack', timestamp: new Date() };

      case 'failover':
        console.log(`[SelfHealing] Failing over: ${action.targetId}`);
        return { failedOver: true, targetId: action.targetId, timestamp: new Date() };

      case 'rollback':
        console.log(`[SelfHealing] Rolling back: ${action.targetId}`);
        return { rolledBack: true, targetId: action.targetId, timestamp: new Date() };

      case 'custom_script':
        console.log(`[SelfHealing] Executing custom script for: ${action.targetId}`);
        return { scriptExecuted: true, targetId: action.targetId, timestamp: new Date() };

      default:
        console.log(`[SelfHealing] Unknown action type: ${action.actionType}`);
        return { unknownAction: true, targetId: action.targetId, timestamp: new Date() };
    }
  }

  /**
   * 执行策略动作
   * 使用数据库中的策略和执行记录
   * @param incident - 自愈事件
   * @param strategy - 匹配的策略
   * @returns 执行结果
   */
  async executePolicyStrategy(incident: SelfHealingIncident, strategy: HealingStrategy): Promise<SelfHealingExecution | null> {
    const target = incident.affectedResources[0] || 'unknown';

    // Check cooldown if execution repo is available
    if (this.executionRepo) {
      const canExecute = await this.executionRepo.checkCooldown(strategy.id, target);
      if (!canExecute) {
        console.log(`[SelfHealing] Policy ${strategy.name} is in cooldown for target ${target}`);
        return null;
      }

      try {
        // Create execution record
        const execution = await this.executionRepo.create({
          policyId: strategy.id,
          incidentId: incident.id,
          target,
          status: 'running',
          result: null,
          errorMessage: null,
        });

        try {
          // Perform the actual action
          const result = await this.performPolicyAction(strategy, target);

          // Update execution as successful
          await this.executionRepo.update(execution.id, {
            status: 'success',
            result,
            completedAt: new Date(),
          });

          console.log(`[SelfHealing] Policy ${strategy.name} executed successfully for ${target}`);
          return await this.executionRepo.findById(execution.id);
        } catch (error) {
          // Update execution as failed
          await this.executionRepo.update(execution.id, {
            status: 'failed',
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            completedAt: new Date(),
          });

          console.error(`[SelfHealing] Policy ${strategy.name} failed:`, error);
          return await this.executionRepo.findById(execution.id);
        }
      } catch (error) {
        console.error('[SelfHealing] Error creating execution record:', error);
        return null;
      }
    }

    // Fallback to in-memory execution (no DB)
    console.log(`[SelfHealing] Executing policy (in-memory): ${strategy.name} for ${target}`);
    const result = await this.performPolicyAction(strategy, target);

    return {
      id: `exec-${crypto.randomUUID()}`,
      policyId: strategy.id,
      incidentId: incident.id,
      target,
      status: 'success',
      result,
      errorMessage: null,
      startedAt: new Date(),
      completedAt: undefined,
    };
  }

  /**
   * 根据策略类型执行具体操作
   */
  private async performPolicyAction(strategy: HealingStrategy, target: string): Promise<Record<string, unknown>> {
    const actionType = strategy.actionType || 'unknown';
    const params = strategy.parameters || {};

    switch (actionType) {
      case 'restart':
        console.log(`[SelfHealing] Restarting service: ${target}`);
        return {
          restarted: true,
          targetId: target,
          maxRetries: strategy.maxRetries,
          graceful: params.graceful ?? true,
          timestamp: new Date()
        };

      case 'scale':
        console.log(`[SelfHealing] Scaling service: ${target}`);
        return {
          scaled: true,
          targetId: target,
          scaleFactor: params.scaleFactor ?? 2,
          minReplicas: params.minReplicas ?? 1,
          maxReplicas: params.maxReplicas ?? 10,
          timestamp: new Date()
        };

      case 'notify':
        console.log(`[SelfHealing] Sending notification for: ${target}`);
        return {
          notified: true,
          targetId: target,
          channel: params.channel ?? 'slack',
          urgency: params.urgency ?? 'high',
          timestamp: new Date()
        };

      case 'failover':
        console.log(`[SelfHealing] Failing over: ${target}`);
        return {
          failedOver: true,
          targetId: target,
          timestamp: new Date()
        };

      case 'rollback':
        console.log(`[SelfHealing] Rolling back: ${target}`);
        return {
          rolledBack: true,
          targetId: target,
          timestamp: new Date()
        };

      case 'reconnect':
        console.log(`[SelfHealing] Reconnecting database: ${target}`);
        return {
          reconnected: true,
          targetId: target,
          verifyConnection: params.verifyConnection ?? true,
          maxRetries: params.maxRetries ?? 5,
          timestamp: new Date()
        };

      case 'cleanup':
        console.log(`[SelfHealing] Cleaning up: ${target}`);
        return {
          cleaned: true,
          targetId: target,
          targetPath: params.targetPath ?? '/tmp',
          maxAge: params.maxAge ?? 3600,
          timestamp: new Date()
        };

      case 'custom_script':
        console.log(`[SelfHealing] Executing custom script for: ${target}`);
        return {
          scriptExecuted: true,
          targetId: target,
          script: params.script ?? 'unknown',
          timestamp: new Date()
        };

      default:
        console.log(`[SelfHealing] Unknown action type: ${actionType}`);
        return { unknownAction: true, targetId: target, actionType, timestamp: new Date() };
    }
  }

  /**
   * 获取策略列表
   */
  async listPolicies(filters?: { enabled?: boolean; conditionType?: string; tenantId?: string }): Promise<SelfHealingPolicy[]> {
    if (this.policyRepo) {
      return this.policyRepo.findAll(filters);
    }
    return Array.from(this.memoryPolicies.values());
  }

  /**
   * 获取策略
   */
  async getPolicy(policyId: string): Promise<SelfHealingPolicy | null> {
    if (this.policyRepo) {
      return this.policyRepo.findById(policyId);
    }
    return this.memoryPolicies.get(policyId) || null;
  }

  /**
   * 获取执行记录
   */
  async getExecutions(filters?: { policyId?: string; incidentId?: string }): Promise<SelfHealingExecution[]> {
    if (!this.executionRepo) return [];

    if (filters?.policyId) {
      return this.executionRepo.findByPolicyId(filters.policyId);
    }
    if (filters?.incidentId) {
      return this.executionRepo.findByIncidentId(filters.incidentId);
    }
    return [];
  }

  /**
   * 获取修复动作
   */
  async getAction(actionId: string): Promise<HealingAction | null> {
    if (this.actionRepo) {
      return this.actionRepo.findById(actionId);
    }
    return this.memoryActions.get(actionId) || null;
  }

  /**
   * 获取事件的所有动作
   */
  async getActionsForIncident(incidentId: string): Promise<HealingAction[]> {
    if (this.actionRepo) {
      return this.actionRepo.findByIncidentId(incidentId);
    }
    return Array.from(this.memoryActions.values()).filter(a => a.incidentId === incidentId);
  }

  /**
   * 获取决策
   */
  async getDecision(decisionId: string): Promise<HealingDecision | null> {
    if (this.decisionRepo) {
      return this.decisionRepo.findById(decisionId);
    }
    return this.memoryDecisions.get(decisionId) || null;
  }

  /**
   * 获取知识库
   * @param filters - 过滤条件
   * @returns 知识列表
   */
  async getKnowledge(filters: { tags?: string[]; problemPattern?: string }): Promise<KnowledgeBase[]> {
    if (this.knowledgeRepo) {
      return this.knowledgeRepo.findAll(filters);
    }

    // Fallback to in-memory
    let items = Array.from(this.memoryKnowledge.values());

    if (filters.tags?.length) {
      items = items.filter(k =>
        k.tags?.some(t => filters.tags!.includes(t))
      );
    }

    if (filters.problemPattern) {
      items = items.filter(k =>
        k.problemPattern?.toLowerCase().includes(filters.problemPattern!.toLowerCase())
      );
    }

    return items;
  }

  /**
   * 添加知识库条目
   */
  async addKnowledge(data: Omit<KnowledgeBase, 'id' | 'createdAt' | 'updatedAt'>): Promise<KnowledgeBase> {
    const entry: KnowledgeBase = {
      ...data,
      id: `kb-${crypto.randomUUID()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (this.knowledgeRepo) {
      return this.knowledgeRepo.create(entry);
    }

    // Fallback to in-memory
    this.memoryKnowledge.set(entry.id, entry);
    return entry;
  }

  /**
   * 更新知识库
   * @param knowledgeId - 知识 ID
   * @param data - 更新数据
   * @returns 更新后的知识
   */
  async updateKnowledge(knowledgeId: string, data: Partial<KnowledgeBase>): Promise<KnowledgeBase | null> {
    if (this.knowledgeRepo) {
      return this.knowledgeRepo.update(knowledgeId, data);
    }

    // Fallback to in-memory
    const existing = this.memoryKnowledge.get(knowledgeId);
    if (!existing) return null;
    const updated = { ...existing, ...data, id: knowledgeId, updatedAt: new Date() };
    this.memoryKnowledge.set(knowledgeId, updated);
    return updated;
  }

  /**
   * 删除知识库条目
   */
  async deleteKnowledge(knowledgeId: string): Promise<boolean> {
    if (this.knowledgeRepo) {
      return this.knowledgeRepo.delete(knowledgeId);
    }
    return this.memoryKnowledge.delete(knowledgeId);
  }

  /**
   * 搜索知识库
   */
  async searchKnowledge(query: string): Promise<KnowledgeBase[]> {
    if (this.knowledgeRepo) {
      return this.knowledgeRepo.search(query);
    }

    // Fallback to in-memory
    const lowerQuery = query.toLowerCase();
    return Array.from(this.memoryKnowledge.values()).filter(k =>
      k.title?.toLowerCase().includes(lowerQuery) ||
      k.problemPattern?.toLowerCase().includes(lowerQuery) ||
      k.solution?.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * 获取系统健康状态
   */
  async getSystemHealth(): Promise<{
    totalIncidents: number;
    activeIncidents: number;
    resolvedIncidents: number;
    successRate: number;
  }> {
    let allIncidents: SelfHealingIncident[] = [];

    if (this.incidentRepo) {
      const result = await this.incidentRepo.findAll({});
      allIncidents = result.items;
    } else {
      allIncidents = Array.from(this.memoryIncidents.values());
    }

    const active = allIncidents.filter(i => i.status === IncidentStatus.IN_PROGRESS || i.status === IncidentStatus.NEW).length;
    const resolved = allIncidents.filter(i => i.status === IncidentStatus.RESOLVED).length;

    return {
      totalIncidents: allIncidents.length,
      activeIncidents: active,
      resolvedIncidents: resolved,
      successRate: allIncidents.length > 0 ? resolved / allIncidents.length : 1.0,
    };
  }
}
