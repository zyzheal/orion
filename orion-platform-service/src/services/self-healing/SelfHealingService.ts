/**
 * SelfHealingService - Business logic layer for Self-Healing operations
 *
 * Orchestrates incident handling, strategy matching, decision making,
 * and approval workflows. Uses PostgreSQL Repository for persistence
 * of incidents and approvals, while leveraging in-memory components
 * for strategy matching and action execution.
 *
 * TASK-702: Self-Healing Engine (self-healing rules/executions backed by PostgreSQL)
 */

import { v4 as uuidv4 } from 'uuid';
import { SelfHealingRepository, HealingIncidentRow, ApprovalRequestRow } from './SelfHealingRepository';
import { HealingStrategyEngine } from './HealingStrategyEngine';
import { HealingActionExecutor } from './HealingActionExecutor';
import { SelfHealingGuardian, HealingRiskLevel, StormSuppressionRule, DualApprovalConfig, DEFAULT_STORM_RULES, DEFAULT_DUAL_APPROVAL_CONFIG } from './SelfHealingGuardian';
import {
  HealingStrategy,
  HealingIncident,
  HealingResult,
  HealingActionResult,
  ApprovalRequest,
  ApprovalResponse,
  IncidentStatus,
  MonitoringAlertEvent,
  HealingHistoryQuery,
  HealingHistoryResponse,
  HealingEffectiveness,
  IncidentType,
  IncidentSeverity,
  RiskLevel,
} from './types';
import { SelfHealingEventPublisher } from '../../events/SelfHealingEventPublisher';
import pino from 'pino';
import { OrionError, ErrorCode } from '../../errors';

const logger = pino({ name: 'LSelf-LHealing-LService' });

// ==================== Options ====================

export interface SelfHealingServiceOptions {
  approvalExpirationMs?: number;
  autoExecuteOnApproval?: boolean;
  stormRules?: StormSuppressionRule[];
  dualApprovalConfig?: DualApprovalConfig;
  /** 事件发布器 (可选，用于发布自愈事件到 NATS) */
  eventPublisher?: SelfHealingEventPublisher;
}

const DEFAULT_OPTIONS: Required<Omit<SelfHealingServiceOptions, 'eventPublisher'>> & { eventPublisher?: SelfHealingEventPublisher } = {
  approvalExpirationMs: 300000, // 5 minutes
  autoExecuteOnApproval: true,
  stormRules: DEFAULT_STORM_RULES,
  dualApprovalConfig: DEFAULT_DUAL_APPROVAL_CONFIG,
  eventPublisher: undefined,
};

// ==================== Service ====================

export class SelfHealingServiceError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'SelfHealingServiceError';
  }
}

export class SelfHealingService {
  private repository: SelfHealingRepository;
  private strategyEngine: HealingStrategyEngine;
  private actionExecutor: HealingActionExecutor;
  private guardian: SelfHealingGuardian;
  private options: Required<Omit<SelfHealingServiceOptions, 'eventPublisher'>> & { eventPublisher?: SelfHealingEventPublisher };
  private eventPublisher?: SelfHealingEventPublisher;

