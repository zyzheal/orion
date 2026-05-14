/**
 * DispatchEngine - 智能派单引擎
 * 基于多维度匹配算法的工单分配引擎
 * 支持多种派单策略和自动升级
 */

import {
  DispatchRequest,
  DispatchResult,
  DispatchCandidate,
  DispatchRule,
  DispatchStatus,
  DispatchStrategy,
  DispatchCondition,
  MatchDetail,
  MatchWeights,
  Ticket,
  TicketStatus,
} from '../types/ticket';
import {
  EngineerProfile,
  DispatchWeights,
  TicketCategory,
} from '../types/ticketing';

type EngineerAvailability = 'available' | 'busy' | 'away' | 'offline' | 'on-call';

// In-memory stores
const dispatchRules = new Map<string, DispatchRule>();
const engineers = new Map<string, EngineerProfile>();
const dispatchHistory: DispatchResult[] = [];
const tickets = new Map<string, Ticket>();

export interface UserSkill {
  userId: string;
  skillId: string;
  level: number; // 1-5
}

export interface UserWorkload {
  userId: string;
  activeTicketCount: number;
  maxTicketCapacity: number;
  utilizationRate: number;
}

export class DispatchEngine {
  // 默认匹配权重
  private defaultWeights: MatchWeights = {
    skill: 0.35,
    workload: 0.25,
    availability: 0.20,
    history: 0.20,
  };

  constructor(_options?: { ticketingRepository?: any }) {
    // Accept constructor options for future implementation
  }

  // ============================================================
  // 自动派单主入口
  // ============================================================

  /**
   * 自动派单
   */
  async autoDispatch(
    request: DispatchRequest,
    tenantId: string
  ): Promise<DispatchResult> {
    const ticket = tickets.get(request.ticketId);
    if (!ticket) {
      throw new Error(`Ticket not found: ${request.ticketId}`);
    }

    // Step 1: 查找匹配的派单规则
    const rule = await this.findMatchingRule(ticket, tenantId);
    const strategy = rule?.strategy ?? request.strategy ?? DispatchStrategy.AI_RECOMMENDED;

    // Step 2: 根据策略查找候选人
    const candidates = await this.findCandidatesByStrategy(
      ticket,
      strategy,
      tenantId
    );

    // Step 3: 计算匹配分数
    const scoredCandidates = await this.scoreCandidates(
      ticket,
      candidates
    );

    // Step 4: 选择最佳候选人
    const bestCandidate = scoredCandidates[0];

    // Step 5: 执行分配
    const result: DispatchResult = {
      dispatchId: crypto.randomUUID(),
      ticketId: request.ticketId,
      status: bestCandidate && bestCandidate.matchScore > 60 ? DispatchStatus.ASSIGNED : DispatchStatus.PENDING,
      assignedTo: bestCandidate?.userId ?? null,
      candidates: scoredCandidates.slice(0, 5),
      matchDetails: scoredCandidates.slice(0, 5).map(c => ({
        userId: c.userId,
        skillScore: c.skillLevel / 5,
        workloadScore: 1 - c.currentWorkload,
        availabilityScore: c.availability ? 1 : 0,
        historyScore: 0.5,
        weights: this.defaultWeights,
        totalScore: c.matchScore / 100,
      })),
      dispatchedAt: new Date(),
    };

    // Step 6: 记录派单结果
    dispatchHistory.push(result);

    // Update ticket assignee
    if (ticket && result.assignedTo) {
      ticket.assigneeId = result.assignedTo;
      ticket.status = TicketStatus.OPEN;
      tickets.set(ticket.id, ticket);
    }

    return result;
  }

  // ============================================================
  // 候选人匹配
  // ============================================================

