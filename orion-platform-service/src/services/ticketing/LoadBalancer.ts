/**
 * TASK-802: Workload Load Balancer
 *
 * Tracks engineer capacity and current load,
 * prevents overload situations, and provides
 * capacity-based reassignment recommendations.
 *
 * Uses PostgreSQL Repository pattern via TicketingRepository.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  EngineerProfile,
  EngineerLoadInfo,
  LoadBalancingReport,
  ReassignmentSuggestion,
  Ticket,
  TicketCategory,
  TicketAssignment,
} from './types';
import { TicketingRepository } from './TicketingRepository';
import { TicketLoadRecordRepository } from '../../repositories/TicketLoadRecordRepository';
import { AssignmentHistoryRepository } from '../../repositories/AssignmentHistoryRepository';

/**
 * Ticket load record for tracking assignments
 */
interface TicketLoadRecord {
  ticketId: string;
  engineerId: string;
  category: TicketCategory;
  assignedAt: Date;
  estimatedEffortHours?: number;
}

/**
 * Overload threshold - percentage of capacity at which
 * an engineer is considered overloaded
 */
const DEFAULT_OVERLOAD_THRESHOLD = 0.85; // 85% capacity

/**
 * Underutilization threshold - percentage below which
 * an engineer is considered underutilized
 */
const DEFAULT_UNDERUTILIZATION_THRESHOLD = 0.25; // 25% capacity

/**
 * Load Balancer
 *
 * Monitors and balances work distribution across team members
 * to prevent overload and ensure even capacity utilization.
 */
export class LoadBalancer {
  /** Repository for engineer profiles */
  private ticketingRepository?: TicketingRepository;

  /** Ticket load records - migrated to repository */
  private loadRecordRepository?: TicketLoadRecordRepository;
  private ticketLoads: Map<string, TicketLoadRecord> = new Map(); // in-memory cache

  /** Assignment history - migrated to repository */
  private assignmentHistoryRepository?: AssignmentHistoryRepository;
  private assignmentHistory: TicketAssignment[] = []; // in-memory cache

  /** Overload threshold */
  private overloadThreshold: number;

  /** Underutilization threshold */
  private underutilizationThreshold: number;

