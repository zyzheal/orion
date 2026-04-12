/**
 * TASK-802: Smart Dispatch Engine
 *
 * Scores and matches tickets to the best engineers based on
 * expertise, workload, availability, and historical resolution rates.
 * Uses configurable multi-factor weighted scoring.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  Ticket,
  TicketCategory,
  TicketPriority,
  EngineerProfile,
  DispatchResult,
  DispatchScoreBreakdown,
  DispatchWeights,
  DispatchRule,
  EngineerAvailability,
} from './types';

/**
 * Default scoring weights
 */
const DEFAULT_WEIGHTS: DispatchWeights = {
  expertise: 0.35,
  workload: 0.25,
  availability: 0.15,
  successRate: 0.15,
  slaUrgency: 0.10,
};

/**
 * Priority urgency multipliers - higher priority tickets get
 * more aggressive dispatch scoring
 */
const PRIORITY_URGENCY: Record<TicketPriority, number> = {
  critical: 1.5,
  high: 1.2,
  medium: 1.0,
  low: 0.8,
};

/**
 * Category-to-expertise mapping
 */
const CATEGORY_EXPERTISE: Record<TicketCategory, TicketCategory[]> = {
  infrastructure: ['infrastructure', 'network', 'performance'],
  application: ['application', 'deployment', 'pipeline'],
  database: ['database', 'infrastructure', 'performance'],
  network: ['network', 'infrastructure', 'security'],
  security: ['security', 'network', 'infrastructure'],
  deployment: ['deployment', 'infrastructure', 'pipeline'],
  pipeline: ['pipeline', 'deployment', 'infrastructure'],
  performance: ['performance', 'database', 'infrastructure'],
  cost: ['infrastructure', 'application'],
  other: [],
};

/**
 * Smart Dispatch Engine
 *
 * Evaluates available engineers against a ticket using
 * multi-factor scoring to find the best match.
 */
export class DispatchEngine {
  /** Registered engineer profiles */
  private engineers: Map<string, EngineerProfile> = new Map();

  /** Dispatch rules */
  private rules: DispatchRule[] = [];

  /** Scoring weights */
  private weights: DispatchWeights;

  /** Dispatch history */
  private dispatchHistory: DispatchResult[] = [];

  constructor(weights?: Partial<DispatchWeights>) {
    this.weights = { ...DEFAULT_WEIGHTS, ...weights };
  }

  // ==================== Engineer Management ====================

  /**
   * Register an engineer profile
   */
  registerEngineer(profile: EngineerProfile): void {
    this.engineers.set(profile.id, { ...profile });
  }

  /**
   * Update an engineer profile
   */
  updateEngineer(id: string, updates: Partial<EngineerProfile>): boolean {
    const existing = this.engineers.get(id);
    if (!existing) return false;

    this.engineers.set(id, { ...existing, ...updates });
    return true;
  }

  /**
   * Remove an engineer
   */
  removeEngineer(id: string): boolean {
    return this.engineers.delete(id);
  }

  /**
   * Get an engineer by ID
   */
  getEngineer(id: string): EngineerProfile | undefined {
    return this.engineers.get(id);
  }

  /**
   * List all registered engineers
   */
  listEngineers(): EngineerProfile[] {
    return Array.from(this.engineers.values());
  }

  /**
   * Get available engineers (not offline/away)
   */
  getAvailableEngineers(): EngineerProfile[] {
    return Array.from(this.engineers.values()).filter(
      (e) => e.availability !== 'offline' && e.availability !== 'away'
    );
  }

  // ==================== Dispatch Rules ====================

