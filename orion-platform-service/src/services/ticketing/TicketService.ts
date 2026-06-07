/**
 * TASK-801: Ticket Service (Main Orchestrator)
 *
 * Orchestrates ticket lifecycle, NATS event subscription
 * for auto-creation from alerts, and provides unified API
 * for all ticketing operations.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
import { TicketGenerator } from './TicketGenerator';
import { TicketWorkflowService } from './TicketWorkflowService';
import { TicketRelationAnalyzer } from './TicketRelationAnalyzer';
import { TicketReportService } from './TicketReportService';
import { TicketBIService, TransferRecord, CommentRecord, DashboardOptions } from './TicketBIService';
import { TicketDispatchOrchestrator } from './TicketDispatchOrchestrator';
import { TicketTransferService } from './TicketTransferService';
import { EngineerSuspendService } from './EngineerSuspendService';
import { TicketingRepository } from './TicketingRepository';
import {
  Ticket,
  TicketStatus,
  TicketPriority,
  TicketCategory,
  TicketSource,
  TicketingConfig,
  AlertTicketSource,
  IncidentTicketSource,
  AssignmentRule,
  SLATarget,
  SLAComplianceReport,
  ResolutionStats,
  BacklogAnalysis,
  TrendReport,
  EngineerProfile,
  DispatchResult,
  DispatchWeights,
  DispatchQueueStatus,
  SLAAlert,
  LoadBalancingReport,
  ReassignmentSuggestion,
  DispatchRule,
  TicketTransfer,
  TransferStats,
  AutoTransferConfig,
  SuspendReason,
  SuspensionImpact,
  EngineerSuspend,
  TimeGranularity,
  ExecutiveDashboard,
  ManagerDashboard,
  EngineerDashboard,
  EngineerEfficiencyMetrics,
  EfficiencyScore,
  PeriodComparison,
  BIExportData,
  TicketAssignment,
} from './types';
import type { DispatchMetrics, AssignmentSuccessMetrics, TimeToAssignmentStats, EngineerPerformance } from './DispatchAnalytics';
import { getCurrentTraceId } from '../../db/tenant-context-storage';

/**
 * Default ticketing configuration
 */
const DEFAULT_CONFIG: TicketingConfig = {
  natsSubjectPrefix: 'orion.ticketing',
  defaultSLAHours: { critical: 4, high: 8, medium: 24, low: 72 },
  enableAutoAssignment: true,
  enableAutoEscalation: true,
  escalationCheckIntervalMs: 5 * 60 * 1000, // 5 minutes
  duplicateDetectionThreshold: 0.7,
  maxTicketsInMemory: 100000,
};

/**
 * NATS event types for ticketing
 */
export type TicketingEventType =
  | 'alert.triggered'
  | 'alert.resolved'
  | 'incident.created'
  | 'ticket.created'
  | 'ticket.assigned'
  | 'ticket.status_changed'
  | 'ticket.escalated'
  | 'ticket.resolved';

/**
 * Ticket Service - Main orchestration layer
 *
 * Coordinates:
 * - Ticket creation (manual and from alerts/incidents)
 * - Workflow management
 * - Auto-assignment and escalation
 * - Ticket relation analysis
 * - Reporting and statistics
 * - NATS event subscription for auto-creation
 * - Smart dispatch (TASK-802)
 */
export class TicketService extends EventEmitter {
  /** Service configuration */
  private config: TicketingConfig;

  /** Ticket generator */
  public generator: TicketGenerator;

  /** Workflow service */
  public workflow: TicketWorkflowService;

  /** Relation analyzer */
  public analyzer: TicketRelationAnalyzer;

  /** Report service */
  public reporter: TicketReportService;

  /** TASK-802: Dispatch orchestrator (manages engine, queue, balancer, analytics) */
  public dispatch: TicketDispatchOrchestrator;

  /** TASK-TICKET-XFER: Ticket transfer service */
  public transfer: TicketTransferService;

  /** TASK-TICKET-XFER: Engineer suspend service */
  public suspend: EngineerSuspendService;

  /** TASK-TICKET-BI: BI analytics service */
  public bi: TicketBIService;

  /** Running state */
  private isRunning: boolean = false;

  /** NATS connection */
  private natsConnection: any = null;

  /** NATS unsubscribe handler */
  private natsUnsubscribe?: () => Promise<void>;

  /** Repository (shared across sub-services) */
  private repository: TicketingRepository | undefined;

