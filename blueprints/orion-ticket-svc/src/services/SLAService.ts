/**
 * SLAService - SLA 管理服务
 * 负责 SLA 策略的创建、评估、监控和合规报告
 */

import {
  SLAPolicy,
  SLAMetric,
  SLAMetricType,
  SLAStatus,
  SLAReport,
  SLAReportByPriority,
  SLAReportByCategory,
  SLATrend,
  SLAEscalationRule,
  Ticket,
  TicketSLAInfo,
  TicketPriority,
  TicketType,
  TicketStatus,
  SetSLARequest,
} from '../types/ticket';

// In-memory store (replace with DB repository when available)
const slaPolicies = new Map<string, SLAPolicy>();
const ticketSLAMap = new Map<string, TicketSLAInfo>();
const tickets = new Map<string, Ticket>();

export class SLAService {
  /**
   * 加载工单数据（用于测试）
   */
  loadTickets(ticketList: Ticket[]): void {
    for (const t of ticketList) {
      tickets.set(t.id, t);
    }
  }

  // ============================================================
  // SLA 策略管理
  // ============================================================

  /**
   * 创建 SLA 策略
   */
  async createSLAPolicy(
    policy: Omit<SLAPolicy, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<SLAPolicy> {
    const id = crypto.randomUUID();
    const now = new Date();
    const fullPolicy: SLAPolicy = {
      ...policy,
      id,
      createdAt: now,
      updatedAt: now,
    };
    slaPolicies.set(id, fullPolicy);
    return fullPolicy;
  }

  /**
   * 更新 SLA 策略
   */
  async updateSLAPolicy(
    id: string,
    updates: Partial<SLAPolicy>
  ): Promise<SLAPolicy> {
    const existing = slaPolicies.get(id);
    if (!existing) {
      throw new Error(`SLA policy not found: ${id}`);
    }
    const updated: SLAPolicy = {
      ...existing,
      ...updates,
      id,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    };
    slaPolicies.set(id, updated);
    return updated;
  }

  /**
   * 删除 SLA 策略
   */
  async deleteSLAPolicy(id: string): Promise<void> {
    const usingTickets = Array.from(ticketSLAMap.values()).filter(
      (info) => info.policyId === id
    );
    if (usingTickets.length > 0) {
      throw new Error(
        `Cannot delete SLA policy: ${usingTickets.length} tickets still using it`
      );
    }
    slaPolicies.delete(id);
  }

  /**
   * 获取 SLA 策略
   */
  async getSLAPolicy(
    id: string,
    _tenantId: string
  ): Promise<SLAPolicy | null> {
    return slaPolicies.get(id) ?? null;
  }

  /**
   * 列出所有 SLA 策略
   */
  async listSLAPolicies(tenantId: string): Promise<SLAPolicy[]> {
    return Array.from(slaPolicies.values()).filter(
      (p) => p.tenantId === tenantId
    );
  }

  // ============================================================
  // SLA 绑定与评估
  // ============================================================

  /**
   * 为工单绑定 SLA
   */
  async bindSLA(
    request: SetSLARequest,
    _tenantId: string
  ): Promise<TicketSLAInfo> {
    const ticket = tickets.get(request.ticketId);
    if (!ticket) {
      throw new Error(`Ticket not found: ${request.ticketId}`);
    }

    let policy: SLAPolicy | null = null;
    if (request.policyId) {
      policy = slaPolicies.get(request.policyId) ?? null;
    }
    if (!policy) {
      policy = await this.findMatchingSLAPolicy(ticket, request.ticketId);
    }

    const slaInfo: TicketSLAInfo = {
      policyId: policy?.id ?? '',
      policyName: policy?.name ?? '',
      responseDeadline: policy
        ? this.calculateDeadline(
            ticket.createdAt,
            3600, // 1 hour default response
            policy.scheduleId ?? null
          )
        : null,
      resolutionDeadline: policy
        ? this.calculateDeadline(
            ticket.createdAt,
            86400, // 24 hours default resolution
            policy.scheduleId ?? null
          )
        : null,
      responseStatus: SLAStatus.WITHIN_SLA,
      resolutionStatus: SLAStatus.WITHIN_SLA,
      pausedAt: null,
      totalPausedSeconds: 0,
    };

    ticketSLAMap.set(request.ticketId, slaInfo);
    return slaInfo;
  }

  /**
   * 为工单自动匹配 SLA 策略
   */
  async findMatchingSLAPolicy(
    ticket: Ticket,
    _ticketId: string
  ): Promise<SLAPolicy | null> {
    const allPolicies = await this.listSLAPolicies(ticket.tenantId);
    if (allPolicies.length === 0) return null;

    // Priority 1: Exact type + priority match
    const exactMatch = allPolicies.find(
      (p) =>
        p.ticketType === ticket.type &&
        p.priority === ticket.priority &&
        p.enabled !== false
    );
    if (exactMatch) return exactMatch;

    // Priority 2: Type match only
    const typeMatch = allPolicies.find(
      (p) =>
        p.ticketType === ticket.type && p.enabled !== false
    );
    if (typeMatch) return typeMatch;

    // Priority 3: First enabled policy
    const defaultPolicy = allPolicies.find(
      (p) => p.enabled !== false
    );
    return defaultPolicy ?? null;
  }

  /**
   * 评估工单 SLA 状态
   */
  async evaluateTicketSLA(
    ticketId: string
  ): Promise<TicketSLAInfo | null> {
    const slaInfo = ticketSLAMap.get(ticketId);
    const ticket = tickets.get(ticketId);
    if (!slaInfo || !ticket) return null;

    const now = new Date();

    // Evaluate response SLA
    if (slaInfo.responseDeadline && slaInfo.responseStatus !== SLAStatus.BREACHED) {
      const responseElapsed = now.getTime() - ticket.createdAt.getTime();
      const responseTarget =
        slaInfo.responseDeadline.getTime() - ticket.createdAt.getTime();
      const responsePercent = responseElapsed / responseTarget;

      if (responsePercent >= 1.0) {
        slaInfo.responseStatus = SLAStatus.BREACHED;
      } else if (responsePercent >= 0.8) {
        slaInfo.responseStatus = SLAStatus.WARNING;
      }
    }

    // Evaluate resolution SLA
    if (slaInfo.resolutionDeadline && slaInfo.resolutionStatus !== SLAStatus.BREACHED) {
      const resolutionElapsed = now.getTime() - ticket.createdAt.getTime();
      const resolutionTarget =
        slaInfo.resolutionDeadline.getTime() - ticket.createdAt.getTime();
      const resolutionPercent = resolutionElapsed / resolutionTarget;

      if (resolutionPercent >= 1.0) {
        slaInfo.resolutionStatus = SLAStatus.BREACHED;
      }
    }

    // Check if resolved/closed
    if (
      ticket.status === TicketStatus.RESOLVED ||
      ticket.status === TicketStatus.CLOSED
    ) {
      slaInfo.resolutionStatus = SLAStatus.WITHIN_SLA;
    }

    ticketSLAMap.set(ticketId, slaInfo);
    return slaInfo;
  }

  /**
   * 检查 SLA 是否已超时
   */
  isSLABreached(slaInfo: TicketSLAInfo, now: Date): boolean {
    if (
      slaInfo.resolutionDeadline &&
      now > slaInfo.resolutionDeadline &&
      slaInfo.resolutionStatus !== SLAStatus.PAUSED
    ) {
      return true;
    }
    if (
      slaInfo.responseDeadline &&
      now > slaInfo.responseDeadline &&
      slaInfo.responseStatus !== SLAStatus.PAUSED
    ) {
      return true;
    }
    return false;
  }

  /**
   * 暂停 SLA 计时
   */
  async pauseSLA(ticketId: string): Promise<void> {
    const slaInfo = ticketSLAMap.get(ticketId);
    if (!slaInfo) return;

    slaInfo.pausedAt = new Date();
    slaInfo.responseStatus = SLAStatus.PAUSED;
    slaInfo.resolutionStatus = SLAStatus.PAUSED;

    ticketSLAMap.set(ticketId, slaInfo);
  }

  /**
   * 恢复 SLA 计时
   */
  async resumeSLA(ticketId: string): Promise<void> {
    const slaInfo = ticketSLAMap.get(ticketId);
    if (!slaInfo || !slaInfo.pausedAt) return;

    const pauseDuration = (Date.now() - slaInfo.pausedAt.getTime()) / 1000;
    slaInfo.totalPausedSeconds += pauseDuration;
    slaInfo.pausedAt = null;

    // Adjust deadlines by paused duration
    if (slaInfo.responseDeadline) {
      slaInfo.responseDeadline = new Date(
        slaInfo.responseDeadline.getTime() + pauseDuration * 1000
      );
    }
    if (slaInfo.resolutionDeadline) {
      slaInfo.resolutionDeadline = new Date(
        slaInfo.resolutionDeadline.getTime() + pauseDuration * 1000
      );
    }

    slaInfo.responseStatus = SLAStatus.WITHIN_SLA;
    slaInfo.resolutionStatus = SLAStatus.WITHIN_SLA;

    ticketSLAMap.set(ticketId, slaInfo);
  }

  // ============================================================
  // SLA 升级
  // ============================================================

  /**
   * 处理 SLA 升级
   */
  async handleSLAEscalation(
    ticket: Ticket,
    rule: SLAEscalationRule
  ): Promise<void> {
    switch (rule.action) {
      case 'notify':
        console.log(
          `[SLA Escalation] Notify ${ticket.assigneeId} via ${rule.channels?.join(', ')}`
        );
        // Send notifications
        for (const userId of rule.notifyUsers ?? []) {
          console.log(`[SLA Escalation] Notifying user: ${userId}`);
        }
        break;
      case 'reassign':
        console.log(
          `[SLA Escalation] Reassign ${ticket.id}`
        );
        break;
      case 'escalate_priority':
        console.log(
          `[SLA Escalation] Escalate priority for ${ticket.id}`
        );
        break;
      case 'notify_manager':
        console.log(
          `[SLA Escalation] Notify manager for ${ticket.id}`
        );
        for (const groupId of rule.notifyGroups ?? []) {
          console.log(`[SLA Escalation] Notifying group: ${groupId}`);
        }
        break;
      case 'create_incident':
        console.log(
          `[SLA Escalation] Create incident from ${ticket.id}`
        );
        break;
      default:
        console.log(
          `[SLA Escalation] Unknown action: ${rule.action}`
        );
    }
  }

  /**
   * 定时扫描 SLA 状态
   */
  async scanSLAStatus(): Promise<void> {
    const allTickets = Array.from(ticketSLAMap.keys());
    const now = new Date();

    for (const ticketId of allTickets) {
      const slaInfo = ticketSLAMap.get(ticketId);
      if (!slaInfo) continue;

      if (this.isSLABreached(slaInfo, now)) {
        console.log(
          `[SLA Scan] Ticket ${ticketId} SLA breached at ${now.toISOString()}`
        );
      }
    }
  }

  // ============================================================
  // SLA 报告
  // ============================================================

  /**
   * 生成 SLA 合规报告
   */
  async generateSLAReport(
    tenantId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<SLAReport> {
    const allTickets = Array.from(tickets.values()).filter(
      t => t.tenantId === tenantId &&
           t.createdAt >= periodStart &&
           t.createdAt <= periodEnd
    );
    const total = allTickets.length;

    let withinSLA = 0;
    let breached = 0;

    for (const ticket of allTickets) {
      const slaInfo = ticketSLAMap.get(ticket.id);
      if (slaInfo) {
        if (slaInfo.responseStatus === SLAStatus.WITHIN_SLA &&
            slaInfo.resolutionStatus === SLAStatus.WITHIN_SLA) {
          withinSLA++;
        } else if (slaInfo.responseStatus === SLAStatus.BREACHED ||
                   slaInfo.resolutionStatus === SLAStatus.BREACHED) {
          breached++;
        }
      } else {
        withinSLA++; // No SLA = compliant
      }
    }

    const complianceRate = total > 0 ? withinSLA / total : 1.0;

    // Group by priority
    const byPriority: SLAReportByPriority[] = Object.values(TicketPriority).map((priority) => {
      const forPriority = allTickets.filter(t => t.priority === priority);
      const within = forPriority.filter(t => {
        const info = ticketSLAMap.get(t.id);
        return !info ||
               (info.responseStatus === SLAStatus.WITHIN_SLA &&
                info.resolutionStatus === SLAStatus.WITHIN_SLA);
      }).length;
      return {
        priority,
        total: forPriority.length,
        withinSLA: within,
        breached: forPriority.length - within,
        complianceRate:
          forPriority.length > 0 ? within / forPriority.length : 1.0,
      };
    });

    // Trends (simplified)
    const trends: SLATrend[] = [];

    return {
      periodStart,
      periodEnd,
      totalTickets: total,
      withinSLA,
      breached,
      complianceRate,
      averageResponseTime: 1800, // 30 minutes in seconds
      averageResolutionTime: 14400, // 4 hours in seconds
      byPriority,
      byCategory: [],
      trends,
    };
  }

  /**
   * 获取 SLA 合规率
   */
  async getSLAComplianceRate(
    tenantId: string,
    _periodStart: Date,
    _periodEnd: Date
  ): Promise<number> {
    const policies = await this.listSLAPolicies(tenantId);
    if (policies.length === 0) return 1.0;

    const allSLAInfo = Array.from(ticketSLAMap.values());
    if (allSLAInfo.length === 0) return 1.0;

    const compliant = allSLAInfo.filter(
      (info) =>
        info.responseStatus === SLAStatus.WITHIN_SLA &&
        info.resolutionStatus === SLAStatus.WITHIN_SLA
    ).length;

    return compliant / allSLAInfo.length;
  }

  // ============================================================
  // 排班计算
  // ============================================================

  /**
   * 计算 SLA 截止时间
   */
  private calculateDeadline(
    startTime: Date,
    targetSeconds: number,
    scheduleId: string | null
  ): Date {
    if (!scheduleId) {
      return new Date(startTime.getTime() + targetSeconds * 1000);
    }
    // For business hours calculation, would need to fetch schedule config
    return new Date(startTime.getTime() + targetSeconds * 1000);
  }

  /**
   * 计算已消耗的 SLA 时间
   */
  private calculateConsumedSLATime(
    startTime: Date,
    endTime: Date,
    _scheduleId: string | null,
    pausedSeconds: number
  ): number {
    const totalMs = endTime.getTime() - startTime.getTime();
    return Math.max(0, (totalMs / 1000) - pausedSeconds);
  }
}

// 单例导出
export const slaService = new SLAService();