/**
 * Self-Healing Service
 *
 * Main orchestration service that subscribes to monitoring alerts,
 * triggers healing workflows, and tracks healing history and effectiveness.
 *
 * TASK-702: Self-Healing Engine (自愈引擎)
 */

import { v4 as uuidv4 } from 'uuid';
import {
  HealingIncident,
  IncidentStatus,
  IncidentType,
  IncidentSeverity,
  HealingResult,
  HealingActionResult,
  HealingHistoryQuery,
  HealingHistoryResponse,
  HealingEffectiveness,
  HealingStrategy,
  ApprovalRequest,
  ApprovalResponse,
  MonitoringAlertEvent,
  IEventPublisher,
  SelfHealingEvents,
} from './types';
import { HealingStrategyEngine } from './HealingStrategyEngine';
import { HealingActionExecutor } from './HealingActionExecutor';
import {
  HealingDecisionMaker,
  DecisionMakerConfig,
  IRiskAssessor,
} from './HealingDecisionMaker';

/**
 * Map monitoring metrics to incident types
 */
function metricToIncidentType(metric: string): IncidentType {
  const metricLower = metric.toLowerCase();

  if (metricLower.includes('cpu')) return 'high_cpu';
  if (metricLower.includes('memory') || metricLower.includes('mem'))
    return 'high_memory';
  if (metricLower.includes('error')) return 'high_error_rate';
  if (metricLower.includes('latency') || metricLower.includes('response_time'))
    return 'high_latency';
  if (metricLower.includes('crash') || metricLower.includes('restart'))
    return 'pod_crash';
  if (metricLower.includes('node') || metricLower.includes('host'))
    return 'node_failure';
  if (metricLower.includes('down') || metricLower.includes('unavailable'))
    return 'service_down';
  if (metricLower.includes('deploy')) return 'deployment_failure';
  if (metricLower.includes('disk')) return 'disk_full';
  if (metricLower.includes('network') || metricLower.includes('timeout'))
    return 'network_timeout';

  return 'custom';
}

/**
 * Map monitoring severity to incident severity
 */
function mapSeverity(severity: string): IncidentSeverity {
  const s = severity.toLowerCase();
  if (s === 'critical' || s === 'critical') return 'critical';
  if (s === 'warning' || s === 'warn') return 'warning';
  return 'info';
}

export interface SelfHealingServiceOptions {
  /** Event publisher for NATS/event bus */
  eventPublisher?: IEventPublisher;
  /** Decision maker configuration */
  decisionMakerConfig?: DecisionMakerConfig;
  /** Risk assessor integration */
  riskAssessor?: IRiskAssessor;
}

export class SelfHealingService {
  private strategyEngine: HealingStrategyEngine;
  private actionExecutor: HealingActionExecutor;
  private decisionMaker: HealingDecisionMaker;
  private incidents: Map<string, HealingIncident> = new Map();
  private eventPublisher?: IEventPublisher;
  private alertSubscription?: () => Promise<void>;
  private isStarted: boolean = false;

  constructor(options?: SelfHealingServiceOptions) {
    this.strategyEngine = new HealingStrategyEngine();
    this.actionExecutor = new HealingActionExecutor();
    this.decisionMaker = new HealingDecisionMaker(
      options?.decisionMakerConfig,
      options?.riskAssessor
    );
    this.eventPublisher = options?.eventPublisher;
  }

  /**
   * Start the self-healing service and subscribe to monitoring alerts
   */
  async start(
    subscribeToAlerts?: (
      handler: (event: MonitoringAlertEvent) => Promise<void>
    ) => Promise<() => Promise<void>>
  ): Promise<void> {
    if (this.isStarted) {
      console.warn('[SelfHealingService] Already started');
      return;
    }

    this.isStarted = true;
    console.log('[SelfHealingService] Self-healing service started');

    // Subscribe to monitoring alerts if handler provided
    if (subscribeToAlerts) {
      try {
        this.alertSubscription = await subscribeToAlerts(
          async (event) => {
            await this.handleAlert(event);
          }
        );
        console.log('[SelfHealingService] Subscribed to monitoring alerts');
      } catch (error) {
        console.warn(
          '[SelfHealingService] Failed to subscribe to alerts:',
          error
        );
      }
    }
  }