  constructor(config?: Partial<TicketingConfig>, repository?: TicketingRepository) {
    super();

    this.config = { ...DEFAULT_CONFIG, ...config };
    this.repository = repository;

    // Initialize components
    this.generator = new TicketGenerator();
    this.workflow = repository
      ? new TicketWorkflowService({ ticketingRepository: repository })
      : new TicketWorkflowService({ ticketingRepository: undefined });
    this.analyzer = repository
      ? new TicketRelationAnalyzer({ ticketingRepository: repository })
      : new TicketRelationAnalyzer({ ticketingRepository: undefined });
    this.reporter = new TicketReportService();

    // TASK-802: Initialize dispatch orchestrator
    this.dispatch = new TicketDispatchOrchestrator({ workflow: this.workflow, repository });

    // TASK-TICKET-XFER: Initialize transfer and suspend services
    this.transfer = new TicketTransferService();
    this.suspend = repository
      ? new EngineerSuspendService({ ticketingRepository: repository })
      : new EngineerSuspendService({ ticketingRepository: undefined });

    // TASK-TICKET-BI: Initialize BI analytics service
    this.bi = new TicketBIService(repository?.getDb());

    // Wire up dispatch queue callback
    this.dispatch.dispatchQueue.setDispatchCallback((entry) => {
      this.attemptAutoDispatch(entry.ticket.id);
    });

    // Wire up transfer callback to update ticket assignee
    this.transfer.setTransferCallback((transfer, ticket) => {
      this.workflow.assignTicket(
        ticket.id,
        transfer.toEngineer,
        transfer.initiatedBy,
        `Transferred: ${transfer.reason}`
      );
    });

    // Wire up suspend callbacks to mark engineers in dispatch engine
    this.suspend.setOnActivateCallback((suspend) => {
      this.dispatch.dispatchEngine.markEngineerSuspended(suspend.engineerId);
      if (suspend.autoReassignPending) {
        this.reassignTicketsForSuspend(suspend);
      }
    });

    this.suspend.setOnEndCallback((suspend) => {
      this.dispatch.dispatchEngine.markEngineerActive(suspend.engineerId);
    });
  }

  // ==================== Lifecycle ====================

  /**
   * Start the ticketing service
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.info({ traceId: getCurrentTraceId(), tenantId: 'unknown-tenant' }, '[TicketService] Already running');
      return;
    }

    this.isRunning = true;
    logger.info({ traceId: getCurrentTraceId(), tenantId: 'unknown-tenant' }, '[TicketService] Starting...');

    // Start escalation checks
    if (this.config.enableAutoEscalation) {
      this.workflow.startEscalationChecks(this.config.escalationCheckIntervalMs);
    }

    // TASK-802: Start dispatch queue auto-reprioritization
    this.dispatch.startAutoReprioritize();

    // Connect to NATS
    await this.connectNats();

    this.emit('started');
    logger.info({ traceId: getCurrentTraceId(), tenantId: 'unknown-tenant' }, '[TicketService] Started');
  }

  /**
   * Stop the ticketing service
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;

    this.isRunning = false;
    logger.info({ traceId: getCurrentTraceId(), tenantId: 'unknown-tenant' }, '[TicketService] Stopping...');

    // Stop escalation checks
    this.workflow.stopEscalationChecks();

    // TASK-802: Stop dispatch queue auto-reprioritization
    this.dispatch.stopAutoReprioritize();

    // Disconnect NATS
    if (this.natsConnection) {
      try {
        await this.natsUnsubscribe?.();
        await this.natsConnection.close();
      } catch (error) {
        logger.warn({ traceId: getCurrentTraceId(), tenantId: 'unknown-tenant' }, '[TicketService] Error disconnecting NATS', error);
      }
      this.natsConnection = null;
    }

    this.emit('stopped');
    logger.info({ traceId: getCurrentTraceId(), tenantId: 'unknown-tenant' }, '[TicketService] Stopped');
  }

  /**
   * Check if service is running
   */
  getIsRunning(): boolean {
    return this.isRunning;
  }

  // ==================== Ticket CRUD ====================

  /**
   * Create a ticket manually
   */
  async createTicket(data: {
    title: string;
    description: string;
    category: TicketCategory;
    priority: TicketPriority;
    reporter: string;
    tags?: Record<string, string>;
    metadata?: Record<string, any>;
    source?: TicketSource;
    sourceAlertId?: string;
    sourceIncidentId?: string;
  }): Promise<Ticket> {
    const now = new Date();
    const ticket: Ticket = {
      id: `TKT-${uuidv4()}`,
      title: data.title,
      description: data.description,
      category: data.category,
      priority: data.priority,
      status: 'open',
      reporter: data.reporter,
      source: data.source || 'manual',
      sourceAlertId: data.sourceAlertId,
      sourceIncidentId: data.sourceIncidentId,
      createdAt: now,
      updatedAt: now,
      escalationLevel: 0,
      tags: data.tags,
      metadata: data.metadata,
    };

    const created = await this.workflow.createTicket(ticket);
    this.analyzer.registerTicket(created);

    // TASK-802: Record for dispatch analytics
    this.dispatch.dispatchAnalytics.recordTicketCreated(created);

    this.emit('ticket:created', created);
    this.publishNatsEvent('ticket.created', { ticketId: created.id, title: created.title });

    // Try auto-assignment (TASK-801: rule-based)
    if (this.config.enableAutoAssignment) {
      const result = await this.workflow.autoAssignTicket(created.id);
      if (result && 'assignment' in result) {
        this.emit('ticket:auto-assigned', result);
        this.publishNatsEvent('ticket.assigned', {
          ticketId: result.ticket.id,
          assignee: result.assignment.assignee,
        });

        // TASK-802: Record dispatch
        this.dispatch.recordDispatchForTicket(result.ticket, 'rule');
      } else {
        // TASK-802: Enqueue for dispatch if not assigned
        if (!result) {
          const slaTarget = this.workflow.getSLATarget(created.priority);
          this.dispatch.enqueueForDispatch(created, slaTarget);
        }
      }
    } else {
      // TASK-802: Even if auto-assignment disabled, queue for dispatch
      const slaTarget = this.workflow.getSLATarget(created.priority);
      this.dispatch.enqueueForDispatch(created, slaTarget);
    }

    return created;
  }