  constructor(options: { ticketingRepository?: TicketingRepository; overloadThreshold?: number; underutilizationThreshold?: number; db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> } }) {
    this.ticketingRepository = options.ticketingRepository;
    this.overloadThreshold = options.overloadThreshold ?? DEFAULT_OVERLOAD_THRESHOLD;
    this.underutilizationThreshold = options.underutilizationThreshold ?? DEFAULT_UNDERUTILIZATION_THRESHOLD;
    if (options.db) {
      this.loadRecordRepository = new TicketLoadRecordRepository(options.db);
      this.assignmentHistoryRepository = new AssignmentHistoryRepository(options.db);
    }
  }

  /**
   * Load cached data from PostgreSQL on startup
   */
  async loadFromDb(): Promise<void> {
    if (this.loadRecordRepository) {
      const records = await this.loadRecordRepository.findAllRecords();
      this.ticketLoads.clear();
      for (const r of records) {
        this.ticketLoads.set(r.ticketId, {
          ticketId: r.ticketId,
          engineerId: r.engineerId,
          category: r.category as any,
          assignedAt: r.assignedAt,
          estimatedEffortHours: r.estimatedEffortHours ?? undefined,
        });
      }
    }
    if (this.assignmentHistoryRepository) {
      const { entities } = await this.assignmentHistoryRepository.findAll();
      this.assignmentHistory = entities.map(e => ({
        id: e.id,
        ticketId: e.ticketId,
        assignee: e.assignee,
        assignedBy: e.assignedBy,
        assignedAt: e.assignedAt,
        reason: e.reason ?? 'auto',
        matchScore: e.matchScore ?? undefined,
      }));
    }
  }

  // ==================== Engineer Management ====================

  /**
   * Register an engineer (delegated to repository via DispatchEngine)
   */
  async registerEngineer(profile: EngineerProfile): Promise<EngineerProfile> {
    return this.ticketingRepository!.createEngineerProfile({
      id: profile.id,
      name: profile.name,
      expertise: profile.expertise,
      currentLoad: profile.currentLoad,
      maxCapacity: profile.maxCapacity,
      availability: profile.availability,
      team: profile.team,
      onCall: profile.onCall,
    });
  }

  /**
   * Update an engineer's profile
   */
  async updateEngineer(id: string, updates: Partial<EngineerProfile>): Promise<EngineerProfile | null> {
    return this.ticketingRepository!.updateEngineerProfile(id, {
      name: updates.name,
      expertise: updates.expertise,
      currentLoad: updates.currentLoad,
      maxCapacity: updates.maxCapacity,
      availability: updates.availability,
      team: updates.team,
      onCall: updates.onCall,
      skills: updates.skills,
    });
  }

  /**
   * Remove an engineer
   */
  async removeEngineer(id: string): Promise<boolean> {
    // Remove their ticket loads
    for (const [ticketId, record] of this.ticketLoads.entries()) {
      if (record.engineerId === id) {
        this.ticketLoads.delete(ticketId);
      }
    }

    // Persist to repository
    if (this.loadRecordRepository) {
      try {
        await this.loadRecordRepository.deleteByEngineerId(id);
      } catch (err) {
        // Log but don't fail
      }
    }

    return this.ticketingRepository!.deleteEngineerProfile(id);
  }

  /**
   * Get an engineer
   */
  async getEngineer(id: string): Promise<EngineerProfile | undefined> {
    const profile = await this.ticketingRepository!.findEngineerProfileById(id);
    return profile || undefined;
  }

  /**
   * List all engineers
   */
  async listEngineers(): Promise<EngineerProfile[]> {
    return this.ticketingRepository!.findAllEngineerProfiles();
  }

  // ==================== Load Tracking ====================

  /**
   * Record a ticket assignment to an engineer
   */
  async recordAssignment(assignment: {
    ticketId: string;
    engineerId: string;
    category: TicketCategory;
    estimatedEffortHours?: number;
  }): Promise<void> {
    const record: TicketLoadRecord = {
      ticketId: assignment.ticketId,
      engineerId: assignment.engineerId,
      category: assignment.category,
      assignedAt: new Date(),
      estimatedEffortHours: assignment.estimatedEffortHours,
    };

    this.ticketLoads.set(assignment.ticketId, record);

    // Persist to repository
    if (this.loadRecordRepository) {
      try {
        await this.loadRecordRepository.create({
          ticketId: assignment.ticketId,
          engineerId: assignment.engineerId,
          category: assignment.category,
          estimatedEffortHours: assignment.estimatedEffortHours ?? null,
        });
      } catch (err) {
        // Log but don't fail
      }
    }

    // Update engineer load in repository
    const engineer = await this.getEngineer(assignment.engineerId);
    if (engineer) {
      await this.ticketingRepository!.updateEngineerProfile(assignment.engineerId, {
        currentLoad: engineer.currentLoad + 1,
      });
    }
  }

  /**
   * Remove a ticket assignment (e.g., when resolved)
   */
  async removeAssignment(ticketId: string): Promise<boolean> {
    const record = this.ticketLoads.get(ticketId);
    if (!record) return false;

    this.ticketLoads.delete(ticketId);

    // Persist to repository
    if (this.loadRecordRepository) {
      try {
        await this.loadRecordRepository.deleteByTicketId(ticketId);
      } catch (err) {
        // Log but don't fail
      }
    }

    // Update engineer load in repository
    const engineer = await this.getEngineer(record.engineerId);
    if (engineer) {
      await this.ticketingRepository!.updateEngineerProfile(record.engineerId, {
        currentLoad: Math.max(0, engineer.currentLoad - 1),
      });
    }
    return true;
  }

  /**
   * Get current load for an engineer
   */
  async getEngineerLoad(engineerId: string): Promise<EngineerLoadInfo | null> {
    const engineer = await this.getEngineer(engineerId);
    if (!engineer) return null;

    return this.buildLoadInfo(engineer);
  }

  /**
   * Get all engineer loads
   */
  async getAllLoads(): Promise<EngineerLoadInfo[]> {
    const engineers = await this.listEngineers();
    return engineers.map((e) => this.buildLoadInfo(e));
  }

  /**
   * Check if an engineer is overloaded
   */
  async isOverloaded(engineerId: string): Promise<boolean> {
    const load = await this.getEngineerLoad(engineerId);
    if (!load) return false;
    return load.isOverloaded;
  }

  /**
   * Get the load for a specific ticket
   */
  getTicketLoad(ticketId: string): TicketLoadRecord | undefined {
    return this.ticketLoads.get(ticketId);
  }

  /**
   * Get tickets assigned to an engineer
   */
  getEngineerTickets(engineerId: string): TicketLoadRecord[] {
    return Array.from(this.ticketLoads.values()).filter(
      (r) => r.engineerId === engineerId
    );
  }

  // ==================== Load Balancing ====================

  /**
   * Generate a full load balancing report
   */
  async getBalancingReport(): Promise<LoadBalancingReport> {
    const loads = await this.getAllLoads();
    const suggestions = await this.suggestReassignments();

    // Calculate balance score
    const balanceScore = this.calculateBalanceScore(loads);

    const overloaded = loads
      .filter((l) => l.isOverloaded)
      .map((l) => l.engineerId);

    const underutilized = loads
      .filter((l) => l.utilizationPercent < this.underutilizationThreshold * 100)
      .map((l) => l.engineerId);

    return {
      engineerLoads: loads,
      balanceScore,
      overloadedEngineers: overloaded,
      underutilizedEngineers: underutilized,
      reassignmentSuggestions: suggestions,
    };
  }

  /**
   * Suggest reassignments to balance workload
   */
  async suggestReassignments(): Promise<ReassignmentSuggestion[]> {
    const suggestions: ReassignmentSuggestion[] = [];
    const loads = await this.getAllLoads();

    // Find overloaded engineers
    const overloaded = loads.filter((l) => l.isOverloaded);
    const underutilized = loads.filter(
      (l) => l.utilizationPercent < this.underutilizationThreshold * 100 && !l.isOverloaded
    );

    if (overloaded.length === 0 || underutilized.length === 0) {
      return suggestions;
    }

    // For each overloaded engineer, find tickets to reassign
    for (const over of overloaded) {
      const tickets = this.getEngineerTickets(over.engineerId);

      // Sort by estimated effort (reassign easiest first)
      tickets.sort((a, b) => {
        const aEffort = a.estimatedEffortHours ?? 1;
        const bEffort = b.estimatedEffortHours ?? 1;
        return aEffort - bEffort;
      });

      // Calculate how many tickets to move
      const excessLoad = over.currentLoad - Math.floor(over.maxCapacity * this.overloadThreshold);

      for (let i = 0; i < Math.min(excessLoad, tickets.length); i++) {
        const ticket = tickets[i];

        // Find best target engineer
        const target = await this.findBestReassignmentTarget(
          ticket,
          over.engineerId,
          underutilized.map((l) => l.engineerId)
        );

        if (target) {
          const currentUtil = over.utilizationPercent;
          const targetEngineer = await this.getEngineer(target.engineerId);
          const targetUtil = targetEngineer
            ? (targetEngineer.currentLoad / targetEngineer.maxCapacity) * 100
            : 0;

          const improvement = Math.abs(currentUtil - targetUtil) -
            Math.abs(
              ((over.currentLoad - 1) / over.maxCapacity) * 100 -
              (((targetEngineer?.currentLoad ?? 0) + 1) / (targetEngineer?.maxCapacity ?? 1)) * 100
            );

          suggestions.push({
            ticketId: ticket.ticketId,
            fromEngineer: over.engineerId,
            toEngineer: target.engineerId,
            reason: `Load balancing: ${over.engineerName} at ${Math.round(currentUtil)}% capacity, ${target.engineerId} at ${Math.round(targetUtil)}%`,
            expectedImprovement: Math.max(0, improvement),
          });
        }
      }
    }

    return suggestions;
  }

  /**
   * Find the best engineer for a new assignment based on current load
   */
  async findLeastLoadedEngineer(
    category: TicketCategory,
    excludeEngineers?: string[]
  ): Promise<EngineerProfile | null> {
    const candidates = (await this.listEngineers()).filter((e) => {
      if (excludeEngineers?.includes(e.id)) return false;
      if (e.currentLoad >= e.maxCapacity) return false;
      return true;
    });

    if (candidates.length === 0) return null;

    // Prefer engineers with relevant expertise and lowest load
    candidates.sort((a, b) => {
      // First sort by expertise match
      const aExpert = a.expertise.includes(category) ? 1 : 0;
      const bExpert = b.expertise.includes(category) ? 1 : 0;
      if (aExpert !== bExpert) return bExpert - aExpert;

      // Then by utilization (lowest first)
      const aUtil = a.currentLoad / a.maxCapacity;
      const bUtil = b.currentLoad / b.maxCapacity;
      return aUtil - bUtil;
    });

    return candidates[0];
  }

  /**
   * Force rebalance workload across all engineers
   * Returns suggested reassignments (does not automatically reassign)
   */
  async balanceWorkload(): Promise<ReassignmentSuggestion[]> {
    const loads = await this.getAllLoads();

    if (loads.length === 0) return [];

    // Calculate ideal load per engineer
    const totalTickets = loads.reduce((sum, l) => sum + l.currentLoad, 0);
    const totalCapacity = loads.reduce((sum, l) => sum + l.maxCapacity, 0);

    if (totalCapacity === 0) return [];

    const globalUtilization = totalTickets / totalCapacity;

    // Only rebalance if significantly unbalanced
    const maxDeviation = Math.max(...loads.map((l) =>
      Math.abs((l.currentLoad / l.maxCapacity) - globalUtilization)
    ));

    if (maxDeviation < 0.15) {
      return []; // Well balanced already
    }

    return this.suggestReassignments();
  }

  // ==================== Capacity Planning ====================

  /**
   * Get team capacity summary
   */
  async getTeamCapacity(): Promise<{
    totalCapacity: number;
    totalLoad: number;
    availableCapacity: number;
    utilizationRate: number;
    engineerCount: number;
    availableEngineers: number;
  }> {
    const loads = await this.getAllLoads();

    const totalCapacity = loads.reduce((sum, l) => sum + l.maxCapacity, 0);
    const totalLoad = loads.reduce((sum, l) => sum + l.currentLoad, 0);

    const availableEngineers = loads.filter(
      (l) => l.currentLoad < l.maxCapacity
    ).length;

    return {
      totalCapacity,
      totalLoad,
      availableCapacity: totalCapacity - totalLoad,
      utilizationRate: totalCapacity > 0 ? totalLoad / totalCapacity : 0,
      engineerCount: loads.length,
      availableEngineers,
    };
  }

  /**
   * Check if the team can handle additional tickets
   */
  async canAcceptMoreTickets(count: number = 1): Promise<boolean> {
    const capacity = await this.getTeamCapacity();
    return capacity.availableCapacity >= count;
  }

  /**
   * Get engineers who can accept more work
   */
  async getAvailableEngineers(maxLoad?: number): Promise<EngineerProfile[]> {
    const all = await this.listEngineers();
    return all.filter((e) => {
      const limit = maxLoad ?? e.maxCapacity;
      return e.currentLoad < limit &&
        e.availability !== 'offline' &&
        e.availability !== 'away';
    });
  }

  // ==================== Assignment History ====================

  /**
   * Record an assignment in history
   */
  recordAssignmentHistory(assignment: TicketAssignment): void {
    this.assignmentHistory.push({ ...assignment });

    // Persist to repository
    if (this.assignmentHistoryRepository) {
      this.assignmentHistoryRepository.create({
        id: assignment.id,
        ticketId: assignment.ticketId,
        assignee: assignment.assignee,
        assignedBy: assignment.assignedBy,
        assignedAt: assignment.assignedAt,
        reason: assignment.reason,
        matchScore: assignment.matchScore ?? null,
      }).catch(() => {/* ignore */});
    }
  }

  /**
   * Get assignment history
   */
  getAssignmentHistory(options?: {
    engineerId?: string;
    limit?: number;
  }): TicketAssignment[] {
    let history = [...this.assignmentHistory];

    if (options?.engineerId) {
      history = history.filter((a) => a.assignee === options.engineerId);
    }

    history.sort((a, b) => b.assignedAt.getTime() - a.assignedAt.getTime());

    if (options?.limit) {
      history = history.slice(0, options.limit);
    }

    return history;
  }

  // ==================== Internal Helpers ====================

  /**
   * Build load info for an engineer
   */
  private buildLoadInfo(engineer: EngineerProfile): EngineerLoadInfo {
    const utilizationPercent = engineer.maxCapacity > 0
      ? Math.round((engineer.currentLoad / engineer.maxCapacity) * 100)
      : 0;

    return {
      engineerId: engineer.id,
      engineerName: engineer.name,
      currentLoad: engineer.currentLoad,
      maxCapacity: engineer.maxCapacity,
      utilizationPercent,
      isOverloaded: utilizationPercent >= this.overloadThreshold * 100,
    };
  }

  /**
   * Calculate balance score (0-1, 1 = perfect balance)
   */
  private calculateBalanceScore(loads: EngineerLoadInfo[]): number {
    if (loads.length === 0) return 1;

    const utilizations = loads.map((l) => {
      if (l.maxCapacity === 0) return 0;
      return l.currentLoad / l.maxCapacity;
    });

    const mean = utilizations.reduce((sum, u) => sum + u, 0) / utilizations.length;
    const variance = utilizations.reduce((sum, u) => sum + Math.pow(u - mean, 2), 0) / utilizations.length;
    const stdDev = Math.sqrt(variance);

    // Convert std dev to a 0-1 score (lower std dev = higher score)
    return Math.max(0, Math.min(1, 1 - stdDev * 2));
  }

  /**
   * Find best target engineer for reassignment
   */
  private async findBestReassignmentTarget(
    ticket: TicketLoadRecord,
    fromEngineerId: string,
    candidateIds: string[]
  ): Promise<{ engineerId: string; engineerName: string } | null> {
    let best: { engineerId: string; engineerName: string; score: number } | null = null;

    for (const id of candidateIds) {
      const engineer = await this.getEngineer(id);
      if (!engineer) continue;
      if (engineer.currentLoad >= engineer.maxCapacity) continue;

      // Score: expertise match + available capacity
      let score = 0;

      // Expertise bonus
      if (engineer.expertise.includes(ticket.category)) {
        score += 50;
      }

      // Capacity bonus (more room = better)
      const roomRatio = 1 - (engineer.currentLoad / engineer.maxCapacity);
      score += roomRatio * 50;

      if (!best || score > best.score) {
        best = { engineerId: id, engineerName: engineer.name, score };
      }
    }

    if (!best) return null;

    return { engineerId: best.engineerId, engineerName: best.engineerName };
  }

  // ==================== Clear ====================

  /**
   * Clear all data (for testing)
   */
  clearAll(): void {
    this.ticketLoads.clear();
    this.assignmentHistory = [];
  }
}