  /**
   * Stop the self-healing service
   */
  async stop(): Promise<void> {
    if (!this.isStarted) return;

    this.isStarted = false;

    if (this.alertSubscription) {
      try {
        await this.alertSubscription();
      } catch (error) {
        console.warn(
          '[SelfHealingService] Error unsubscribing from alerts:',
          error
        );
      }
      this.alertSubscription = undefined;
    }

    console.log('[SelfHealingService] Self-healing service stopped');
  }

  /**
   * Handle a monitoring alert event
   */
  async handleAlert(alert: MonitoringAlertEvent): Promise<HealingIncident> {
    // Map alert to incident
    const incidentType = metricToIncidentType(alert.metric);
    const severity = mapSeverity(alert.severity);

    // Extract app name and environment from tags
    const appName = alert.tags?.app || alert.tags?.appName || 'unknown';
    const environment = alert.tags?.env || alert.tags?.environment || 'unknown';

    console.log(
      `[SelfHealingService] Received alert: ${alert.metric} (${severity}) for ${appName} in ${environment}`
    );

    // Find best strategy
    const strategy = this.strategyEngine.selectBestStrategy(incidentType, {
      severity,
      ...alert.tags,
    });

    // Create incident record
    const incident: HealingIncident = {
      id: uuidv4(),
      alertId: alert.alertId,
      type: incidentType,
      severity,
      appName,
      environment,
      strategy: strategy ?? undefined,
      actions: strategy ? [...strategy.actions] : [],
      status: 'new',
      startedAt: new Date(),
      attempts: 0,
      tags: alert.tags,
    };

    this.incidents.set(incident.id, incident);

    // Publish incident detected event
    await this.publishEvent(SelfHealingEvents.INCIDENT_DETECTED, {
      incidentId: incident.id,
      alertId: alert.alertId,
      type: incidentType,
      severity,
      appName,
      environment,
    });

    // If no strategy found, mark as escalated
    if (!strategy) {
      incident.status = 'escalated';
      incident.error = `No healing strategy found for incident type: ${incidentType}`;

      await this.publishEvent(SelfHealingEvents.INCIDENT_ESCALATED, {
        incidentId: incident.id,
        reason: incident.error,
      });

      return incident;
    }

    // Execute healing workflow
    return this.executeHealing(incident);
  }