  /**
   * Create a ticket from an alert
   */
  async createTicketFromAlert(source: AlertTicketSource): Promise<Ticket> {
    // Check for duplicates first
    // We temporarily create the ticket to check similarity
    const tempTicket = this.generator.generateFromAlert(source);
    this.analyzer.registerTicket(tempTicket);

    const duplicates = await this.analyzer.detectDuplicates(
      tempTicket.id,
      this.config.duplicateDetectionThreshold
    );

    // Remove temp ticket
    this.analyzer.unregisterTicket(tempTicket.id);

    if (duplicates.length > 0) {
      logger.info(
        {
          traceId: getCurrentTraceId(),
          tenantId: 'unknown-tenant',
          alertId: source.alertId ? '***' : '',
          duplicateTicketId: duplicates[0].ticket.id ? '***' : ''
        },
        '[TicketService] Potential duplicate detected for alert'
      );
    }

    const ticket = this.generator.generateFromAlert(source);
    return this.createTicket({
      title: ticket.title,
      description: ticket.description,
      category: ticket.category,
      priority: ticket.priority,
      reporter: ticket.reporter,
      source: 'alert',
      sourceAlertId: source.alertId,
      tags: ticket.tags,
      metadata: ticket.metadata,
    });
  }

  /**
   * Create a ticket from an incident
   */
  async createTicketFromIncident(source: IncidentTicketSource): Promise<Ticket> {
    const ticket = this.generator.generateFromIncident(source);

    return this.createTicket({
      title: ticket.title,
      description: ticket.description,
      category: ticket.category,
      priority: ticket.priority,
      reporter: ticket.reporter,
      source: 'incident',
      sourceIncidentId: source.incidentId,
      tags: ticket.tags,
      metadata: ticket.metadata,
    });
  }

  /**
   * Get a ticket by ID
   */
  async getTicket(ticketId: string): Promise<Ticket | undefined> {
    return this.workflow.getTicket(ticketId);
  }

  /**
   * List tickets with filters
   */
  async listTickets(filter?: {
    status?: TicketStatus;
    priority?: TicketPriority;
    category?: TicketCategory;
    assignee?: string;
    reporter?: string;
  }): Promise<Ticket[]> {
    return this.workflow.listTickets(filter);
  }

  /**
   * Update a ticket
   */
  async updateTicket(ticketId: string, updates: Partial<Ticket>): Promise<Ticket | null> {
    return this.workflow.updateTicket(ticketId, updates);
  }

  // ==================== Workflow ====================

  /**
   * Transition ticket status
   */
  async transitionStatus(
    ticketId: string,
    toStatus: TicketStatus,
    performedBy: string,
    reason?: string
  ): Promise<{ ticket: Ticket } | { error: string }> {
    const result = await this.workflow.transitionStatus(ticketId, toStatus, performedBy, reason);

    if ('ticket' in result) {
      this.emit('ticket:status_changed', {
        ticket: result.ticket,
        history: result.history,
      });
      this.publishNatsEvent('ticket.status_changed', {
        ticketId: result.ticket.id,
        fromStatus: result.history.fromStatus,
        toStatus: result.history.toStatus,
      });
    }

    return result;
  }

  /**
   * Assign ticket to a user
   */
  async assignTicket(
    ticketId: string,
    assignee: string,
    assignedBy: string,
    reason?: string
  ): Promise<{ ticket: Ticket; assignment: TicketAssignment } | { error: string }> {
    const result = await this.workflow.assignTicket(ticketId, assignee, assignedBy, reason);

    if ('ticket' in result) {
      this.emit('ticket:assigned', result);
      this.publishNatsEvent('ticket.assigned', {
        ticketId: result.ticket.id,
        assignee,
      });
    }

    return result;
  }

