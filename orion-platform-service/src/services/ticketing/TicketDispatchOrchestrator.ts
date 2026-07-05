/**
 * TASK-802: Ticket Dispatch Orchestrator
 *
 * Extracted from TicketService to handle all dispatch-related orchestration:
 * - Engineer registration and management
 * - Auto/manual dispatch
 * - Dispatch queue management
 * - Dispatch rules and weights
 * - Load balancing and analytics
 */

import { createLogger } from '../../utils/logger';

const logger = createLogger('TicketDispatchOrchestrator');
import { DispatchEngine } from './DispatchEngine';
import { DispatchQueueManager } from './DispatchQueueManager';
import { LoadBalancer } from './LoadBalancer';
import { DispatchAnalytics } from './DispatchAnalytics';
import { TicketWorkflowService } from './TicketWorkflowService';
import { TicketingRepository } from './TicketingRepository';
import {
  Ticket,
  TicketCategory,
  EngineerProfile,
  DispatchResult,
  DispatchWeights,
  DispatchQueueStatus,
  SLAAlert,
  LoadBalancingReport,
  ReassignmentSuggestion,
  DispatchRule,
  SLATarget,
} from './types';
import type { DispatchMetrics, AssignmentSuccessMetrics, TimeToAssignmentStats, EngineerPerformance } from './DispatchAnalytics';
import { getCurrentTraceId } from '../../db/tenant-context-storage';

export class TicketDispatchOrchestrator {
  public dispatchEngine: DispatchEngine;
  public dispatchQueue: DispatchQueueManager;
  public loadBalancer: LoadBalancer;
  public dispatchAnalytics: DispatchAnalytics;

  private workflow: TicketWorkflowService;

  constructor(opts: {
    workflow: TicketWorkflowService;
    repository?: TicketingRepository;
  }) {
    this.workflow = opts.workflow;
    const db = opts.repository?.getDb();

    this.dispatchEngine = opts.repository
      ? new DispatchEngine({ ticketingRepository: opts.repository })
      : new DispatchEngine({ ticketingRepository: undefined });
    this.dispatchQueue = new DispatchQueueManager();
    this.loadBalancer = opts.repository
      ? new LoadBalancer({ ticketingRepository: opts.repository, db })
      : new LoadBalancer({ ticketingRepository: undefined });
    this.dispatchAnalytics = new DispatchAnalytics(db);
  }

  /**
   * Register an engineer for dispatch
   */
  async registerEngineer(profile: EngineerProfile): Promise<EngineerProfile> {
    await this.dispatchEngine.registerEngineer(profile);
    await this.loadBalancer.registerEngineer(profile);
    this.dispatchAnalytics.registerEngineer(profile);
    return profile;
  }

  /**
   * Update an engineer profile
   */
  async updateEngineer(id: string, updates: Partial<EngineerProfile>): Promise<EngineerProfile | null> {
    const result = await this.dispatchEngine.updateEngineer(id, updates);
    await this.loadBalancer.updateEngineer(id, updates);
    return result;
  }

  /**
   * Auto-dispatch a ticket to the best engineer
   */
  async autoDispatch(
    ticketId: string,
    options?: {
      assignedBy?: string;
      weights?: Partial<DispatchWeights>;
      forceDispatch?: boolean;
    }
  ): Promise<DispatchResult | null> {
    const ticket = await this.workflow.getTicket(ticketId);
    if (!ticket) return null;

    if (ticket.assignee && ticket.status !== 'open') {
      return null; // Already assigned
    }

    // Mark dispatch attempt
    this.dispatchQueue.recordDispatchAttempt(ticketId);

    // Use dispatch engine to find best engineer
    const result = await this.dispatchEngine.dispatchTicket(ticket, {
      assignedBy: options?.assignedBy,
      weights: options?.weights,
      forceDispatch: options?.forceDispatch,
    });

    if (!result) return null;

    // Assign the ticket
    const assignResult = await this.workflow.assignTicket(
      ticketId,
      result.assignee,
      options?.assignedBy || 'dispatch-engine',
      result.reason
    );

    if ('ticket' in assignResult) {
      // Record in load balancer
      await this.loadBalancer.recordAssignment({
        ticketId,
        engineerId: result.assignee,
        category: ticket.category,
      });

      // Record in analytics
      this.dispatchAnalytics.recordDispatch(result);

      // Mark dispatched in queue
      this.dispatchQueue.markDispatched(ticketId);
    }

    return result;
  }

  /**
   * Manually dispatch a ticket to a specific engineer
   */
  async manualDispatch(
    ticketId: string,
    engineerId: string,
    assignedBy: string,
    reason?: string
  ): Promise<DispatchResult | null> {
    const ticket = await this.workflow.getTicket(ticketId);
    if (!ticket) return null;

    const engineer = await this.dispatchEngine.getEngineer(engineerId);
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
    await this.loadBalancer.recordAssignment({
      ticketId,
      engineerId,
      category: ticket.category,
    });
    this.dispatchAnalytics.recordDispatch(dispatchResult);
    this.dispatchQueue.markDispatched(ticketId);

    await this.workflow.assignTicket(
      ticketId,
      engineerId,
      assignedBy,
      reason || `Manual dispatch by ${assignedBy}`
    );

    return dispatchResult;
  }

  /**
   * Find the best engineer for a ticket (without assigning)
   */
  async findBestEngineerForTicket(ticketId: string) {
    const ticket = await this.workflow.getTicket(ticketId);
    if (!ticket) return null;
    return this.dispatchEngine.findBestEngineer(ticket);
  }

  /**
   * Calculate dispatch score for a ticket-engineer pair
   */
  async calculateDispatchScore(ticketId: string, engineerId: string) {
    const ticket = await this.workflow.getTicket(ticketId);
    if (!ticket) return null;
    const engineer = await this.dispatchEngine.getEngineer(engineerId);
    if (!engineer) return null;
    return this.dispatchEngine.calculateDispatchScore(ticket, engineer);
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
   * Get load balancing report
   */
  async getLoadBalancingReport(): Promise<LoadBalancingReport> {
    return this.loadBalancer.getBalancingReport();
  }

  /**
   * Get reassignment suggestions
   */
  async getSuggestedReassignments(): Promise<ReassignmentSuggestion[]> {
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
  async recordDispatchForTicket(ticket: Ticket, type: 'rule' | 'auto' | 'manual'): Promise<void> {
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
      await this.loadBalancer.recordAssignment({
        ticketId: ticket.id,
        engineerId: ticket.assignee,
        category: ticket.category,
      });
    }
  }

  /**
   * Enqueue a ticket for dispatch
   */
  enqueueForDispatch(ticket: Ticket, slaTarget?: SLATarget): void {
    this.dispatchQueue.enqueue(ticket, slaTarget);
  }

  /**
   * Start dispatch queue auto-reprioritization
   */
  startAutoReprioritize(): void {
    this.dispatchQueue.startAutoReprioritize();
  }

  /**
   * Stop dispatch queue auto-reprioritization
   */
  stopAutoReprioritize(): void {
    this.dispatchQueue.stopAutoReprioritize();
  }

  /**
   * Clear all data (for testing)
   */
  clearAll(): void {
    this.dispatchEngine.clearAll();
    this.dispatchQueue.clearAll();
    this.loadBalancer.clearAll();
    this.dispatchAnalytics.clearAll();
  }
}
