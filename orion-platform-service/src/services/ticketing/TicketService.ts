/**
 * TASK-801: Ticket Service (Main Orchestrator)
 *
 * Orchestrates ticket lifecycle, NATS event subscription
 * for auto-creation from alerts, and provides unified API
 * for all ticketing operations.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { TicketGenerator } from './TicketGenerator';
import { TicketWorkflowService } from './TicketWorkflowService';
import { TicketRelationAnalyzer } from './TicketRelationAnalyzer';
import { TicketReportService } from './TicketReportService';
import { DispatchEngine } from './DispatchEngine';
import { DispatchQueueManager } from './DispatchQueueManager';
import { LoadBalancer } from './LoadBalancer';
import { DispatchAnalytics } from './DispatchAnalytics';
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
} from './types';
import type { DispatchMetrics, AssignmentSuccessMetrics, TimeToAssignmentStats, EngineerPerformance } from './DispatchAnalytics';

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

  /** TASK-802: Smart dispatch engine */
  public dispatchEngine: DispatchEngine;

  /** TASK-802: Dispatch queue manager */
  public dispatchQueue: DispatchQueueManager;

  /** TASK-802: Load balancer */
  public loadBalancer: LoadBalancer;

  /** TASK-802: Dispatch analytics */
  public dispatchAnalytics: DispatchAnalytics;

  /** Running state */
  private isRunning: boolean = false;

  /** NATS connection */
  private natsConnection: any = null;

  /** NATS unsubscribe handler */
  private natsUnsubscribe?: () => Promise<void>;

  constructor(config?: Partial<TicketingConfig>) {
    super();

    this.config = { ...DEFAULT_CONFIG, ...config };

    // Initialize components
    this.generator = new TicketGenerator();
    this.workflow = new TicketWorkflowService();
    this.analyzer = new TicketRelationAnalyzer();
    this.reporter = new TicketReportService();

    // TASK-802: Initialize dispatch components
    this.dispatchEngine = new DispatchEngine();
    this.dispatchQueue = new DispatchQueueManager();
    this.loadBalancer = new LoadBalancer();
    this.dispatchAnalytics = new DispatchAnalytics();

    // Wire up dispatch queue callback
    this.dispatchQueue.setDispatchCallback((entry) => {
      this.attemptAutoDispatch(entry.ticket.id);
    });
  }

  // ==================== Lifecycle ====================

  /**
   * Start the ticketing service
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('[TicketService] Already running');
      return;
    }

    this.isRunning = true;
    console.log('[TicketService] Starting...');

    // Start escalation checks
    if (this.config.enableAutoEscalation) {
      this.workflow.startEscalationChecks(this.config.escalationCheckIntervalMs);
    }

    // TASK-802: Start dispatch queue auto-reprioritization
    this.dispatchQueue.startAutoReprioritize();

    // Connect to NATS
    await this.connectNats();

    this.emit('started');
    console.log('[TicketService] Started');
  }

  /**
   * Stop the ticketing service
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;

    this.isRunning = false;
    console.log('[TicketService] Stopping...');

    // Stop escalation checks
    this.workflow.stopEscalationChecks();

    // TASK-802: Stop dispatch queue auto-reprioritization
    this.dispatchQueue.stopAutoReprioritize();

    // Disconnect NATS
    if (this.natsConnection) {
      try {
        await this.natsUnsubscribe?.();
        await this.natsConnection.close();
      } catch (error) {
        console.warn('[TicketService] Error disconnecting NATS:', error);
      }
      this.natsConnection = null;
    }

    this.emit('stopped');
    console.log('[TicketService] Stopped');
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
  createTicket(data: {
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
  }): Ticket {
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

    const created = this.workflow.createTicket(ticket);
    this.analyzer.registerTicket(created);

    // TASK-802: Record for dispatch analytics
    this.dispatchAnalytics.recordTicketCreated(created);

    this.emit('ticket:created', created);
    this.publishNatsEvent('ticket.created', { ticketId: created.id, title: created.title });

    // Try auto-assignment (TASK-801: rule-based)
    if (this.config.enableAutoAssignment) {
      const result = this.workflow.autoAssignTicket(created.id);
      if (result && 'assignment' in result) {
        this.emit('ticket:auto-assigned', result);
        this.publishNatsEvent('ticket.assigned', {
          ticketId: result.ticket.id,
          assignee: result.assignment.assignee,
        });

        // TASK-802: Record dispatch
        this.recordDispatchForTicket(result.ticket, 'rule');
      } else {
        // TASK-802: Enqueue for dispatch if not assigned
        if (!result) {
          const slaTarget = this.workflow.getSLATarget(created.priority);
          this.dispatchQueue.enqueue(created, slaTarget);
        }
      }
    } else {
      // TASK-802: Even if auto-assignment disabled, queue for dispatch
      const slaTarget = this.workflow.getSLATarget(created.priority);
      this.dispatchQueue.enqueue(created, slaTarget);
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

    const duplicates = this.analyzer.detectDuplicates(
      tempTicket.id,
      this.config.duplicateDetectionThreshold
    );

    // Remove temp ticket
    this.analyzer.unregisterTicket(tempTicket.id);

    if (duplicates.length > 0) {
      console.log(
        `[TicketService] Potential duplicate detected for alert ${source.alertId}: ${duplicates[0].ticket.id}`
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
  createTicketFromIncident(source: IncidentTicketSource): Ticket {
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
  getTicket(ticketId: string): Ticket | undefined {
    return this.workflow.getTicket(ticketId);
  }

  /**
   * List tickets with filters
   */
  listTickets(filter?: {
    status?: TicketStatus;
    priority?: TicketPriority;
    category?: TicketCategory;
    assignee?: string;
    reporter?: string;
  }): Ticket[] {
    return this.workflow.listTickets(filter);
  }

  /**
   * Update a ticket
   */
  updateTicket(ticketId: string, updates: Partial<Ticket>): Ticket | null {
    return this.workflow.updateTicket(ticketId, updates);
  }

  // ==================== Workflow ====================

  /**
   * Transition ticket status
   */
  transitionStatus(
    ticketId: string,
    toStatus: TicketStatus,
    performedBy: string,
    reason?: string
  ): { ticket: Ticket } | { error: string } {
    const result = this.workflow.transitionStatus(ticketId, toStatus, performedBy, reason);

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
  assignTicket(
    ticketId: string,
    assignee: string,
    assignedBy: string,
    reason?: string
  ): { ticket: Ticket } | { error: string } {
    const result = this.workflow.assignTicket(ticketId, assignee, assignedBy, reason);

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
  escalateTicket(
    ticketId: string,
    escalatedBy: string,
    reason?: string
  ): { ticket: Ticket } | { error: string } {
    const result = this.workflow.escalateTicket(ticketId, escalatedBy, reason);

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
  resolveTicket(ticketId: string, performedBy: string, resolutionNote?: string): { ticket: Ticket } | { error: string } {
    const result = this.workflow.resolveTicket(ticketId, performedBy, resolutionNote);

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
  closeTicket(ticketId: string, performedBy: string, reason?: string): { ticket: Ticket } | { error: string } {
    return this.workflow.closeTicket(ticketId, performedBy, reason);
  }

  /**
   * Get workflow history for a ticket
   */
  getWorkflowHistory(ticketId: string) {
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

  // ==================== TASK-802: Smart Dispatch ====================

  /**
   * Register an engineer for dispatch
   */
  registerEngineer(profile: EngineerProfile): void {
    this.dispatchEngine.registerEngineer(profile);
    this.loadBalancer.registerEngineer(profile);
    this.dispatchAnalytics.registerEngineer(profile);
  }

  /**
   * Update an engineer profile
   */
  updateEngineer(id: string, updates: Partial<EngineerProfile>): boolean {
    return this.dispatchEngine.updateEngineer(id, updates) &&
      this.loadBalancer.updateEngineer(id, updates);
  }

  /**
   * Auto-dispatch a ticket to the best engineer
   */
  autoDispatch(
    ticketId: string,
    options?: {
      assignedBy?: string;
      weights?: Partial<DispatchWeights>;
      forceDispatch?: boolean;
    }
  ): DispatchResult | null {
    const ticket = this.workflow.getTicket(ticketId);
    if (!ticket) return null;

    if (ticket.assignee && ticket.status !== 'open') {
      return null; // Already assigned
    }

    // Mark dispatch attempt
    this.dispatchQueue.recordDispatchAttempt(ticketId);

    // Use dispatch engine to find best engineer
    const result = this.dispatchEngine.dispatchTicket(ticket, {
      assignedBy: options?.assignedBy,
      weights: options?.weights,
      forceDispatch: options?.forceDispatch,
    });

    if (!result) return null;

    // Assign the ticket
    const assignResult = this.workflow.assignTicket(
      ticketId,
      result.assignee,
      options?.assignedBy || 'dispatch-engine',
      result.reason
    );

    if ('ticket' in assignResult) {
      // Record in load balancer
      this.loadBalancer.recordAssignment({
        ticketId,
        engineerId: result.assignee,
        category: ticket.category,
      });

      // Record in analytics
      this.dispatchAnalytics.recordDispatch(result);

      // Mark dispatched in queue
      this.dispatchQueue.markDispatched(ticketId);

      this.emit('ticket:auto-dispatched', { ticket: assignResult.ticket, dispatch: result });
      this.publishNatsEvent('ticket.assigned', {
        ticketId,
        assignee: result.assignee,
        dispatchType: 'auto',
        score: result.score,
      });
    }

    return result;
  }

  /**
   * Attempt auto-dispatch for a ticket (internal)
   */
  private attemptAutoDispatch(ticketId: string): void {
    const result = this.autoDispatch(ticketId);
    if (result) {
      console.log(`[TicketService] Auto-dispatched ticket ${ticketId} to ${result.assignee} (score: ${result.score})`);
    }
  }

  /**
   * Manually dispatch a ticket to a specific engineer
   */
  manualDispatch(
    ticketId: string,
    engineerId: string,
    assignedBy: string,
    reason?: string
  ): DispatchResult | null {
    const ticket = this.workflow.getTicket(ticketId);
    if (!ticket) return null;

    const engineer = this.dispatchEngine.getEngineer(engineerId);
    if (!engineer) return null;

    const dispatchResult: DispatchResult = {
      id: `DISP-${ticketId}`,
      ticketId,
      assignee: engineerId,
      reason: reason || `Manual dispatch by ${assignedBy}`,
      score: 100,
      dispatchedAt: new Date(),
      dispatchType: 'manual',
      accepted: true,
    };

    this.dispatchEngine['dispatchHistory'].push(dispatchResult);
    this.loadBalancer.recordAssignment({
      ticketId,
      engineerId,
      category: ticket.category,
    });
    this.dispatchAnalytics.recordDispatch(dispatchResult);
    this.dispatchQueue.markDispatched(ticketId);

    const assignResult = this.workflow.assignTicket(
      ticketId,
      engineerId,
      assignedBy,
      reason || `Manual dispatch by ${assignedBy}`
    );

    return dispatchResult;
  }

  /**
   * Get the dispatch queue status
   */
  getDispatchQueueStatus(): DispatchQueueStatus {
    return this.dispatchQueue.getQueueStatus();
  }

  /**
   * Get dispatch queue entries
   */
  getDispatchQueueEntries(): {
    id: string;
    ticket: Ticket;
    priority: number;
    enqueuedAt: Date;
    slaDeadline?: Date;
    attempts: number;
  }[] {
    return this.dispatchQueue.getEntries().map((e) => ({
      id: e.id,
      ticket: e.ticket,
      priority: e.dispatchPriority,
      enqueuedAt: e.enqueuedAt,
      slaDeadline: e.slaDeadline,
      attempts: e.dispatchAttemptCount,
    }));
  }

  /**
   * Get SLA alerts from the dispatch queue
   */
  getDispatchSLAAlerts(options?: {
    type?: 'sla-warning' | 'sla-critical' | 'sla-breach';
    limit?: number;
  }): SLAAlert[] {
    return this.dispatchQueue.getSLAAlerts(options);
  }

  /**
   * Add a dispatch rule
   */
  addDispatchRule(rule: DispatchRule): void {
    this.dispatchEngine.addRule(rule);
  }

  /**
   * Get dispatch rules
   */
  getDispatchRules(): DispatchRule[] {
    return this.dispatchEngine.getRules();
  }

  /**
   * Remove a dispatch rule
   */
  removeDispatchRule(ruleId: string): boolean {
    return this.dispatchEngine.removeRule(ruleId);
  }

  /**
   * Find the best engineer for a ticket (without assigning)
   */
  findBestEngineerForTicket(ticketId: string) {
    const ticket = this.workflow.getTicket(ticketId);
    if (!ticket) return null;
    return this.dispatchEngine.findBestEngineer(ticket);
  }

  /**
   * Calculate dispatch score for a ticket-engineer pair
   */
  calculateDispatchScore(ticketId: string, engineerId: string) {
    const ticket = this.workflow.getTicket(ticketId);
    if (!ticket) return null;
    const engineer = this.dispatchEngine.getEngineer(engineerId);
    if (!engineer) return null;
    return this.dispatchEngine.calculateDispatchScore(ticket, engineer);
  }

  /**
   * Get load balancing report
   */
  getLoadBalancingReport(): LoadBalancingReport {
    return this.loadBalancer.getBalancingReport();
  }

  /**
   * Get reassignment suggestions
   */
  getSuggestedReassignments(): ReassignmentSuggestion[] {
    return this.loadBalancer.suggestReassignments();
  }

  /**
   * Get dispatch analytics metrics
   */
  getDispatchMetrics(options?: {
    periodStart?: Date;
    periodEnd?: Date;
  }): DispatchMetrics {
    return this.dispatchAnalytics.getDispatchMetrics(options);
  }

  /**
   * Get assignment success metrics
   */
  getAssignmentSuccessMetrics(options?: {
    periodStart?: Date;
    periodEnd?: Date;
  }): AssignmentSuccessMetrics {
    return this.dispatchAnalytics.getAssignmentSuccess(options);
  }

  /**
   * Get time-to-assignment statistics
   */
  getTimeToAssignmentStats(options?: {
    periodStart?: Date;
    periodEnd?: Date;
  }): TimeToAssignmentStats {
    return this.dispatchAnalytics.getTimeToAssignment(options);
  }

  /**
   * Get engineer performance
   */
  getEngineerPerformance(engineerId: string): EngineerPerformance | null {
    return this.dispatchAnalytics.getEngineerPerformance(engineerId);
  }

  /**
   * Get all engineer performances
   */
  getAllEngineerPerformances(): EngineerPerformance[] {
    return this.dispatchAnalytics.getAllEngineerPerformances();
  }

  /**
   * Get dispatch weights
   */
  getDispatchWeights(): DispatchWeights {
    return this.dispatchEngine.getWeights();
  }

  /**
   * Update dispatch weights
   */
  updateDispatchWeights(weights: Partial<DispatchWeights>): void {
    this.dispatchEngine.updateWeights(weights);
  }

  /**
   * Record dispatch for a ticket (internal helper)
   */
  private recordDispatchForTicket(ticket: Ticket, type: 'rule' | 'auto' | 'manual'): void {
    const result: DispatchResult = {
      id: `DISP-${ticket.id}-${Date.now()}`,
      ticketId: ticket.id,
      assignee: ticket.assignee || 'unknown',
      reason: `${type}-assigned`,
      score: type === 'rule' ? 100 : 75,
      dispatchedAt: new Date(),
      dispatchType: type,
      accepted: true,
    };

    this.dispatchAnalytics.recordDispatch(result);

    if (ticket.assignee) {
      this.loadBalancer.recordAssignment({
        ticketId: ticket.id,
        engineerId: ticket.assignee,
        category: ticket.category,
      });
    }
  }

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
  getSLACompliance(periodStart?: Date, periodEnd?: Date): SLAComplianceReport {
    const tickets = this.workflow.listTickets();
    const slaRecords = this.workflow.getAllSLARecords();
    return this.reporter.getSLACompliance(tickets, slaRecords, periodStart, periodEnd);
  }

  /**
   * Get resolution time statistics
   */
  getResolutionStats(): ResolutionStats {
    const tickets = this.workflow.listTickets();
    return this.reporter.getResolutionStats(tickets);
  }

  /**
   * Get backlog analysis
   */
  getBacklogAnalysis(): BacklogAnalysis {
    const tickets = this.workflow.listTickets();
    return this.reporter.getBacklogAnalysis(tickets);
  }

  /**
   * Get trend report
   */
  getTrendReport(options?: { days?: number; granularity?: 'hour' | 'day' | 'week' | 'month' }): TrendReport {
    const tickets = this.workflow.listTickets();
    return this.reporter.getTrendReport(tickets, options);
  }

  /**
   * Get overall statistics
   */
  getStatistics(): {
    totalTickets: number;
    byStatus: Record<TicketStatus, number>;
    byPriority: Record<TicketPriority, number>;
    byCategory: Record<string, number>;
    averageResolutionTimeMs: number;
    slaComplianceRate: number;
  } {
    const tickets = this.workflow.listTickets();
    const countsByStatus = this.workflow.getCountsByStatus();
    const slaReport = this.getSLACompliance();

    const byPriority: Record<TicketPriority, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    const byCategory: Record<string, number> = {};

    for (const ticket of tickets) {
      byPriority[ticket.priority]++;
      byCategory[ticket.category] = (byCategory[ticket.category] || 0) + 1;
    }

    const resolutionStats = this.getResolutionStats();

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
        console.log('[TicketService] NATS not available, running without event subscription');
        return;
      }

      this.natsConnection = await connect({
        servers: ['nats://localhost:4222'],
        timeout: 5000,
        reconnect: false,
      });

      console.log('[TicketService] Connected to NATS');

      // Subscribe to relevant events
      await this.subscribeToEvents();
    } catch (error) {
      console.log('[TicketService] NATS connection failed, running without event bus:', error);
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
              console.error('[TicketService] Error processing NATS message:', error);
            }
          }
        })().catch(console.error);
      }

      this.natsUnsubscribe = async () => {
        // Drain handled by connection close
      };

      console.log(`[TicketService] Subscribed to alert events`);
    } catch (error) {
      console.warn('[TicketService] Failed to subscribe to NATS events:', error);
    }
  }

  /**
   * Handle incoming alert event from NATS
   */
  private async handleAlertEvent(data: any): Promise<void> {
    if (!data || !data.alertId) return;

    console.log(`[TicketService] Received alert event: ${data.alertId}`);

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
      console.log(`[TicketService] Auto-created ticket ${ticket.id} from alert ${data.alertId}`);
    } catch (error) {
      console.error('[TicketService] Failed to create ticket from alert:', error);
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
  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    isRunning: boolean;
    totalTickets: number;
    openTickets: number;
    overdueTickets: number;
  } {
    const backlog = this.getBacklogAnalysis();

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (backlog.overdueCount > 20) status = 'unhealthy';
    else if (backlog.overdueCount > 5) status = 'degraded';

    return {
      status,
      isRunning: this.isRunning,
      totalTickets: this.workflow.getTotalCount(),
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
    this.dispatchEngine.clearAll();
    this.dispatchQueue.clearAll();
    this.loadBalancer.clearAll();
    this.dispatchAnalytics.clearAll();
  }

  private stopEscalationChecks(): void {
    this.workflow.stopEscalationChecks();
  }
}