  /**
   * Escalate a ticket
   */
  async escalateTicket(
    ticketId: string,
    escalatedBy: string,
    reason?: string
  ): Promise<{ ticket: Ticket } | { error: string }> {
    const result = await this.workflow.escalateTicket(ticketId, escalatedBy, reason);

    if ('ticket' in result) {
      this.emit('ticket:escalated', result);
      this.publishNatsEvent('ticket.escalated', {
        ticketId: result.ticket.id,
        escalationLevel: result.ticket.escalationLevel,
      });
    }

    return result;
  }

  /**
   * Resolve a ticket
   */
  async resolveTicket(ticketId: string, performedBy: string, resolutionNote?: string): Promise<{ ticket: Ticket } | { error: string }> {
    const result = await this.workflow.resolveTicket(ticketId, performedBy, resolutionNote);

    if ('ticket' in result) {
      this.emit('ticket:resolved', result.ticket);
      this.publishNatsEvent('ticket.resolved', {
        ticketId: result.ticket.id,
        resolutionNote,
      });
    }

    return result;
  }

  /**
   * Close a ticket
   */
  async closeTicket(ticketId: string, performedBy: string, reason?: string): Promise<{ ticket: Ticket } | { error: string }> {
    return this.workflow.closeTicket(ticketId, performedBy, reason);
  }

  /**
   * Get workflow history for a ticket
   */
  async getWorkflowHistory(ticketId: string) {
    return this.workflow.getWorkflowHistory(ticketId);
  }

  // ==================== Assignment ====================

  /**
   * Add an assignment rule
   */
  addAssignmentRule(rule: AssignmentRule): void {
    this.workflow.addAssignmentRule(rule);
  }

  /**
   * Get assignment rules
   */
  getAssignmentRules(): AssignmentRule[] {
    return this.workflow.getAssignmentRules();
  }

  /**
   * Remove an assignment rule
   */
  removeAssignmentRule(ruleId: string): boolean {
    return this.workflow.removeAssignmentRule(ruleId);
  }

  // ==================== TASK-802: Smart Dispatch (delegated) ====================

  /** @deprecated Use this.dispatch.dispatchEngine directly */
  get dispatchEngine() { return this.dispatch.dispatchEngine; }
  /** @deprecated Use this.dispatch.dispatchQueue directly */
  get dispatchQueue() { return this.dispatch.dispatchQueue; }
  /** @deprecated Use this.dispatch.loadBalancer directly */
  get loadBalancer() { return this.dispatch.loadBalancer; }
  /** @deprecated Use this.dispatch.dispatchAnalytics directly */
  get dispatchAnalytics() { return this.dispatch.dispatchAnalytics; }

  registerEngineer(profile: EngineerProfile) { return this.dispatch.registerEngineer(profile); }
  updateEngineer(id: string, updates: Partial<EngineerProfile>) { return this.dispatch.updateEngineer(id, updates); }
  autoDispatch(ticketId: string, options?: { assignedBy?: string; weights?: Partial<DispatchWeights>; forceDispatch?: boolean }) { return this.dispatch.autoDispatch(ticketId, options); }
  manualDispatch(ticketId: string, engineerId: string, assignedBy: string, reason?: string) { return this.dispatch.manualDispatch(ticketId, engineerId, assignedBy, reason); }
  findBestEngineerForTicket(ticketId: string) { return this.dispatch.findBestEngineerForTicket(ticketId); }
  calculateDispatchScore(ticketId: string, engineerId: string) { return this.dispatch.calculateDispatchScore(ticketId, engineerId); }
  getDispatchQueueStatus() { return this.dispatch.getDispatchQueueStatus(); }
  getDispatchQueueEntries() { return this.dispatch.getDispatchQueueEntries(); }
  getDispatchSLAAlerts(options?: { type?: 'sla-warning' | 'sla-critical' | 'sla-breach'; limit?: number }) { return this.dispatch.getDispatchSLAAlerts(options); }
  addDispatchRule(rule: DispatchRule) { return this.dispatch.addDispatchRule(rule); }
  getDispatchRules() { return this.dispatch.getDispatchRules(); }
  removeDispatchRule(ruleId: string) { return this.dispatch.removeDispatchRule(ruleId); }
  getLoadBalancingReport() { return this.dispatch.getLoadBalancingReport(); }
  getSuggestedReassignments() { return this.dispatch.getSuggestedReassignments(); }
  getDispatchMetrics(options?: { periodStart?: Date; periodEnd?: Date }) { return this.dispatch.getDispatchMetrics(options); }
  getAssignmentSuccessMetrics(options?: { periodStart?: Date; periodEnd?: Date }) { return this.dispatch.getAssignmentSuccessMetrics(options); }
  getTimeToAssignmentStats(options?: { periodStart?: Date; periodEnd?: Date }) { return this.dispatch.getTimeToAssignmentStats(options); }
  getEngineerPerformance(engineerId: string) { return this.dispatch.getEngineerPerformance(engineerId); }
  getAllEngineerPerformances() { return this.dispatch.getAllEngineerPerformances(); }
  getDispatchWeights() { return this.dispatch.getDispatchWeights(); }
  updateDispatchWeights(weights: Partial<DispatchWeights>) { return this.dispatch.updateDispatchWeights(weights); }