  /**
   * Execute healing workflow for an incident
   */
  async executeHealing(incident: HealingIncident): Promise<HealingIncident> {
    const startTime = Date.now();

    if (!incident.strategy) {
      incident.status = 'escalated';
      incident.error = 'No healing strategy available';
      return incident;
    }

    // If already approved (via manual approval workflow), skip decision check
    const wasPreApproved = incident.approvalStatus === 'approved';

    if (!wasPreApproved) {
      // Get decision (auto vs manual)
      const decision = await this.decisionMaker.getDecision({
        strategy: incident.strategy,
        appName: incident.appName,
        environment: incident.environment,
        incidentType: incident.type,
        severity: incident.severity,
        tags: incident.tags,
      });

      // Check if manual approval is needed
      if (decision.requiresApproval) {
        const approvalRequest = this.decisionMaker.createApprovalRequest({
          incidentId: incident.id,
          decision,
          appName: incident.appName,
          environment: incident.environment,
          incidentType: incident.type,
        });

        incident.approvalStatus = 'pending';
        incident.approvalRequestId = approvalRequest.id;
        incident.status = 'pending_approval';

        await this.publishEvent(SelfHealingEvents.APPROVAL_REQUESTED, {
          incidentId: incident.id,
          approvalRequestId: approvalRequest.id,
          title: approvalRequest.title,
          riskLevel: approvalRequest.riskLevel,
        });

        this.incidents.set(incident.id, incident);
        return incident;
      }
    }

    // Auto-heal approved
    incident.status = 'healing';
    incident.attempts++;

    await this.publishEvent(SelfHealingEvents.HEALING_STARTED, {
      incidentId: incident.id,
      strategy: incident.strategy.name,
      actions: incident.actions.map((a) => a.type),
    });

    // Execute actions
    const actionResults: HealingActionResult[] = [];
    let allSucceeded = true;

    for (const action of incident.actions) {
      const result = await this.actionExecutor.executeAction(action);
      actionResults.push(result);

      await this.publishEvent(SelfHealingEvents.ACTION_EXECUTED, {
        incidentId: incident.id,
        actionType: action.type,
        success: result.success,
        durationMs: result.durationMs,
      });

      if (!result.success) {
        allSucceeded = false;

        // Try rollback if action supports it
        if (action.rollback) {
          const rollbackResult =
            await this.actionExecutor.rollbackAction(action);
          result.rollbackNeeded = true;
          result.rollbackSuccess = rollbackResult.success;
        }

        break; // Stop on first failure
      }

      // Verify action
      const verified = await this.actionExecutor.verifyAction(
        action.type,
        action.params
      );
      result.verified = verified;

      if (!verified) {
        allSucceeded = false;
        result.message += ' (verification failed)';
        break;
      }
    }

    // Calculate healing result
    const duration = Date.now() - startTime;
    const healingResult: HealingResult = {
      success: allSucceeded,
      duration,
      actionsExecuted: actionResults,
      effectiveness: allSucceeded ? this.calculateEffectiveness(actionResults, duration) : 0,
      recurred: false,
      verifiedAt: new Date(),
    };

    if (!allSucceeded) {
      const failedAction = actionResults.find((a) => !a.success);
      healingResult.errorMessage =
        failedAction?.error || 'One or more actions failed';
    }

    // Update incident
    incident.status = allSucceeded ? 'healed' : 'failed';
    incident.completedAt = new Date();
    incident.result = healingResult;

    if (!allSucceeded) {
      incident.error = healingResult.errorMessage;

      await this.publishEvent(SelfHealingEvents.HEALING_FAILED, {
        incidentId: incident.id,
        error: healingResult.errorMessage,
        actionsExecuted: actionResults.length,
      });
    } else {
      await this.publishEvent(SelfHealingEvents.HEALING_COMPLETED, {
        incidentId: incident.id,
        duration,
        actionsExecuted: actionResults.length,
        effectiveness: healingResult.effectiveness,
      });
    }

    this.incidents.set(incident.id, incident);
    return incident;
  }

  /**
   * Respond to an approval request and continue healing if approved
   */
  async respondToApproval(
    requestId: string,
    response: ApprovalResponse
  ): Promise<HealingIncident> {
    const approvalRequest = this.decisionMaker.respondToApproval(
      requestId,
      response
    );

    const incident = this.incidents.get(approvalRequest.incidentId);
    if (!incident) {
      throw new Error(
        `Incident not found for approval request '${requestId}'`
      );
    }

    incident.approvalStatus = approvalRequest.status;

    await this.publishEvent(SelfHealingEvents.APPROVAL_RESPONDED, {
      incidentId: incident.id,
      approvalRequestId: requestId,
      approved: response.approved,
      respondedBy: response.respondedBy,
    });

    // If approved, continue healing
    if (response.approved && incident.status === 'pending_approval') {
      return this.executeHealing(incident);
    }

    // If rejected, mark as cancelled
    if (!response.approved) {
      incident.status = 'cancelled';
      incident.error = `Approval rejected: ${response.reason || 'No reason provided'}`;
      this.incidents.set(incident.id, incident);
    }

    return incident;
  }

  /**
   * Get incident by ID
   */
  getIncident(incidentId: string): HealingIncident | undefined {
    return this.incidents.get(incidentId);
  }

  /**
   * Get healing history with optional filters
   */
  getHistory(query: HealingHistoryQuery = {}): HealingHistoryResponse {
    let incidents = Array.from(this.incidents.values());

    // Apply filters
    if (query.appName) {
      incidents = incidents.filter((i) => i.appName === query.appName);
    }
    if (query.environment) {
      incidents = incidents.filter((i) => i.environment === query.environment);
    }
    if (query.type) {
      incidents = incidents.filter((i) => i.type === query.type);
    }
    if (query.status) {
      incidents = incidents.filter((i) => i.status === query.status);
    }
    if (query.strategyId) {
      incidents = incidents.filter(
        (i) => i.strategy?.id === query.strategyId
      );
    }
    if (query.severity) {
      incidents = incidents.filter((i) => i.severity === query.severity);
    }
    if (query.startDate) {
      incidents = incidents.filter((i) => i.startedAt >= query.startDate!);
    }
    if (query.endDate) {
      incidents = incidents.filter((i) => i.startedAt <= query.endDate!);
    }

    // Sort by startedAt descending
    incidents.sort(
      (a, b) => b.startedAt.getTime() - a.startedAt.getTime()
    );

    const total = incidents.length;

    // Apply pagination
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;
    const paginated = incidents.slice(offset, offset + limit);

    return {
      data: paginated,
      total,
      limit,
      offset,
    };
  }