  /**
   * Add a dispatch rule
   */
  addRule(rule: DispatchRule): void {
    this.rules.push({ ...rule });
    this.rules.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Get all dispatch rules
   */
  getRules(): DispatchRule[] {
    return [...this.rules];
  }

  /**
   * Remove a dispatch rule
   */
  removeRule(ruleId: string): boolean {
    const idx = this.rules.findIndex((r) => r.id === ruleId);
    if (idx === -1) return false;
    this.rules.splice(idx, 1);
    return true;
  }

  // ==================== Core Dispatch ====================

  /**
   * Find the best engineer for a ticket using multi-factor scoring
   */
  findBestEngineer(
    ticket: Ticket,
    options?: {
      /** Override weights for this dispatch */
      weights?: Partial<DispatchWeights>;
      /** Exclude specific engineers */
      excludeEngineers?: string[];
      /** Only consider specific engineers */
      onlyEngineers?: string[];
    }
  ): { engineer: EngineerProfile; score: number; breakdown: DispatchScoreBreakdown } | null {
    const weights = { ...this.weights, ...options?.weights };
    const candidates = this.getAvailableEngineers().filter((e) => {
      if (options?.excludeEngineers?.includes(e.id)) return false;
      if (options?.onlyEngineers && options.onlyEngineers.length > 0 && !options.onlyEngineers.includes(e.id)) {
        return false;
      }
      return true;
    });

    if (candidates.length === 0) return null;

    // Calculate SLA urgency
    const slaUrgency = this.calculateSLAUrgency(ticket);

    // Score each candidate
    let bestEngineer: { engineer: EngineerProfile; score: number; breakdown: DispatchScoreBreakdown } | null = null;
    let bestScore = -1;

    for (const engineer of candidates) {
      // Skip overloaded engineers for non-critical tickets
      if (this.isOverloaded(engineer) && ticket.priority !== 'critical') {
        continue;
      }

      const breakdown = this.calculateScoreBreakdown(ticket, engineer, slaUrgency, weights);
      const totalScore = this.calculateWeightedScore(breakdown, weights);

      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestEngineer = { engineer, score: totalScore, breakdown };
      }
    }

    return bestEngineer;
  }

  /**
   * Calculate the full dispatch score for a ticket-engineer pair
   */
  calculateDispatchScore(
    ticket: Ticket,
    engineer: EngineerProfile,
    weights?: Partial<DispatchWeights>
  ): { score: number; breakdown: DispatchScoreBreakdown } {
    const w = { ...this.weights, ...weights };
    const slaUrgency = this.calculateSLAUrgency(ticket);
    const breakdown = this.calculateScoreBreakdown(ticket, engineer, slaUrgency, w);
    const score = this.calculateWeightedScore(breakdown, w);

    return { score, breakdown };
  }

  /**
   * Dispatch a ticket to the best available engineer
   */
  dispatchTicket(
    ticket: Ticket,
    options?: {
      assignedBy?: string;
      weights?: Partial<DispatchWeights>;
      /** Force dispatch even to overloaded engineers */
      forceDispatch?: boolean;
    }
  ): DispatchResult | null {
    // First check dispatch rules
    const ruleResult = this.matchRule(ticket);
    if (ruleResult && ruleResult.assignee !== 'best-match') {
      const engineer = this.engineers.get(ruleResult.assignee);
      if (engineer && (!this.isOverloaded(engineer) || options?.forceDispatch)) {
        const result: DispatchResult = {
          id: `DISP-${uuidv4()}`,
          ticketId: ticket.id,
          assignee: ruleResult.assignee,
          reason: `Dispatch rule: ${ruleResult.name}`,
          score: 100,
          dispatchedAt: new Date(),
          dispatchType: 'rule',
          accepted: true,
        };
        this.dispatchHistory.push(result);
        this.updateEngineerLoad(ruleResult.assignee, 1);
        return result;
      }
    }

    // Fall back to scoring-based dispatch
    const best = this.findBestEngineer(ticket, { weights: options?.weights });
    if (!best) return null;

    // Update engineer load
    this.updateEngineerLoad(best.engineer.id, 1);

    const result: DispatchResult = {
      id: `DISP-${uuidv4()}`,
      ticketId: ticket.id,
      assignee: best.engineer.id,
      reason: this.generateDispatchReason(best.breakdown, ticket),
      score: best.score,
      dispatchedAt: new Date(),
      dispatchType: 'auto',
      scoreBreakdown: best.breakdown,
      accepted: true,
    };

    this.dispatchHistory.push(result);
    return result;
  }

  /**
   * Undo a dispatch (return ticket to unassigned state)
   */
  undoDispatch(dispatchId: string): boolean {
    const idx = this.dispatchHistory.findIndex((d) => d.id === dispatchId);
    if (idx === -1) return false;

    const dispatch = this.dispatchHistory[idx];
    dispatch.accepted = false;

    // Reduce engineer load
    this.updateEngineerLoad(dispatch.assignee, -1);
    return true;
  }

  // ==================== Scoring Components ====================