  /**
   * Attempt auto-dispatch for a ticket (internal)
   */
  private async attemptAutoDispatch(ticketId: string): Promise<void> {
    const result = await this.dispatch.autoDispatch(ticketId);
    if (result) {
      logger.info(
        {
          traceId: getCurrentTraceId(),
          tenantId: 'unknown-tenant',
          ticketId: ticketId ? '***' : '',
          assignee: result.assignee ? '***' : '',
          score: result.score
        },
        '[TicketService] Auto-dispatched ticket'
      );
    }
  }

  // ==================== TASK-TICKET-XFER: Transfer & Suspend ====================

  /**
   * Transfer a ticket to another engineer
   */
  async transferTicket(
    ticketId: string,
    toEngineer: string,
    initiatedBy: string,
    reason: string
  ): Promise<{ transfer: TicketTransfer; holdDurationMs: number } | { error: string }> {
    const ticket = await this.workflow.getTicket(ticketId);
    if (!ticket) {
      return { error: `Ticket ${ticketId} not found` };
    }
    if (!ticket.assignee) {
      return { error: `Ticket ${ticketId} is not assigned` };
    }
    return this.transfer.transferTicket(ticket, ticket.assignee, toEngineer, initiatedBy, reason);
  }

  /**
   * Get transfer history for a ticket
   */
  getTransferHistory(ticketId: string): TicketTransfer[] {
    return this.transfer.getTransferHistory(ticketId);
  }

  /**
   * Get transfer statistics
   */
  getTransferStats(periodStart?: Date, periodEnd?: Date): TransferStats {
    return this.transfer.getTransferStats(periodStart, periodEnd);
  }

  /**
   * Get most transferred tickets
   */
  getMostTransferredTickets(limit?: number): { ticketId: string; count: number }[] {
    return this.transfer.getMostTransferredTickets(limit);
  }

  /**
   * Update auto transfer config
   */
  updateTransferConfig(config: Partial<AutoTransferConfig>): void {
    this.transfer.updateConfig(config);
  }

  /**
   * Get current transfer config
   */
  getTransferConfig(): AutoTransferConfig {
    return this.transfer.getConfig();
  }

  /**
   * Reassign tickets for a suspended engineer (internal helper)
   */
  private async reassignTicketsForSuspend(suspend: EngineerSuspend): Promise<void> {
    const tickets = await this.workflow.listTickets({ assignee: suspend.engineerId });
    let reassigned = 0;

    for (const ticket of tickets) {
      // Only reassign tickets that haven't been started (assigned status)
      if (ticket.status !== 'assigned') continue;

      if (suspend.backupEngineerId) {
        // Transfer to backup engineer
        const result = this.transfer.transferDueToSuspend(ticket, suspend.backupEngineerId, suspend.createdBy);
        if ('transfer' in result) {
          reassigned++;
        }
      } else {
        // Try to find a new engineer via dispatch
        const dispatchResult = await this.autoDispatch(ticket.id, {
          assignedBy: suspend.createdBy,
          forceDispatch: true,
        });
        if (dispatchResult) {
          reassigned++;
        }
      }
    }

    // Update the suspend record
    const updated = await this.suspend.getSuspend(suspend.id);
    if (updated) {
      (updated as any).ticketsReassigned = reassigned;
    }
  }

  /**
   * Create a new engineer suspension
   */
  async createSuspend(input: {
    engineerId: string;
    reason: SuspendReason;
    startTime: Date;
    endTime: Date;
    backupEngineerId?: string;
    autoReassignPending?: boolean;
    pauseSLAForPending?: boolean;
    notes?: string;
    createdBy: string;
  }): Promise<EngineerSuspend> {
    return this.suspend.createSuspend(input);
  }

  /**
   * Activate a suspension
   */
  async activateSuspend(suspendId: string): Promise<EngineerSuspend | null> {
    return this.suspend.activateSuspend(suspendId);
  }

  /**
   * End a suspension
   */
  async endSuspend(suspendId: string): Promise<EngineerSuspend | null> {
    return this.suspend.endSuspend(suspendId);
  }

  /**
   * Cancel a scheduled suspension
   */
  async cancelSuspend(suspendId: string): Promise<EngineerSuspend | null> {
    return this.suspend.cancelSuspend(suspendId);
  }

  /**
   * Check if an engineer is currently suspended
   */
  async isEngineerSuspended(engineerId: string): Promise<boolean> {
    return this.suspend.isSuspended(engineerId);
  }