  /**
   * 查找最佳匹配人员
   */
  async findBestMatch(
    ticketId: string,
    tenantId: string
  ): Promise<DispatchResult> {
    const ticket = tickets.get(ticketId);
    if (!ticket) {
      throw new Error(`Ticket not found: ${ticketId}`);
    }

    const candidates = await this.findCandidatesByStrategy(
      ticket,
      DispatchStrategy.AI_RECOMMENDED,
      tenantId
    );
    const scored = await this.scoreCandidates(ticket, candidates);

    return {
      dispatchId: crypto.randomUUID(),
      ticketId,
      status: scored[0] && scored[0].matchScore > 60 ? DispatchStatus.ASSIGNED : DispatchStatus.PENDING,
      assignedTo: scored[0]?.userId ?? null,
      candidates: scored.slice(0, 5),
      matchDetails: scored.slice(0, 5).map(c => ({
        userId: c.userId,
        skillScore: c.skillLevel / 5,
        workloadScore: 1 - c.currentWorkload,
        availabilityScore: c.availability ? 1 : 0,
        historyScore: 0.5,
        weights: this.defaultWeights,
        totalScore: c.matchScore / 100,
      })),
      dispatchedAt: new Date(),
    };
  }

  /**
   * 加载工单数据（用于测试）
   */
  loadTickets(ticketList: Ticket[]): void {
    for (const t of ticketList) {
      tickets.set(t.id, t);
    }
  }

  // ============================================================
  // 策略实现
  // ============================================================

  /**
   * 根据策略类型查找候选人
   */
  private async findCandidatesByStrategy(
    ticket: Ticket,
    strategy: DispatchStrategy,
    tenantId: string
  ): Promise<DispatchCandidate[]> {
    switch (strategy) {
      case DispatchStrategy.ROUND_ROBIN:
        return this.roundRobinDispatch(ticket.assigneeId ?? 'default', ticket);
      case DispatchStrategy.LEAST_LOADED:
        return this.leastLoadedDispatch(ticket.assigneeId ?? 'default', ticket);
      case DispatchStrategy.SKILL_BASED:
        return this.skillBasedDispatch(ticket, tenantId);
      case DispatchStrategy.LOAD_BALANCED:
        return this.loadBalancedDispatch(ticket, tenantId);
      case DispatchStrategy.AI_RECOMMENDED:
      default:
        return this.aiRecommendedDispatch(ticket, tenantId);
    }
  }

  /**
   * 轮询策略
   */
  private async roundRobinDispatch(
    groupId: string,
    _ticket: Ticket
  ): Promise<DispatchCandidate[]> {
    const groupMembers = Array.from(engineers.values()).filter(
      (e) => e.availability === 'available'
    );

    // Sort by last dispatch time (oldest first)
    const sorted = groupMembers.sort((a, b) => {
      const aLast = this.getLastDispatchTime(a.id);
      const bLast = this.getLastDispatchTime(b.id);
      return aLast.getTime() - bLast.getTime();
    });

    return sorted.map((e) => this.toCandidate(e));
  }

  /**
   * 最少负载策略
   */
  private async leastLoadedDispatch(
    groupId: string,
    _ticket: Ticket
  ): Promise<DispatchCandidate[]> {
    const groupMembers = Array.from(engineers.values()).filter(
      (e) => e.availability === 'available'
    );

    const candidates = groupMembers.map((e) => {
      const workload = this.getEngineerWorkload(e.id);
      return {
        ...this.toCandidate(e),
        currentWorkload: workload.utilizationRate,
      };
    });

    return candidates.sort(
      (a, b) => (a.currentWorkload ?? 0) - (b.currentWorkload ?? 0)
    );
  }

  /**
   * 基于技能的策略
   */
  private async skillBasedDispatch(
    ticket: Ticket,
    _tenantId: string
  ): Promise<DispatchCandidate[]> {
    const availableEngineers = Array.from(engineers.values()).filter(
      (e) => e.availability === 'available'
    );

    // Match by required skills from ticket type/category
    const candidates = availableEngineers
      .map((e) => {
        const skillLevel = this.getSkillMatchLevel(e, ticket);
        return {
          ...this.toCandidate(e),
          skillLevel,
          currentWorkload: this.getEngineerWorkload(e.id).utilizationRate,
        };
      })
      .filter((c) => c.skillLevel > 0)
      .sort((a, b) => b.skillLevel - a.skillLevel);

    return candidates;
  }