  /**
   * Calculate expertise match score (0-100)
   */
  private calculateExpertiseScore(
    ticket: Ticket,
    engineer: EngineerProfile
  ): number {
    // Direct category match
    if (engineer.expertise.includes(ticket.category)) {
      return 90 + (engineer.skills?.[ticket.category] ?? 10) * 0.1;
    }

    // Related category match
    const relatedCategories = CATEGORY_EXPERTISE[ticket.category] || [];
    const relatedMatch = engineer.expertise.some((cat) => relatedCategories.includes(cat));
    if (relatedMatch) {
      return 60;
    }

    // No direct or related expertise
    return 20;
  }

  /**
   * Calculate workload balance score (0-100, higher = less loaded)
   */
  private calculateWorkloadScore(engineer: EngineerProfile): number {
    if (engineer.maxCapacity <= 0) return 0;

    const utilization = engineer.currentLoad / engineer.maxCapacity;

    // Score decreases as utilization increases
    // 0% load = 100, 100% load = 0
    return Math.max(0, Math.round((1 - utilization) * 100));
  }

  /**
   * Calculate availability score (0-100)
   */
  private calculateAvailabilityScore(availability: EngineerAvailability): number {
    const scores: Record<EngineerAvailability, number> = {
      available: 100,
      'on-call': 90,
      busy: 50,
      away: 10,
      offline: 0,
    };
    return scores[availability] ?? 0;
  }