  /**
   * Get active suspensions
   */
  async getActiveSuspensions(): Promise<EngineerSuspend[]> {
    return this.suspend.getActiveSuspensions();
  }

  /**
   * Get scheduled suspensions
   */
  async getScheduledSuspensions(): Promise<EngineerSuspend[]> {
    return this.suspend.getScheduledSuspensions();
  }

  /**
   * Get suspension by ID
   */
  async getSuspend(suspendId: string): Promise<EngineerSuspend | null> {
    return this.suspend.getSuspend(suspendId);
  }

  /**
   * Get suspensions for an engineer
   */
  async getEngineerSuspensions(engineerId: string): Promise<EngineerSuspend[]> {
    return this.suspend.getEngineerSuspensions(engineerId);
  }

  /**
   * List all suspensions with optional status filter
   */
  async listSuspensions(status?: string): Promise<EngineerSuspend[]> {
    const all = await this.suspend.listAll();
    if (status) {
      return all.filter(s => s.status === status);
    }
    return all;
  }

  /**
   * Get suspension impact for an engineer
   */
  async getEngineerSuspendImpact(engineerId: string): Promise<SuspensionImpact | null> {
    const suspensions = await this.suspend.getEngineerSuspensions(engineerId);
    const active = suspensions.find(s => s.status === 'active');
    if (!active) return null;
    const tickets = await this.workflow.listTickets();
    return this.suspend.analyzeImpact(active.id, tickets);
  }

  /**
   * Analyze suspension impact on tickets
   */
  async analyzeSuspendImpact(suspendId: string): Promise<SuspensionImpact> {
    const tickets = await this.workflow.listTickets();
    return this.suspend.analyzeImpact(suspendId, tickets);
  }

  /**
   * Check and auto-activate scheduled suspensions
   */
  async checkAutoActivateSuspensions(): Promise<EngineerSuspend[]> {
    return this.suspend.checkAutoActivate();
  }

  /**
   * Check and auto-end expired suspensions
   */
  async checkAutoEndSuspensions(): Promise<EngineerSuspend[]> {
    return this.suspend.checkAutoEnd();
  }

  /**
   * Start auto checks for suspensions
   */
  startSuspendAutoChecks(intervalMs?: number): void {
    this.suspend.startAutoChecks(intervalMs);
  }

  /**
   * Stop auto checks for suspensions
   */
  stopSuspendAutoChecks(): void {
    this.suspend.stopAutoChecks();
  }

  // ==================== TASK-TICKET-BI: BI Analytics ====================

  /**
   * Load data into BI service for analysis
   */
  async loadBIData(data: {
    tickets?: Ticket[];
    slaRecords?: any[];
    dispatchResults?: DispatchResult[];
    transferRecords?: TransferRecord[];
    commentRecords?: CommentRecord[];
    engineerProfiles?: EngineerProfile[];
  }): Promise<void> {
    this.bi.loadData({
      tickets: data.tickets || await this.workflow.listTickets(),
      slaRecords: data.slaRecords || await this.workflow.getAllSLARecords(),
      dispatchResults: data.dispatchResults,
      transferRecords: data.transferRecords,
      commentRecords: data.commentRecords,
      engineerProfiles: data.engineerProfiles || await this.dispatchEngine.listEngineers(),
    });
  }

  /**
   * Get executive dashboard (boss view)
   */
  getExecutiveDashboard(options?: DashboardOptions): ExecutiveDashboard {
    this.syncBIData();
    return this.bi.getExecutiveDashboard(options);
  }

  /**
   * Get manager dashboard (team view)
   */
  getManagerDashboard(options?: DashboardOptions): ManagerDashboard {
    this.syncBIData();
    return this.bi.getManagerDashboard(options);
  }

  /**
   * Get engineer personal dashboard
   */
  getEngineerDashboard(engineerId: string, options?: DashboardOptions): EngineerDashboard | null {
    this.syncBIData();
    return this.bi.getEngineerDashboard(engineerId, options);
  }

  /**
   * Get engineer efficiency metrics
   */
  getEngineerEfficiency(
    engineerId: string,
    granularity: TimeGranularity = 'day',
    start?: Date,
    end?: Date
  ): EngineerEfficiencyMetrics {
    this.syncBIData();
    return this.bi.getEngineerEfficiency(engineerId, granularity, start, end);
  }

  /**
   * Get engineer efficiency score with 4-dimensional breakdown
   */
  getEfficiencyScore(engineerId: string, start?: Date, end?: Date): EfficiencyScore {
    this.syncBIData();
    return this.bi.getEfficiencyScore(engineerId, start, end);
  }

  /**
   * Compare metrics between two periods
   */
  comparePeriods(
    currentStart: Date,
    currentEnd: Date,
    previousStart: Date,
    previousEnd: Date
  ): PeriodComparison {
    this.syncBIData();
    return this.bi.comparePeriods(currentStart, currentEnd, previousStart, previousEnd);
  }