  constructor(
    repository: SelfHealingRepository,
    options?: SelfHealingServiceOptions,
    db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> },
  ) {
    this.repository = repository;
    this.strategyEngine = new HealingStrategyEngine(db);
    this.actionExecutor = new HealingActionExecutor(db);
    this.guardian = new SelfHealingGuardian({
      stormRules: options?.stormRules,
      dualApprovalConfig: options?.dualApprovalConfig,
    });
    this.eventPublisher = options?.eventPublisher;
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
    };
  }

  /**
   * 设置事件发布器 (用于延迟注入)
   */
  setEventPublisher(publisher: SelfHealingEventPublisher): void {
    this.eventPublisher = publisher;
  }

  /**
   * SRE: Expose guardian for audit/storm status queries
   */
  getGuardian(): SelfHealingGuardian {
    return this.guardian;
  }

  // Expose strategy engine for strategy management
  getStrategyEngine(): HealingStrategyEngine {
    return this.strategyEngine;
  }

  // ==================== Incident Management ====================

  /**
   * Handle an incoming alert and create a healing incident
   */
  async handleAlert(alert: MonitoringAlertEvent): Promise<HealingIncident> {
    // SRE: Storm suppression check before creating incident
    const shouldSuppress = this.guardian.shouldSuppress({
      appName: alert.tags.app || 'unknown',
      environment: alert.tags.env || 'unknown',
      alertType: alert.metric,
    });

    if (shouldSuppress) {
      logger.info(
        `[SelfHealingService] Storm suppressed alert: ${alert.metric} in ${alert.tags.app} (${alert.tags.env})`
      );
      // Still create the incident but mark as suppressed
      const row = await this.repository.createIncident({
        alert_id: alert.alertId,
        type: this.mapMetricToIncidentType(alert.metric),
        severity: alert.severity,
        app_name: alert.tags.app || 'unknown',
        environment: alert.tags.env || 'unknown',
        actions: [],
        status: 'escalated',
        tags: alert.tags,
      });

      // Update with suppression reason
      await this.repository.updateIncident(row.id, {
        error: 'Storm suppressed - same alert triggered recently',
      });

      // Publish incident_escalated event
      if (this.eventPublisher) {
        await this.eventPublisher.publishIncidentEscalated({
          incidentId: row.id,
          appName: alert.tags.app || 'unknown',
          environment: alert.tags.env || 'unknown',
          reason: 'Storm suppressed - same alert triggered recently',
          type: this.mapMetricToIncidentType(alert.metric) as any,
          status: 'escalated',
          timestamp: new Date().toISOString(),
        }).catch(err => logger.warn('[SelfHealingService] Failed to publish incident_escalated event:', err));
      }

      return await this.mapRowToIncident(row);
    }

    const incidentId = uuidv4();
    const now = new Date();

    // Determine incident type from the alert metric
    const incidentType = this.mapMetricToIncidentType(alert.metric);

    // Create incident in DB (initial status: evaluating)
    const row = await this.repository.createIncident({
      alert_id: alert.alertId,
      type: incidentType,
      severity: alert.severity,
      app_name: alert.tags.app || 'unknown',
      environment: alert.tags.env || 'unknown',
      actions: [],
      status: 'evaluating',
      tags: alert.tags,
    });

    // Publish incident_detected event
    if (this.eventPublisher) {
      await this.eventPublisher.publishIncidentDetected({
        incidentId: row.id,
        alertId: alert.alertId,
        appName: alert.tags.app || 'unknown',
        environment: alert.tags.env || 'unknown',
        type: incidentType as any,
        severity: alert.severity as any,
        tags: alert.tags,
        timestamp: new Date().toISOString(),
      }).catch(err => logger.warn('[SelfHealingService] Failed to publish incident_detected event:', err));
    }

    // Match to a strategy (include severity in context for condition matching)
    const matchContext = { ...alert.tags, severity: alert.severity };
    const strategy = await this.strategyEngine.selectBestStrategy(
      incidentType as IncidentType,
      matchContext
    );

    if (!strategy) {
      // No matching strategy - mark as failed
      const failed = await this.repository.updateIncident(row.id, {
        status: 'failed',
        error: 'No matching healing strategy found',
        completed_at: now,
      });
      return await this.mapRowToIncident(failed!);
    }

    // Determine if auto-heal or manual approval needed
    const requiresApproval = this.requiresManualApproval(
      strategy,
      alert.tags.env || 'unknown',
      alert.severity
    );

    const approvalStatus = requiresApproval ? 'pending' : 'not_required';

    // Update incident with strategy
    const updated = await this.repository.updateIncident(row.id, {
      status: requiresApproval ? 'pending_approval' : 'healing',
      strategy_id: strategy.id,
      strategy_name: strategy.name,
      actions: strategy.actions,
      approval_status: approvalStatus,
      attempts: 1,
    });

    if (requiresApproval) {
      // Create approval request
      const approval = await this.repository.createApprovalRequest({
        incident_id: row.id,
        title: `Self-Healing Approval: ${incidentType} in ${alert.tags.app}`,
        description: `Auto-healing requires approval for incident in ${alert.tags.app} (${alert.tags.env}). ${strategy.name}`,
        risk_level: this.assessRiskLevel(alert.tags.env || 'unknown'),
        recommended_actions: strategy.actions,
        expires_at: new Date(now.getTime() + this.options.approvalExpirationMs),
      });

      // Link approval to incident
      await this.repository.updateIncident(row.id, {
        approval_request_id: approval.id,
      });

      // Publish approval_requested event
      if (this.eventPublisher) {
        await this.eventPublisher.publishApprovalRequested({
          approvalRequestId: approval.id,
          incidentId: row.id,
          appName: alert.tags.app || 'unknown',
          environment: alert.tags.env || 'unknown',
          title: `Self-Healing Approval: ${incidentType} in ${alert.tags.app}`,
          description: `Auto-healing requires approval for incident in ${alert.tags.app} (${alert.tags.env}). ${strategy.name}`,
          riskLevel: this.assessRiskLevel(alert.tags.env || 'unknown') as any,
          recommendedActions: strategy.actions.map(a => ({ type: a.type as any, description: a.description })),
          expiresAt: new Date(now.getTime() + this.options.approvalExpirationMs).toISOString(),
          timestamp: new Date().toISOString(),
        }).catch(err => logger.warn('[SelfHealingService] Failed to publish approval_requested event:', err));
      }

      const final = await this.repository.findIncidentById(row.id);
      return await this.mapRowToIncident(final!);
    }

    // Publish healing_started event before auto-heal
    if (this.eventPublisher) {
      await this.eventPublisher.publishHealingStarted({
        incidentId: row.id,
        appName: alert.tags.app || 'unknown',
        environment: alert.tags.env || 'unknown',
        strategyId: strategy.id,
        strategyName: strategy.name,
        actions: strategy.actions.map(a => ({ type: a.type as any, description: a.description })),
        requiresApproval: false,
        confidence: strategy.confidence,
        timestamp: new Date().toISOString(),
      }).catch(err => logger.warn('[SelfHealingService] Failed to publish healing_started event:', err));
    }

    // Auto-heal: execute actions
    const result = await this.executeHealingActions(strategy, updated!);

    return result;
  }

  /**
   * Get an incident by ID
   */
  async getIncident(id: string): Promise<HealingIncident | undefined> {
    const row = await this.repository.findIncidentById(id);
    if (!row) return undefined;
    return await this.mapRowToIncident(row);
  }

  /**
   * Get healing history with filters
   */
  async getHistory(query: HealingHistoryQuery): Promise<HealingHistoryResponse> {
    // Mark expired approvals first
    await this.repository.markExpiredApprovals();

    const result = await this.repository.findIncidents({
      appName: query.appName,
      environment: query.environment,
      type: query.type,
      status: query.status,
      severity: query.severity,
      startDate: query.startDate,
      endDate: query.endDate,
      limit: query.limit ?? 50,
      offset: query.offset ?? 0,
    });

    return {
      data: await Promise.all(result.rows.map((r) => this.mapRowToIncident(r))),
      total: result.total,
      limit: query.limit ?? 50,
      offset: query.offset ?? 0,
    };
  }

  /**
   * Get effectiveness metrics
   */
  async getEffectiveness(filters: {
    appName?: string;
    environment?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<HealingEffectiveness> {
    const result = await this.repository.findIncidents({
      appName: filters.appName,
      environment: filters.environment,
      startDate: filters.startDate,
      endDate: filters.endDate,
      limit: 10000, // Large limit for metrics
    });

    const incidents = await Promise.all(result.rows.map((r) => this.mapRowToIncident(r)));
    const total = incidents.length;
    const healed = incidents.filter((i) => i.status === 'healed').length;
    const failed = incidents.filter((i) => i.status === 'failed').length;
    const escalated = incidents.filter((i) => i.status === 'escalated').length;
    const recurred = incidents.filter((i) => i.result?.recurred).length;

    const durations = incidents
      .filter((i) => i.result?.duration)
      .map((i) => i.result!.duration);
    const avgDuration = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;
    const medianDuration = durations.length > 0
      ? durations.sort((a, b) => a - b)[Math.floor(durations.length / 2)]
      : 0;
    const effectiveness = incidents
      .filter((i) => i.result?.effectiveness)
      .map((i) => i.result!.effectiveness!);
    const avgEffectiveness = effectiveness.length > 0
      ? effectiveness.reduce((a, b) => a + b, 0) / effectiveness.length
      : 0;

    // By incident type
    const byType: Record<string, { total: number; success: number; rate: number }> = {};
    for (const i of incidents) {
      if (!byType[i.type]) byType[i.type] = { total: 0, success: 0, rate: 0 };
      byType[i.type].total++;
      if (i.status === 'healed') byType[i.type].success++;
    }
    for (const key of Object.keys(byType)) {
      byType[key].rate = byType[key].total > 0
        ? Math.round((byType[key].success / byType[key].total) * 100)
        : 0;
    }

    // By strategy
    const byStrategy: Record<string, { total: number; success: number; rate: number }> = {};
    for (const i of incidents) {
      const name = i.strategy?.name || 'unknown';
      if (!byStrategy[name]) byStrategy[name] = { total: 0, success: 0, rate: 0 };
      byStrategy[name].total++;
      if (i.status === 'healed') byStrategy[name].success++;
    }
    for (const key of Object.keys(byStrategy)) {
      byStrategy[key].rate = byStrategy[key].total > 0
        ? Math.round((byStrategy[key].success / byStrategy[key].total) * 100)
        : 0;
    }

    // By environment
    const byEnv: Record<string, { total: number; success: number; rate: number }> = {};
    for (const i of incidents) {
      if (!byEnv[i.environment]) byEnv[i.environment] = { total: 0, success: 0, rate: 0 };
      byEnv[i.environment].total++;
      if (i.status === 'healed') byEnv[i.environment].success++;
    }
    for (const key of Object.keys(byEnv)) {
      byEnv[key].rate = byEnv[key].total > 0
        ? Math.round((byEnv[key].success / byEnv[key].total) * 100)
        : 0;
    }

    // By action type
    const byAction: Record<string, { total: number; success: number; rate: number }> = {};
    for (const i of incidents) {
      for (const action of i.actions) {
        if (!byAction[action.type]) byAction[action.type] = { total: 0, success: 0, rate: 0 };
        byAction[action.type].total++;
        const actionResult = i.result?.actionsExecuted?.find(
          (a) => a.type === action.type && a.success
        );
        if (actionResult) byAction[action.type].success++;
      }
    }
    for (const key of Object.keys(byAction)) {
      byAction[key].rate = byAction[key].total > 0
        ? Math.round((byAction[key].success / byAction[key].total) * 100)
        : 0;
    }

    return {
      totalIncidents: total,
      healedIncidents: healed,
      failedIncidents: failed,
      escalatedIncidents: escalated,
      successRate: total > 0 ? Math.round((healed / total) * 100) : 0,
      averageDurationMs: Math.round(avgDuration),
      medianDurationMs: Math.round(medianDuration),
      averageEffectiveness: Math.round(avgEffectiveness),
      recurredIncidents: recurred,
      recurrenceRate: total > 0 ? Math.round((recurred / total) * 100) : 0,
      byIncidentType: byType,
      byStrategy: byStrategy,
      byEnvironment: byEnv,
      byActionType: byAction,
    };
  }

  // ==================== Strategy Management ====================

  async getStrategies(): Promise<HealingStrategy[]> {
    return this.strategyEngine.getAllStrategies();
  }

  async getStrategy(id: string): Promise<HealingStrategy | undefined> {
    return this.strategyEngine.getStrategy(id);
  }

  async registerCustomStrategy(strategy: HealingStrategy): Promise<void> {
    await this.strategyEngine.registerStrategy(strategy);
  }

  async toggleStrategy(id: string, enabled: boolean): Promise<boolean> {
    if (enabled) {
      return this.strategyEngine.enableStrategy(id);
    }
    return this.strategyEngine.disableStrategy(id);
  }

  // ==================== Approval Workflow ====================

  async getApprovalRequests(status?: 'pending' | 'approved' | 'rejected' | 'expired'): Promise<ApprovalRequest[]> {
    // Mark expired first
    await this.repository.markExpiredApprovals();

    const rows = await this.repository.findApprovalsByStatus(status);
    return rows.map((r) => this.mapRowToApproval(r));
  }

  async getApprovalRequest(id: string): Promise<ApprovalRequest | undefined> {
    // Mark expired first
    await this.repository.markExpiredApprovals();

    const row = await this.repository.findApprovalById(id);
    if (!row) return undefined;
    return this.mapRowToApproval(row);
  }

  async respondToApproval(id: string, response: ApprovalResponse): Promise<HealingIncident> {
    // Mark expired first
    await this.repository.markExpiredApprovals();

    const approvalRow = await this.repository.findApprovalById(id);
    if (!approvalRow) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Approval request '${id}' not found`);
    }

    if (approvalRow.status !== 'pending') {
      throw new OrionError(ErrorCode.NOT_FOUND, `Approval request '${id}' is already ${approvalRow.status}`);
    }

    // Check expiration
    if (approvalRow.expires_at && new Date() > approvalRow.expires_at) {
      await this.repository.updateApprovalRequest(id, { status: 'expired' });
      throw new OrionError(ErrorCode.NOT_FOUND, `Approval request '${id}' has expired`);
    }

    const now = new Date();

    // Update approval request
    await this.repository.updateApprovalRequest(id, {
      status: response.approved ? 'approved' : 'rejected',
      approved_by: response.respondedBy,
      approval_reason: response.reason,
      responded_at: now,
    });

    // Update associated incident
    const incident = await this.repository.findIncidentById(approvalRow.incident_id);
    if (!incident) {
      throw new OrionError('NOT_FOUND', `Associated incident not found`)
    }

    // Publish approval_responded event
    if (this.eventPublisher) {
      await this.eventPublisher.publishApprovalResponded({
        approvalRequestId: id,
        incidentId: approvalRow.incident_id,
        approved: response.approved,
        respondedBy: response.respondedBy,
        reason: response.reason,
        timestamp: new Date().toISOString(),
      }).catch(err => logger.warn('[SelfHealingService] Failed to publish approval_responded event:', err));
    }

    if (response.approved) {
      // Publish healing_started event before executing actions
      const strategy = await this.strategyEngine.getStrategy(incident.strategy_id || '');
      if (strategy && this.eventPublisher) {
        await this.eventPublisher.publishHealingStarted({
          incidentId: incident.id,
          appName: incident.app_name,
          environment: incident.environment,
          strategyId: strategy.id,
          strategyName: strategy.name,
          actions: strategy.actions.map(a => ({ type: a.type as any, description: a.description })),
          requiresApproval: true,
          confidence: strategy.confidence,
          timestamp: new Date().toISOString(),
        }).catch(err => logger.warn('[SelfHealingService] Failed to publish healing_started event:', err));
      }

      // Execute healing actions with approver info
      if (strategy) {
        await this.repository.updateIncident(incident.id, {
          approval_status: 'approved',
          status: 'healing',
        });
        const result = await this.executeHealingActions(strategy, incident, [response.respondedBy]);
        return result;
      }

      // No strategy found, just update status
      await this.repository.updateIncident(incident.id, {
        approval_status: 'approved',
        status: 'healed',
        completed_at: now,
      });
      return await this.mapRowToIncident(
        (await this.repository.findIncidentById(incident.id))!
      );
    }

    // Rejected
    await this.repository.updateIncident(incident.id, {
      approval_status: 'rejected',
      status: 'failed',
      error: `Approval rejected by ${response.respondedBy}: ${response.reason || 'no reason provided'}`,
      completed_at: now,
    });

    return await this.mapRowToIncident(
      (await this.repository.findIncidentById(incident.id))!
    );
  }

  // ==================== Private Helpers ====================

  /**
   * Execute healing actions for an incident
   * S7 Fix: Accepts approvers array and passes to audit log
   */
  private async executeHealingActions(
    strategy: HealingStrategy,
    incidentRow: HealingIncidentRow,
    approvers: string[] = []
  ): Promise<HealingIncident> {
    const startTime = Date.now();
    const actionResults: HealingActionResult[] = [];
    let allSuccess = true;

    for (const action of strategy.actions) {
      // SRE: Audit log each action
      await this.guardian.recordAudit({
        incidentId: incidentRow.id,
        actionType: action.type,
        target: action.params?.target || 'unknown',
        environment: incidentRow.environment,
        riskLevel: this.mapSeverityToRiskLevel(incidentRow.severity as IncidentSeverity),
        approvers, // S7 Fix: Populated from approval response
        executor: 'system',
        status: 'executed',
        reason: `Auto-healing via strategy: ${strategy.name}`,
      });

      const result = await this.actionExecutor.executeAction(action);
      actionResults.push(result);

      // Publish action_executed event
      if (this.eventPublisher) {
        await this.eventPublisher.publishActionExecuted({
          incidentId: incidentRow.id,
          actionType: action.type as any,
          success: result.success,
          durationMs: result.durationMs,
          message: result.message,
          error: result.error,
          rollbackNeeded: result.rollbackNeeded,
          rollbackSuccess: result.rollbackSuccess,
          timestamp: new Date().toISOString(),
        }).catch(err => logger.warn('[SelfHealingService] Failed to publish action_executed event:', err));
      }

      // Update audit entry with result
      await this.guardian.recordAudit({
        incidentId: incidentRow.id,
        actionType: action.type,
        target: action.params?.target || 'unknown',
        environment: incidentRow.environment,
        riskLevel: this.mapSeverityToRiskLevel(incidentRow.severity as IncidentSeverity),
        approvers, // S7 Fix: Populated from approval response
        executor: 'system',
        status: result.success ? 'executed' : 'blocked',
        reason: result.message || result.error || '',
        result: result.success ? 'success' : 'failed',
      });

      if (!result.success) {
        allSuccess = false;
        // If action supports rollback and failed, rollback
        if (action.rollback) {
          await this.actionExecutor.rollbackAction(action);
        }
      }
    }

    const duration = Date.now() - startTime;

    const healingResult: HealingResult = {
      success: allSuccess,
      duration,
      actionsExecuted: actionResults,
      effectiveness: allSuccess ? 85 : 30,
      verifiedAt: new Date(),
    };

    const finalStatus = allSuccess ? 'healed' : 'failed';

    await this.repository.updateIncident(incidentRow.id, {
      status: finalStatus,
      approval_status: incidentRow.approval_status === 'pending' ? 'approved' : (incidentRow.approval_status || undefined),
      result: healingResult,
      error: allSuccess ? undefined : 'Some healing actions failed',
      completed_at: new Date(),
    });

    // Publish healing_completed or healing_failed event
    if (this.eventPublisher) {
      if (allSuccess) {
        await this.eventPublisher.publishHealingCompleted({
          incidentId: incidentRow.id,
          appName: incidentRow.app_name,
          environment: incidentRow.environment,
          success: true,
          durationMs: duration,
          actionsExecuted: actionResults.length,
          effectiveness: healingResult.effectiveness,
          timestamp: new Date().toISOString(),
        }).catch(err => logger.warn('[SelfHealingService] Failed to publish healing_completed event:', err));
      } else {
        await this.eventPublisher.publishHealingFailed({
          incidentId: incidentRow.id,
          appName: incidentRow.app_name,
          environment: incidentRow.environment,
          error: 'Some healing actions failed',
          attempts: incidentRow.attempts,
          lastAction: actionResults[actionResults.length - 1]?.type as any,
          timestamp: new Date().toISOString(),
        }).catch(err => logger.warn('[SelfHealingService] Failed to publish healing_failed event:', err));
      }
    }

    return await this.mapRowToIncident(
      (await this.repository.findIncidentById(incidentRow.id))!
    );
  }

  /**
   * Map database row to HealingIncident type
   */
  private async mapRowToIncident(row: HealingIncidentRow): Promise<HealingIncident> {
    const strategy = row.strategy_id
      ? await this.strategyEngine.getStrategy(row.strategy_id)
      : undefined;

    return {
      id: row.id,
      alertId: row.alert_id || undefined,
      type: row.type as IncidentType,
      severity: row.severity as IncidentSeverity,
      appName: row.app_name,
      environment: row.environment,
      strategy: strategy,
      actions: row.actions || [],
      status: row.status as IncidentStatus,
      startedAt: row.started_at,
      completedAt: row.completed_at || undefined,
      result: row.result || undefined,
      error: row.error || undefined,
      approvalStatus: row.approval_status as HealingIncident['approvalStatus'],
      approvalRequestId: row.approval_request_id || undefined,
      attempts: row.attempts,
      tags: row.tags || {},
    };
  }

  /**
   * Map database row to ApprovalRequest type
   */
  private mapRowToApproval(row: ApprovalRequestRow): ApprovalRequest {
    return {
      id: row.id,
      incidentId: row.incident_id,
      title: row.title,
      description: row.description || '',
      riskLevel: row.risk_level as RiskLevel,
      recommendedActions: row.recommended_actions || [],
      status: row.status as ApprovalRequest['status'],
      requestedBy: row.requested_by,
      approvedBy: row.approved_by || undefined,
      approvalReason: row.approval_reason || undefined,
      requestedAt: row.requested_at,
      respondedAt: row.responded_at || undefined,
      expiresAt: row.expires_at || undefined,
    };
  }

  /**
   * Map alert metric name to incident type
   */
  private mapMetricToIncidentType(metric: string): IncidentType {
    const metricMap: Record<string, IncidentType> = {
      cpu_usage: 'high_cpu',
      memory_usage: 'high_memory',
      error_rate: 'high_error_rate',
      latency: 'high_latency',
      pod_crash: 'pod_crash',
      node_failure: 'node_failure',
      service_down: 'service_down',
      deployment_failure: 'deployment_failure',
      disk_full: 'disk_full',
      disk_usage: 'disk_full',
      network_timeout: 'network_timeout',
    };

    // Try exact match first
    if (metricMap[metric]) return metricMap[metric];

    // Try contains match: check if metric contains a known key
    for (const [key, type] of Object.entries(metricMap)) {
      if (metric.includes(key)) return type;
    }

    // Reverse contains: check if any key contains the metric
    for (const [key, type] of Object.entries(metricMap)) {
      if (key.includes(metric)) return type;
    }

    return 'custom';
  }

  /**
   * Determine if manual approval is required
   */
  private requiresManualApproval(
    strategy: HealingStrategy,
    environment: string,
    severity: IncidentSeverity
  ): boolean {
    // Production always requires approval
    if (environment.toLowerCase() === 'production' || environment.toLowerCase() === 'prod') {
      return true;
    }

    // Critical severity always requires approval
    if (severity === 'critical') {
      return true;
    }

    // Low confidence requires approval
    if (strategy.confidence < 70) {
      return true;
    }

    return false;
  }

  /**
   * Assess risk level based on environment
   */
  private assessRiskLevel(environment: string): RiskLevel {
    const env = environment.toLowerCase();
    if (env === 'production' || env === 'prod') return 'high';
    if (env === 'staging' || env === 'pre-prod') return 'medium';
    return 'low';
  }

  /**
   * Map IncidentSeverity to HealingRiskLevel (for audit logging)
   */
  private mapSeverityToRiskLevel(severity: IncidentSeverity): HealingRiskLevel {
    switch (severity) {
      case 'critical': return 'critical';
      case 'warning': return 'high';
      case 'info': return 'low';
      default: return 'medium';
    }
  }
}
