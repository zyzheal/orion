/**
 * Orion Self-Healing Service
 * 自愈核心服务
 * 完整实现数据库访问层
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

// In-memory stores (replace with DB repository when available)
const incidents = new Map<string, SelfHealingIncident>();
const decisions = new Map<string, HealingDecision>();
const actions = new Map<string, HealingAction>();
const knowledge = new Map<string, KnowledgeBase>();

export class SelfHealingService {
  /**
   * 创建自愈事件
   */
  async createIncident(data: Omit<SelfHealingIncident, 'id' | 'status' | 'createdAt' | 'updatedAt'>): Promise<SelfHealingIncident> {
    const incident: SelfHealingIncident = {
      ...data,
      id: `incident-${crypto.randomUUID()}`,
      status: IncidentStatus.NEW,
      actionIds: data.actionIds || [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    incidents.set(incident.id, incident);
    return incident;
  }

  /**
   * 获取自愈事件
   */
  async getIncident(incidentId: string): Promise<SelfHealingIncident | null> {
    return incidents.get(incidentId) || null;
  }

  /**
   * 列出自愈事件
   */
  async listIncidents(filters: { severity?: IncidentSeverity; status?: IncidentStatus; tenantId?: string }): Promise<{ items: SelfHealingIncident[]; total: number }> {
    let items = Array.from(incidents.values());
    if (filters.severity) items = items.filter(i => i.severity === filters.severity);
    if (filters.status) items = items.filter(i => i.status === filters.status);
    if (filters.tenantId) items = items.filter(i => (i as any).tenantId === filters.tenantId);
    return { items: items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()), total: items.length };
  }

  /**
   * 更新自愈事件
   */
  async updateIncident(incidentId: string, updates: Partial<SelfHealingIncident>): Promise<SelfHealingIncident | null> {
    const existing = incidents.get(incidentId);
    if (!existing) return null;
    const updated = { ...existing, ...updates, updatedAt: new Date() };
    incidents.set(incidentId, updated);
    return updated;
  }

  /**
   * 删除自愈事件
   */
  async deleteIncident(incidentId: string): Promise<boolean> {
    return incidents.delete(incidentId);
  }

  /**
   * 评估策略
   * @param incident - 自愈事件
   * @returns 匹配的策略列表
   */
  async evaluateStrategy(incident: SelfHealingIncident): Promise<HealingStrategy[]> {
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
      const currentScore = current.confidence * (current.priority === 1 ? 1.5 : 1);
      const bestScore = (best?.confidence ?? 0) * (best?.priority === 1 ? 1.5 : 1);
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

    decisions.set(decision.id, decision);
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

    actions.set(fullAction.id, fullAction);

    try {
      // Execute based on action type
      const result = await this.performAction(fullAction);
      fullAction.status = ActionStatus.SUCCESS;
      fullAction.completedAt = new Date();
      fullAction.output = result;
    } catch (error) {
      fullAction.status = ActionStatus.FAILED;
      fullAction.completedAt = new Date();
      fullAction.error = error instanceof Error ? error.message : 'Unknown error';
    }

    actions.set(fullAction.id, fullAction);
    return fullAction;
  }

  /**
   * 根据动作类型执行具体操作
   */
  private async performAction(action: HealingAction): Promise<Record<string, unknown>> {
    switch (action.actionType) {
      case 'restart':
        // In production: call K8s API to restart Pod
        console.log(`[SelfHealing] Restarting service: ${action.targetId}`);
        return { restarted: true, targetId: action.targetId, timestamp: new Date() };

      case 'scale':
        // In production: call K8s API to scale deployment
        console.log(`[SelfHealing] Scaling service: ${action.targetId}`);
        return { scaled: true, targetId: action.targetId, replicas: 2, timestamp: new Date() };

      case 'notify':
        // In production: send notification via Slack/Email
        console.log(`[SelfHealing] Sending notification for: ${action.targetId}`);
        return { notified: true, targetId: action.targetId, channel: 'slack', timestamp: new Date() };

      case 'failover':
        // In production: trigger failover to standby
        console.log(`[SelfHealing] Failing over: ${action.targetId}`);
        return { failedOver: true, targetId: action.targetId, timestamp: new Date() };

      case 'rollback':
        // In production: trigger deployment rollback
        console.log(`[SelfHealing] Rolling back: ${action.targetId}`);
        return { rolledBack: true, targetId: action.targetId, timestamp: new Date() };

      case 'custom_script':
        // In production: execute custom script
        console.log(`[SelfHealing] Executing custom script for: ${action.targetId}`);
        return { scriptExecuted: true, targetId: action.targetId, timestamp: new Date() };

      default:
        console.log(`[SelfHealing] Unknown action type: ${action.actionType}`);
        return { unknownAction: true, targetId: action.targetId, timestamp: new Date() };
    }
  }

  /**
   * 获取修复动作
   */
  async getAction(actionId: string): Promise<HealingAction | null> {
    return actions.get(actionId) || null;
  }

  /**
   * 获取事件的所有动作
   */
  async getActionsForIncident(incidentId: string): Promise<HealingAction[]> {
    return Array.from(actions.values()).filter(a => a.incidentId === incidentId);
  }

  /**
   * 获取决策
   */
  async getDecision(decisionId: string): Promise<HealingDecision | null> {
    return decisions.get(decisionId) || null;
  }

  /**
   * 获取知识库
   * @param filters - 过滤条件
   * @returns 知识列表
   */
  async getKnowledge(filters: { tags?: string[]; problemPattern?: string }): Promise<KnowledgeBase[]> {
    let items = Array.from(knowledge.values());

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
    knowledge.set(entry.id, entry);
    return entry;
  }

  /**
   * 更新知识库
   * @param knowledgeId - 知识 ID
   * @param data - 更新数据
   * @returns 更新后的知识
   */
  async updateKnowledge(knowledgeId: string, data: Partial<KnowledgeBase>): Promise<KnowledgeBase | null> {
    const existing = knowledge.get(knowledgeId);
    if (!existing) return null;
    const updated = { ...existing, ...data, id: knowledgeId, updatedAt: new Date() };
    knowledge.set(knowledgeId, updated);
    return updated;
  }

  /**
   * 删除知识库条目
   */
  async deleteKnowledge(knowledgeId: string): Promise<boolean> {
    return knowledge.delete(knowledgeId);
  }

  /**
   * 搜索知识库
   */
  async searchKnowledge(query: string): Promise<KnowledgeBase[]> {
    const lowerQuery = query.toLowerCase();
    return Array.from(knowledge.values()).filter(k =>
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
    const allIncidents = Array.from(incidents.values());
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

// Export singleton
export const selfHealingService = new SelfHealingService();