  /**
   * Get healing effectiveness metrics
   */
  getEffectiveness(
    filters?: {
      appName?: string;
      environment?: string;
      startDate?: Date;
      endDate?: Date;
    }
  ): HealingEffectiveness {
    let incidents = Array.from(this.incidents.values()).filter(
      (i) => i.status !== 'new' && i.status !== 'evaluating'
    );

    // Apply filters
    if (filters?.appName) {
      incidents = incidents.filter((i) => i.appName === filters.appName);
    }
    if (filters?.environment) {
      incidents = incidents.filter(
        (i) => i.environment === filters.environment
      );
    }
    if (filters?.startDate) {
      incidents = incidents.filter((i) => i.startedAt >= filters.startDate!);
    }
    if (filters?.endDate) {
      incidents = incidents.filter((i) => i.startedAt <= filters.endDate!);
    }

    const healed = incidents.filter((i) => i.status === 'healed');
    const failed = incidents.filter((i) => i.status === 'failed');
    const escalated = incidents.filter((i) => i.status === 'escalated');

    const durations = incidents
      .filter((i) => i.completedAt)
      .map((i) => (i.completedAt!.getTime() - i.startedAt.getTime()));

    const effectivenessScores = incidents
      .filter((i) => i.result?.effectiveness !== undefined)
      .map((i) => i.result!.effectiveness!);

    const recurred = incidents.filter((i) => i.result?.recurred);

    // By incident type
    const byIncidentType: Record<string, { total: number; success: number; rate: number }> = {};
    for (const inc of incidents) {
      if (!byIncidentType[inc.type]) {
        byIncidentType[inc.type] = { total: 0, success: 0, rate: 0 };
      }
      byIncidentType[inc.type].total++;
      if (inc.status === 'healed') {
        byIncidentType[inc.type].success++;
      }
    }
    for (const key of Object.keys(byIncidentType)) {
      const entry = byIncidentType[key];
      entry.rate = entry.total > 0 ? Math.round((entry.success / entry.total) * 100) : 0;
    }

    // By strategy
    const byStrategy: Record<string, { total: number; success: number; rate: number }> = {};
    for (const inc of incidents) {
      const strategyName = inc.strategy?.name || 'unknown';
      if (!byStrategy[strategyName]) {
        byStrategy[strategyName] = { total: 0, success: 0, rate: 0 };
      }
      byStrategy[strategyName].total++;
      if (inc.status === 'healed') {
        byStrategy[strategyName].success++;
      }
    }
    for (const key of Object.keys(byStrategy)) {
      const entry = byStrategy[key];
      entry.rate = entry.total > 0 ? Math.round((entry.success / entry.total) * 100) : 0;
    }

    // By environment
    const byEnvironment: Record<string, { total: number; success: number; rate: number }> = {};
    for (const inc of incidents) {
      if (!byEnvironment[inc.environment]) {
        byEnvironment[inc.environment] = { total: 0, success: 0, rate: 0 };
      }
      byEnvironment[inc.environment].total++;
      if (inc.status === 'healed') {
        byEnvironment[inc.environment].success++;
      }
    }
    for (const key of Object.keys(byEnvironment)) {
      const entry = byEnvironment[key];
      entry.rate = entry.total > 0 ? Math.round((entry.success / entry.total) * 100) : 0;
    }

    // By action type
    const byActionType: Record<string, { total: number; success: number; rate: number }> = {};
    for (const inc of incidents) {
      if (inc.result) {
        for (const actionResult of inc.result.actionsExecuted) {
          if (!byActionType[actionResult.type]) {
            byActionType[actionResult.type] = { total: 0, success: 0, rate: 0 };
          }
          byActionType[actionResult.type].total++;
          if (actionResult.success) {
            byActionType[actionResult.type].success++;
          }
        }
      }
    }
    for (const key of Object.keys(byActionType)) {
      const entry = byActionType[key];
      entry.rate = entry.total > 0 ? Math.round((entry.success / entry.total) * 100) : 0;
    }

    const sortedDurations = [...durations].sort((a, b) => a - b);
    const medianDuration =
      sortedDurations.length > 0
        ? sortedDurations[Math.floor(sortedDurations.length / 2)]
        : 0;

    return {
      totalIncidents: incidents.length,
      healedIncidents: healed.length,
      failedIncidents: failed.length,
      escalatedIncidents: escalated.length,
      successRate:
        incidents.length > 0
          ? Math.round((healed.length / incidents.length) * 100)
          : 0,
      averageDurationMs:
        durations.length > 0
          ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
          : 0,
      medianDurationMs: medianDuration,
      averageEffectiveness:
        effectivenessScores.length > 0
          ? Math.round(
              effectivenessScores.reduce((a, b) => a + b, 0) /
                effectivenessScores.length
            )
          : 0,
      recurredIncidents: recurred.length,
      recurrenceRate:
        incidents.length > 0
          ? Math.round((recurred.length / incidents.length) * 100)
          : 0,
      byIncidentType,
      byStrategy,
      byEnvironment,
      byActionType,
    };
  }