  /**
   * Export data for external BI tools
   */
  exportBIData(options: {
    dataset: 'tickets' | 'sla' | 'dispatch' | 'efficiency';
    granularity?: TimeGranularity;
    periodStart?: Date;
    periodEnd?: Date;
  }): BIExportData {
    this.syncBIData();
    return this.bi.exportBIData(options);
  }

  /**
   * Get time trend data
   */
  getBITimeTrend(options?: {
    metric?: 'volume' | 'resolution' | 'sla' | 'load';
    start?: Date;
    end?: Date;
    granularity?: TimeGranularity;
  }) {
    this.syncBIData();
    return this.bi.getTimeTrend(options);
  }

  /**
   * Sync current service data into BI service
   */
  private async syncBIData(): Promise<void> {
    this.bi.loadData({
      tickets: await this.workflow.listTickets(),
      slaRecords: await this.workflow.getAllSLARecords(),
      engineerProfiles: await this.dispatchEngine.listEngineers(),
    });
  }

  // ==================== NATS Integration ====================

  // ==================== Relations ====================

  /**
   * Find related tickets
   */
  findRelatedTickets(ticketId: string, options?: {
    maxResults?: number;
    minConfidence?: number;
  }) {
    return this.analyzer.findRelatedTickets(ticketId, options);
  }

  /**
   * Detect duplicate tickets
   */
  detectDuplicates(ticketId: string, threshold?: number) {
    return this.analyzer.detectDuplicates(ticketId, threshold ?? this.config.duplicateDetectionThreshold);
  }

  /**
   * Correlate root cause across tickets
   */
  correlateRootCause(ticketIds: string[]) {
    return this.analyzer.correlateRootCause(ticketIds);
  }

  /**
   * Get relations for a ticket
   */
  getRelationsForTicket(ticketId: string) {
    return this.analyzer.getRelationsForTicket(ticketId);
  }

  // ==================== Reports ====================

  /**
   * Get SLA compliance report
   */
  async getSLACompliance(periodStart?: Date, periodEnd?: Date): Promise<SLAComplianceReport> {
    const tickets = await this.workflow.listTickets();
    const slaRecords = await this.workflow.getAllSLARecords();
    return this.reporter.getSLACompliance(tickets, slaRecords, periodStart, periodEnd);
  }

  /**
   * Get resolution time statistics
   */
  async getResolutionStats(): Promise<ResolutionStats> {
    const tickets = await this.workflow.listTickets();
    return this.reporter.getResolutionStats(tickets);
  }

  /**
   * Get backlog analysis
   */
  async getBacklogAnalysis(): Promise<BacklogAnalysis> {
    const tickets = await this.workflow.listTickets();
    return this.reporter.getBacklogAnalysis(tickets);
  }

  /**
   * Get trend report
   */
  async getTrendReport(options?: { days?: number; granularity?: 'hour' | 'day' | 'week' | 'month' }): Promise<TrendReport> {
    const tickets = await this.workflow.listTickets();
    return this.reporter.getTrendReport(tickets, options);
  }

  /**
   * Get overall statistics
   */
  async getStatistics(): Promise<{
    totalTickets: number;
    byStatus: Record<TicketStatus, number>;
    byPriority: Record<TicketPriority, number>;
    byCategory: Record<string, number>;
    averageResolutionTimeMs: number;
    slaComplianceRate: number;
  }> {
    const tickets = await this.workflow.listTickets();
    const countsByStatus = await this.workflow.getCountsByStatus();
    const slaReport = await this.getSLACompliance();

    const byPriority: Record<TicketPriority, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    const byCategory: Record<string, number> = {};

    for (const ticket of tickets) {
      byPriority[ticket.priority]++;
      byCategory[ticket.category] = (byCategory[ticket.category] || 0) + 1;
    }

    const resolutionStats = await this.getResolutionStats();

    return {
      totalTickets: tickets.length,
      byStatus: countsByStatus,
      byPriority,
      byCategory,
      averageResolutionTimeMs: resolutionStats.meanResolutionTimeMs,
      slaComplianceRate: slaReport.complianceRate,
    };
  }

  // ==================== SLA ====================

  /**
   * Add SLA target
   */
  addSLATarget(target: SLATarget): void {
    this.workflow.addSLATarget(target);
  }

  /**
   * Get SLA for a ticket
   */
  getTicketSLA(ticketId: string) {
    return this.workflow.getTicketSLA(ticketId);
  }

  // ==================== NATS Integration ====================