  /**
   * 负载均衡策略
   */
  private async loadBalancedDispatch(
    ticket: Ticket,
    tenantId: string
  ): Promise<DispatchCandidate[]> {
    const skillCandidates = await this.skillBasedDispatch(ticket, tenantId);

    return skillCandidates.map((c) => {
      const skillNorm = c.skillLevel / 5;
      const loadNorm = 1 - (c.currentWorkload ?? 0);
      const combinedScore = skillNorm * 0.6 + loadNorm * 0.4;
      return { ...c, matchScore: combinedScore * 100 };
    }).sort((a, b) => b.matchScore - a.matchScore);
  }

  /**
   * AI 推荐策略
   */
  private async aiRecommendedDispatch(
    ticket: Ticket,
    tenantId: string
  ): Promise<DispatchCandidate[]> {
    const candidates = await this.loadBalancedDispatch(ticket, tenantId);

    // Add historical performance bonus
    return candidates.map((c) => {
      const historyBonus = this.getHistoryBonus(c.userId);
      c.matchScore = c.matchScore * 0.8 + historyBonus * 20;
      return c;
    }).sort((a, b) => b.matchScore - a.matchScore);
  }

  // ============================================================
  // 匹配评分
  // ============================================================

  /**
   * 计算候选人匹配分数
   */
  private async scoreCandidates(
    ticket: Ticket,
    candidates: DispatchCandidate[]
  ): Promise<DispatchCandidate[]> {
    for (const candidate of candidates) {
      const matchDetail = await this.calculateMatchScore(ticket, candidate);
      candidate.matchScore = matchDetail.totalScore * 100;
      candidate.matchReasons = [
        `技能匹配: ${(matchDetail.skillScore * 100).toFixed(0)}%`,
        `负载匹配: ${(matchDetail.workloadScore * 100).toFixed(0)}%`,
        `可用性: ${(matchDetail.availabilityScore * 100).toFixed(0)}%`,
      ];
    }
    return candidates.sort((a, b) => b.matchScore - a.matchScore);
  }

  /**
   * 计算单个候选人的匹配分数
   */
  private async calculateMatchScore(
    _ticket: Ticket,
    candidate: DispatchCandidate
  ): Promise<MatchDetail> {
    const skillScore = this.calcSkillScore(candidate);
    const workloadScore = this.calcWorkloadScore(candidate);
    const availabilityScore = candidate.availability ? 1 : 0;
    const historyScore = this.calcHistoryScore(candidate);
    const weights = this.defaultWeights;
    const totalScore =
      skillScore * weights.skill +
      workloadScore * weights.workload +
      availabilityScore * weights.availability +
      historyScore * weights.history;

    return {
      userId: candidate.userId,
      skillScore,
      workloadScore,
      availabilityScore,
      historyScore,
      weights,
      totalScore,
    };
  }

  private calcSkillScore(candidate: DispatchCandidate): number {
    return (candidate.skillLevel ?? 0) / 5;
  }

  private calcWorkloadScore(candidate: DispatchCandidate): number {
    return 1 - (candidate.currentWorkload ?? 0);
  }

  private calcHistoryScore(candidate: DispatchCandidate): number {
    const history = dispatchHistory.filter(
      (h) => h.assignedTo === candidate.userId && h.status === DispatchStatus.ASSIGNED
    );
    if (history.length === 0) return 0.5;
    return Math.min(0.5 + history.length / 20, 1.0);
  }

  // ============================================================
  // 派单规则管理
  // ============================================================

  /**
   * 查找匹配的派单规则
   */
  private async findMatchingRule(
    ticket: Ticket,
    _tenantId: string
  ): Promise<DispatchRule | null> {
    const allRules = Array.from(dispatchRules.values())
      .filter((r) => r.enabled)
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

    for (const rule of allRules) {
      if (this.matchRuleConditions(rule, ticket)) {
        return rule;
      }
    }
    return null;
  }

  /**
   * 检查规则条件是否匹配
   */
  private matchRuleConditions(rule: DispatchRule, ticket: Ticket): boolean {
    if (!rule.conditions || rule.conditions.length === 0) return true;

    for (const condition of rule.conditions) {
      const ticketValue = (ticket as any)[condition.field];
      switch (condition.operator) {
        case 'equals':
          if (ticketValue !== condition.value) return false;
          break;
        case 'not_equals':
          if (ticketValue === condition.value) return false;
          break;
        case 'contains':
          if (!String(ticketValue).includes(String(condition.value))) return false;
          break;
      }
    }
    return true;
  }