  /**
   * Get registered healing strategies
   */
  getStrategies(): HealingStrategy[] {
    return this.strategyEngine.getAllStrategies();
  }

  /**
   * Get strategy by ID
   */
  getStrategy(strategyId: string): HealingStrategy | undefined {
    return this.strategyEngine.getStrategy(strategyId);
  }

  /**
   * Enable/disable a strategy
   */
  toggleStrategy(strategyId: string, enabled: boolean): boolean {
    if (enabled) {
      return this.strategyEngine.enableStrategy(strategyId);
    }
    return this.strategyEngine.disableStrategy(strategyId);
  }

  /**
   * Register a custom healing strategy
   */
  registerCustomStrategy(strategy: HealingStrategy): void {
    this.strategyEngine.registerStrategy(strategy);
  }

  /**
   * Get approval requests
   */
  getApprovalRequests(status?: ApprovalRequest['status']): ApprovalRequest[] {
    return this.decisionMaker.getApprovalRequests(status);
  }

  /**
   * Get approval request by ID
   */
  getApprovalRequest(requestId: string): ApprovalRequest | undefined {
    return this.decisionMaker.getApprovalRequest(requestId);
  }

  // ==================== Private Methods ====================

  /**
   * Calculate effectiveness score for a healing result
   */
  private calculateEffectiveness(
    actionResults: HealingActionResult[],
    durationMs: number
  ): number {
    if (actionResults.length === 0) return 0;

    // Base score: all actions succeeded
    const successRate =
      actionResults.filter((a) => a.success).length / actionResults.length;

    // Duration factor: faster is better (max 30s is ideal, 5min+ is poor)
    const idealDuration = 30000;
    const maxDuration = 300000;
    let durationScore = 1;
    if (durationMs > idealDuration) {
      durationScore = Math.max(
        0,
        1 - (durationMs - idealDuration) / (maxDuration - idealDuration)
      );
    }

    // Verification factor
    const verificationRate =
      actionResults.filter((a) => a.verified).length / actionResults.length;

    // Combined effectiveness score (0-100)
    const score = (successRate * 0.5 + durationScore * 0.25 + verificationRate * 0.25) * 100;

    return Math.round(Math.min(100, Math.max(0, score)));
  }

  /**
   * Publish event to event bus
   */
  private async publishEvent(type: string, data: any): Promise<void> {
    if (this.eventPublisher) {
      try {
        await this.eventPublisher.publish(type, data, {
          source: 'orion-self-healing',
        });
      } catch (error) {
        console.warn(
          `[SelfHealingService] Failed to publish event ${type}:`,
          error
        );
      }
    }
  }
}