  /**
   * Connect to NATS for ticketing events
   */
  private async connectNats(): Promise<void> {
    try {
      const { connect } = await import('nats').catch(() => ({ connect: null }));

      if (!connect) {
        logger.info({ traceId: getCurrentTraceId(), tenantId: 'unknown-tenant' }, '[TicketService] NATS not available, running without event subscription');
        return;
      }

      this.natsConnection = await connect({
        servers: ['nats://localhost:4222'],
        timeout: 5000,
        reconnect: false,
      });

      logger.info({ traceId: getCurrentTraceId(), tenantId: 'unknown-tenant' }, '[TicketService] Connected to NATS');

      // Subscribe to relevant events
      await this.subscribeToEvents();
    } catch (error) {
      logger.info({ traceId: getCurrentTraceId(), tenantId: 'unknown-tenant' }, '[TicketService] NATS connection failed, running without event bus', error);
    }
  }

  /**
   * Subscribe to NATS ticketing events
   */
  private async subscribeToEvents(): Promise<void> {
    if (!this.natsConnection) return;

    try {
      // Subscribe to alert events for auto-ticket creation
      const subjects = [
        'orion.monitoring.alert.triggered',
        `${this.config.natsSubjectPrefix}.alert.triggered`,
      ];

      for (const subject of subjects) {
        const subscription = this.natsConnection.subscribe(subject, {
          queue: 'orion-ticketing',
        });

        (async () => {
          for await (const msg of subscription) {
            try {
              const data = JSON.parse(new TextDecoder().decode(msg.data));
              await this.handleAlertEvent(data);
              msg.ack();
            } catch (error) {
              logger.error({ traceId: getCurrentTraceId(), tenantId: 'unknown-tenant' }, '[TicketService] Error processing NATS message', error);
            }
          }
        })().catch((err) => logger.error({ traceId: getCurrentTraceId(), err }, 'NATS subscription failed'));
      }

      this.natsUnsubscribe = async () => {
        // Drain handled by connection close
      };

      logger.info({ traceId: getCurrentTraceId(), tenantId: 'unknown-tenant' }, '[TicketService] Subscribed to alert events');
    } catch (error) {
      logger.warn({ traceId: getCurrentTraceId(), tenantId: 'unknown-tenant' }, '[TicketService] Failed to subscribe to NATS events', error);
    }
  }

  /**
   * Handle incoming alert event from NATS
   */
  private async handleAlertEvent(data: any): Promise<void> {
    if (!data || !data.alertId) return;

    logger.info(
        {
          traceId: getCurrentTraceId(),
          tenantId: 'unknown-tenant',
          alertId: data.alertId ? '***' : ''
        },
        '[TicketService] Received alert event'
      );

    const alertSource: AlertTicketSource = {
      alertId: data.alertId,
      metric: data.metric || 'unknown',
      severity: data.severity || 'warning',
      message: data.message || '',
      tags: data.tags || {},
      triggeredAt: data.triggeredAt ? new Date(data.triggeredAt) : new Date(),
      ruleName: data.ruleName,
    };

    try {
      const ticket = await this.createTicketFromAlert(alertSource);
      logger.info(
        {
          traceId: getCurrentTraceId(),
          tenantId: 'unknown-tenant',
          ticketId: ticket.id ? '***' : '',
          alertId: data.alertId ? '***' : ''
        },
        '[TicketService] Auto-created ticket from alert'
      );
    } catch (error) {
      logger.error('[TicketService] Failed to create ticket from alert:', error);
    }
  }

  /**
   * Publish event to NATS
   */
  private async publishNatsEvent(eventType: string, data: any): Promise<void> {
    if (!this.natsConnection) return;

    try {
      const subject = `${this.config.natsSubjectPrefix}.${eventType}`;
      const message = JSON.stringify({
        type: eventType,
        source: 'orion-ticketing-service',
        data,
        timestamp: new Date().toISOString(),
      });

      await this.natsConnection.publish(
        subject,
        new TextEncoder().encode(message)
      );
    } catch (error) {
      // Silently fail - NATS is optional
    }
  }

  // ==================== Health ====================

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    isRunning: boolean;
    totalTickets: number;
    openTickets: number;
    overdueTickets: number;
  }> {
    const backlog = await this.getBacklogAnalysis();

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (backlog.overdueCount > 20) status = 'unhealthy';
    else if (backlog.overdueCount > 5) status = 'degraded';

    const totalTickets = await this.workflow.getTotalCount();
    return {
      status,
      isRunning: this.isRunning,
      totalTickets,
      openTickets: backlog.openCount + backlog.assignedCount + backlog.inProgressCount,
      overdueTickets: backlog.overdueCount,
    };
  }

  /**
   * Clear all data (for testing)
   */
  clearAll(): void {
    this.workflow.clearAll();
    this.analyzer.clearAll();
    this.stopEscalationChecks();
    this.dispatch.clearAll();
    this.transfer.clearAll();
    this.suspend.clearAll();
    this.bi.clearAll();
  }

  private stopEscalationChecks(): void {
    this.workflow.stopEscalationChecks();
  }
}