  /**
   * Calculate historical success rate score (0-100)
   */
  private calculateSuccessRateScore(
    ticket: Ticket,
    engineer: EngineerProfile
  ): number {
    const stats = engineer.resolutionStats;

    if (stats.totalResolved === 0) return 50; // Neutral for new engineers

    // Base score from SLA compliance
    let score = stats.slaComplianceRate * 80;

    // Category-specific bonus
    const categoryResolutions = stats.resolutionByCategory[ticket.category] || 0;
    if (categoryResolutions > 0) {
      score += 10;
    }

    // Priority-specific bonus
    const priorityResolutions = stats.resolutionByPriority[ticket.priority] || 0;
    if (priorityResolutions > 0) {
      score += 5;
    }

    // Penalty for escalations
    const escalationRate = stats.totalResolved > 0
      ? stats.escalationCount / stats.totalResolved
      : 0;
    score -= escalationRate * 15;

    // Satisfaction bonus
    if (stats.satisfactionScore !== undefined) {
      score += stats.satisfactionScore * 0.05;
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Calculate SLA urgency score (0-100, higher = more urgent)
   */
  private calculateSLAUrgency(ticket: Ticket): number {
    // Base urgency from priority
    const baseUrgency = PRIORITY_URGENCY[ticket.priority] * 40;

    // Additional urgency from escalation level
    const escalationBonus = Math.min(ticket.escalationLevel * 10, 30);

    // Time-based urgency (if dueDate is set)
    let timeUrgency = 0;
    if (ticket.dueDate) {
      const now = Date.now();
      const remaining = ticket.dueDate.getTime() - now;
      const total = ticket.dueDate.getTime() - ticket.createdAt.getTime();

      if (total > 0) {
        const timeElapsed = 1 - (remaining / total);
        // As we approach the deadline, urgency increases exponentially
        timeUrgency = Math.min(Math.pow(timeElapsed, 2) * 30, 30);
      }

      // If already past due, max urgency
      if (remaining < 0) {
        timeUrgency = 30;
      }
    }

    return Math.min(100, Math.round(baseUrgency + escalationBonus + timeUrgency));
  }

  // ==================== Internal Helpers ====================

  /**
   * Calculate individual score components
   */
  private calculateScoreBreakdown(
    ticket: Ticket,
    engineer: EngineerProfile,
    slaUrgency: number,
    weights: DispatchWeights
  ): DispatchScoreBreakdown {
    return {
      expertiseScore: this.calculateExpertiseScore(ticket, engineer),
      workloadScore: this.calculateWorkloadScore(engineer),
      availabilityScore: this.calculateAvailabilityScore(engineer.availability),
      successRateScore: this.calculateSuccessRateScore(ticket, engineer),
      slaUrgencyScore: slaUrgency,
      weights,
    };
  }

  /**
   * Calculate weighted total score from breakdown
   */
  private calculateWeightedScore(
    breakdown: DispatchScoreBreakdown,
    weights: DispatchWeights
  ): number {
    const totalWeight =
      weights.expertise +
      weights.workload +
      weights.availability +
      weights.successRate +
      weights.slaUrgency;

    const weighted =
      breakdown.expertiseScore * weights.expertise +
      breakdown.workloadScore * weights.workload +
      breakdown.availabilityScore * weights.availability +
      breakdown.successRateScore * weights.successRate +
      breakdown.slaUrgencyScore * weights.slaUrgency;

    // Normalize by total weight
    return Math.round((weighted / totalWeight) * 100) / 100;
  }

  /**
   * Check if an engineer is overloaded
   */
  private isOverloaded(engineer: EngineerProfile): boolean {
    return engineer.currentLoad >= engineer.maxCapacity;
  }

  /**
   * Update engineer load (positive to add, negative to remove)
   */
  private updateEngineerLoad(engineerId: string, delta: number): void {
    const engineer = this.engineers.get(engineerId);
    if (!engineer) return;

    engineer.currentLoad = Math.max(0, engineer.currentLoad + delta);
    this.engineers.set(engineerId, engineer);
  }

  /**
   * Match a ticket against dispatch rules
   */
  private matchRule(ticket: Ticket): DispatchRule | undefined {
    for (const rule of this.rules) {
      if (!rule.enabled) continue;

      const conditions = rule.conditions;

      if (conditions.categories && conditions.categories.length > 0) {
        if (!conditions.categories.includes(ticket.category)) continue;
      }

      if (conditions.priorities && conditions.priorities.length > 0) {
        if (!conditions.priorities.includes(ticket.priority)) continue;
      }

      if (conditions.sources && conditions.sources.length > 0) {
        if (!conditions.sources.includes(ticket.source)) continue;
      }

      if (conditions.tagMatches) {
        const tagMatch = Object.entries(conditions.tagMatches).every(
          ([key, value]) => ticket.tags?.[key] === value
        );
        if (!tagMatch) continue;
      }

      if (conditions.minEscalationLevel !== undefined) {
        if (ticket.escalationLevel < conditions.minEscalationLevel) continue;
      }

      return rule;
    }

    return undefined;
  }

  /**
   * Generate human-readable dispatch reason
   */
  private generateDispatchReason(
    breakdown: DispatchScoreBreakdown,
    ticket: Ticket
  ): string {
    const reasons: string[] = [];

    if (breakdown.expertiseScore >= 80) {
      reasons.push(`strong ${ticket.category} expertise`);
    } else if (breakdown.expertiseScore >= 60) {
      reasons.push(`relevant experience in ${ticket.category}`);
    }

    if (breakdown.workloadScore >= 70) {
      reasons.push('good capacity');
    } else if (breakdown.workloadScore < 30) {
      reasons.push('high workload but best available');
    }

    if (breakdown.successRateScore >= 80) {
      reasons.push('excellent track record');
    }

    if (breakdown.slaUrgencyScore >= 70) {
      reasons.push('high urgency dispatch');
    }

    return reasons.length > 0
      ? `Auto-dispatched: ${reasons.join(', ')}`
      : 'Auto-dispatched: best available match';
  }

  // ==================== Dispatch History ====================

  /**
   * Get dispatch history
   */
  getDispatchHistory(options?: {
    ticketId?: string;
    engineerId?: string;
    limit?: number;
  }): DispatchResult[] {
    let history = [...this.dispatchHistory];

    if (options?.ticketId) {
      history = history.filter((d) => d.ticketId === options.ticketId);
    }
    if (options?.engineerId) {
      history = history.filter((d) => d.assignee === options.engineerId);
    }

    // Sort by most recent
    history.sort((a, b) => b.dispatchedAt.getTime() - a.dispatchedAt.getTime());

    if (options?.limit) {
      history = history.slice(0, options.limit);
    }

    return history;
  }

  /**
   * Get dispatch score for analysis
   */
  getAverageDispatchScore(): number {
    const accepted = this.dispatchHistory.filter((d) => d.accepted);
    if (accepted.length === 0) return 0;

    const total = accepted.reduce((sum, d) => sum + d.score, 0);
    return Math.round((total / accepted.length) * 100) / 100;
  }

  /**
   * Update scoring weights
   */
  updateWeights(weights: Partial<DispatchWeights>): void {
    this.weights = { ...this.weights, ...weights };
  }

  /**
   * Get current weights
   */
  getWeights(): DispatchWeights {
    return { ...this.weights };
  }

  /**
   * Clear all data (for testing)
   */
  clearAll(): void {
    this.engineers.clear();
    this.rules = [];
    this.dispatchHistory = [];
  }
}