  /**
   * 创建派单规则
   */
  async createDispatchRule(
    rule: Omit<DispatchRule, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<DispatchRule> {
    const id = crypto.randomUUID();
    const fullRule: DispatchRule = {
      ...rule,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    dispatchRules.set(id, fullRule);
    return fullRule;
  }

  /**
   * 更新派单规则
   */
  async updateDispatchRule(
    ruleId: string,
    updates: Partial<DispatchRule>
  ): Promise<DispatchRule> {
    const existing = dispatchRules.get(ruleId);
    if (!existing) throw new Error(`Dispatch rule not found: ${ruleId}`);
    const updated: DispatchRule = {
      ...existing,
      ...updates,
      id: ruleId,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    };
    dispatchRules.set(ruleId, updated);
    return updated;
  }

  /**
   * 删除派单规则
   */
  async deleteDispatchRule(ruleId: string): Promise<void> {
    dispatchRules.delete(ruleId);
  }

  // ============================================================
  // 派单升级
  // ============================================================

  /**
   * 处理派单拒绝
   */
  async handleDispatchRejection(
    dispatchId: string,
    rejectedBy: string,
    reason: string
  ): Promise<DispatchResult> {
    const original = dispatchHistory.find((h) => h.dispatchId === dispatchId);
    if (!original) throw new Error(`Dispatch record not found: ${dispatchId}`);

    // Record rejection
    original.status = DispatchStatus.REJECTED;

    // Find next candidate
    const nextCandidate = original.candidates?.find(
      (c) => c.userId !== rejectedBy
    );

    if (nextCandidate) {
      const newResult: DispatchResult = {
        ...original,
        dispatchId: crypto.randomUUID(),
        assignedTo: nextCandidate.userId,
        status: DispatchStatus.ASSIGNED,
        dispatchedAt: new Date(),
      };
      dispatchHistory.push(newResult);
      return newResult;
    }

    return {
      ...original,
      dispatchId: crypto.randomUUID(),
      status: DispatchStatus.ESCALATED,
      dispatchedAt: new Date(),
    };
  }

  /**
   * 超时自动升级
   */
  async escalateUnacceptedTickets(): Promise<void> {
    const now = new Date();
    for (const h of dispatchHistory) {
      if (h.status === DispatchStatus.ASSIGNED) {
        const minutes = (now.getTime() - h.dispatchedAt.getTime()) / 1000 / 60;
        if (minutes > 15) {
          h.status = DispatchStatus.ESCALATED;
        }
      }
    }
  }

  // ============================================================
  // Engineer Management
  // ============================================================

  async registerEngineer(profile: EngineerProfile): Promise<EngineerProfile> {
    engineers.set(profile.id, { ...profile, availability: 'available' });
    return profile;
  }

  async updateEngineer(
    id: string,
    updates: Partial<EngineerProfile>
  ): Promise<EngineerProfile | null> {
    const existing = engineers.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates, id };
    engineers.set(id, updated);
    return updated;
  }

  async getEngineer(id: string): Promise<EngineerProfile | undefined> {
    return engineers.get(id);
  }

  async listEngineers(): Promise<EngineerProfile[]> {
    return Array.from(engineers.values());
  }

  async markEngineerSuspended(engineerId: string): Promise<void> {
    const engineer = engineers.get(engineerId);
    if (engineer) {
      engineer.availability = 'offline';
      engineers.set(engineerId, engineer);
    }
  }

  async markEngineerActive(engineerId: string): Promise<void> {
    const engineer = engineers.get(engineerId);
    if (engineer) {
      engineer.availability = 'available';
      engineers.set(engineerId, engineer);
    }
  }

  async dispatchTicket(
    ticketId: string,
    assigneeId: string
  ): Promise<DispatchResult> {
    const engineer = await this.getEngineer(assigneeId);
    if (!engineer) throw new Error(`Engineer not found: ${assigneeId}`);

    const result: DispatchResult = {
      dispatchId: crypto.randomUUID(),
      ticketId,
      status: DispatchStatus.ASSIGNED,
      assignedTo: assigneeId,
      candidates: [],
      matchDetails: [],
      dispatchedAt: new Date(),
    };
    dispatchHistory.push(result);

    // Update ticket
    const ticket = tickets.get(ticketId);
    if (ticket) {
      ticket.assigneeId = assigneeId;
      ticket.status = TicketStatus.OPEN;
      tickets.set(ticketId, ticket);
    }

    return result;
  }

  async addRule(rule: DispatchRule): Promise<void> {
    dispatchRules.set(rule.id, rule);
  }

  async getRules(): Promise<DispatchRule[]> {
    return Array.from(dispatchRules.values());
  }

  async removeRule(ruleId: string): Promise<void> {
    dispatchRules.delete(ruleId);
  }

  async findBestEngineer(ticket: Ticket): Promise<EngineerProfile | null> {
    const candidates = await this.skillBasedDispatch(ticket, ticket.tenantId);
    if (candidates.length === 0) return null;
    return engineers.get(candidates[0].userId) ?? null;
  }

  async calculateDispatchScore(
    ticket: Ticket,
    engineer: EngineerProfile
  ): Promise<number> {
    const candidate = this.toCandidate(engineer);
    const matchDetail = await this.calculateMatchScore(ticket, candidate);
    return matchDetail.totalScore * 100;
  }

  async getWeights(): Promise<DispatchWeights> {
    return {
      expertise: this.defaultWeights.skill,
      workload: this.defaultWeights.workload,
      availability: this.defaultWeights.availability,
      successRate: 0.2,
      slaUrgency: 0.1,
    };
  }

  async updateWeights(_weights: DispatchWeights): Promise<void> {
    // Update weights if needed
  }

  async clearAll(): Promise<void> {
    dispatchRules.clear();
    engineers.clear();
    dispatchHistory.length = 0;
    tickets.clear();
  }

  // ============================================================
  // Internal Helpers
  // ============================================================

  private toCandidate(engineer: EngineerProfile): DispatchCandidate {
    return {
      userId: engineer.id,
      userName: engineer.name ?? engineer.id,
      groupId: (engineer.expertise?.[0] as string) ?? 'default',
      availability: engineer.availability === 'available',
      skillLevel: this.getAverageSkillLevel(engineer),
      currentWorkload: engineer.currentLoad / Math.max(engineer.maxCapacity, 1),
      matchScore: 0,
      matchReasons: [],
    };
  }

  private getAverageSkillLevel(engineer: EngineerProfile): number {
    return 3; // Default level
  }

  private getEngineerWorkload(engineerId: string): UserWorkload {
    const activeCount = dispatchHistory.filter(
      (h) => h.assignedTo === engineerId && h.status === DispatchStatus.ASSIGNED
    ).length;
    const engineer = engineers.get(engineerId);
    const maxCapacity = engineer?.maxCapacity ?? 10;
    return {
      userId: engineerId,
      activeTicketCount: activeCount,
      maxTicketCapacity: maxCapacity,
      utilizationRate: activeCount / maxCapacity,
    };
  }

  private getLastDispatchTime(engineerId: string): Date {
    const lastDispatch = dispatchHistory
      .filter((h) => h.assignedTo === engineerId)
      .sort((a, b) => b.dispatchedAt.getTime() - a.dispatchedAt.getTime())[0];
    return lastDispatch?.dispatchedAt ?? new Date(0);
  }

  private getSkillMatchLevel(engineer: EngineerProfile, ticket: Ticket): number {
    if (!engineer.expertise) return 0;
    const ticketCategory = ticket.categoryId ?? 'other';
    const matching = engineer.expertise.find((e) => String(e) === String(ticketCategory));
    return matching ? 4 : 1;
  }

  private getHistoryBonus(engineerId: string): number {
    const successCount = dispatchHistory.filter(
      (h) => h.assignedTo === engineerId && h.status === DispatchStatus.ASSIGNED
    ).length;
    return Math.min(successCount / 10, 1.0);
  }
}

// 单例导出
export const dispatchEngine = new DispatchEngine();