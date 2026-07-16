/**
 * TASK-TICKET-XFER: Engineer Suspend Service
 *
 * Manages engineer availability suspension for:
 * - Vacation/leave planning
 * - Sick leave
 * - Training absence
 * - Extended offline periods
 *
 * Features:
 * - Schedule future suspensions
 * - Auto-reassign unstarted tickets on suspend activation
 * - Backup engineer assignment
 * - SLA pause for pending tickets
 *
 * Uses PostgreSQL Repository pattern via TicketingRepository.
 */

import {
  EngineerSuspend,
  SuspendStatus,
  SuspendReason,
  EngineerProfile,
  Ticket,
  SuspensionImpact,
  EngineerAvailability,
} from './types';
import { TicketingRepository } from './TicketingRepository';
import { createLogger } from '../../utils/logger';
import { OrionError, ErrorCode } from '../../errors';

const logger = createLogger('LEngineer-LSuspend-LService');

/**
 * Engineer Suspend Service
 *
 * Manages engineer availability suspension for:
 * - Vacation/leave planning
 * - Sick leave
 * - Training absence
 * - Extended offline periods
 */
export class EngineerSuspendService {
  private ticketingRepository?: TicketingRepository;
  private suspendCheckTimer?: NodeJS.Timeout;
  private onActivateCallback?: (suspend: EngineerSuspend) => void;
  private onEndCallback?: (suspend: EngineerSuspend) => void;

  constructor(options: { ticketingRepository?: TicketingRepository }) {
    this.ticketingRepository = options.ticketingRepository;
  }

  /**
   * Create a new suspension record
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
    const suspend = await this.ticketingRepository!.createSuspend({
      engineerId: input.engineerId,
      reason: input.reason,
      startTime: input.startTime,
      endTime: input.endTime,
      backupEngineerId: input.backupEngineerId,
      autoReassignPending: input.autoReassignPending,
      pauseSLAForPending: input.pauseSLAForPending,
      notes: input.notes,
      createdBy: input.createdBy,
    });

    return suspend;
  }

  /**
   * Activate a scheduled suspension
   */
  async activateSuspend(suspendId: string): Promise<EngineerSuspend | null> {
    const suspend = await this.ticketingRepository!.findSuspendById(suspendId);
    if (!suspend) return null;

    await this.ticketingRepository!.updateSuspendStatus(suspendId, 'active');
    const updated = await this.ticketingRepository!.findSuspendById(suspendId);

    if (updated) {
      this.onActivateCallback?.(updated);
    }
    return updated;
  }

  /**
   * End a suspension and restore engineer availability
   */
  async endSuspend(suspendId: string): Promise<EngineerSuspend | null> {
    const suspend = await this.ticketingRepository!.findSuspendById(suspendId);
    if (!suspend) return null;
    if (suspend.status !== 'active') return null;

    const actualEndTime = new Date();
    await this.ticketingRepository!.updateSuspendStatus(suspendId, 'completed', actualEndTime);
    const updated = await this.ticketingRepository!.findSuspendById(suspendId);

    if (updated) {
      this.onEndCallback?.(updated);
    }
    return updated;
  }

  /**
   * Cancel a scheduled suspension
   */
  async cancelSuspend(suspendId: string): Promise<EngineerSuspend | null> {
    const suspend = await this.ticketingRepository!.findSuspendById(suspendId);
    if (!suspend) return null;
    if (suspend.status !== 'scheduled') return null;

    await this.ticketingRepository!.updateSuspendStatus(suspendId, 'cancelled');
    return await this.ticketingRepository!.findSuspendById(suspendId);
  }

  /**
   * Get active suspensions
   */
  async getActiveSuspensions(): Promise<EngineerSuspend[]> {
    return this.ticketingRepository!.getActiveSuspensions();
  }

  /**
   * List all suspensions
   */
  async listAll(): Promise<EngineerSuspend[]> {
    return this.ticketingRepository!.listAllSuspensions();
  }

  /**
   * Get scheduled (future) suspensions
   */
  async getScheduledSuspensions(): Promise<EngineerSuspend[]> {
    return this.ticketingRepository!.getScheduledSuspensions();
  }

  /**
   * Get suspension by ID
   */
  async getSuspend(suspendId: string): Promise<EngineerSuspend | null> {
    return this.ticketingRepository!.findSuspendById(suspendId);
  }

  /**
   * Get suspensions for an engineer
   */
  async getEngineerSuspensions(engineerId: string): Promise<EngineerSuspend[]> {
    return this.ticketingRepository!.getSuspensionsByEngineer(engineerId);
  }

  /**
   * Check if an engineer is currently suspended
   */
  async isSuspended(engineerId: string): Promise<boolean> {
    const activeSuspends = await this.getActiveSuspensions();
    return activeSuspends.some(s => s.engineerId === engineerId);
  }

  /**
   * Get backup engineer for a suspended engineer
   */
  async getBackupEngineer(engineerId: string, allEngineers: EngineerProfile[]): Promise<EngineerProfile | null> {
    const activeSuspends = await this.getActiveSuspensions();
    const activeSuspend = activeSuspends.find(s => s.engineerId === engineerId);
    if (!activeSuspend?.backupEngineerId) return null;

    return allEngineers.find(e => e.id === activeSuspend.backupEngineerId) || null;
  }

  /**
   * Analyze suspension impact on tickets
   */
  async analyzeImpact(suspendId: string, tickets: Ticket[]): Promise<SuspensionImpact> {
    const suspend = await this.ticketingRepository!.findSuspendById(suspendId);
    if (!suspend) {
      throw new OrionError(`Suspend ${suspendId} not found`, ErrorCode.NOT_FOUND);
    }

    // Find tickets assigned to this engineer
    const affectedTickets = tickets
      .filter(t => t.assignee === suspend.engineerId && t.status !== 'closed' && t.status !== 'resolved')
      .map(t => ({
        ticketId: t.id,
        title: t.title,
        currentStatus: t.status,
        wasReassigned: false,
      }));

    return {
      suspend,
      affectedTickets,
      totalAffected: affectedTickets.length,
    };
  }

  /**
   * Check and auto-activate scheduled suspensions
   */
  async checkAutoActivate(): Promise<EngineerSuspend[]> {
    const now = new Date();
    const scheduled = await this.getScheduledSuspensions();
    const toActivate: EngineerSuspend[] = [];

    for (const suspend of scheduled) {
      if (suspend.startTime <= now) {
        const activated = await this.activateSuspend(suspend.id);
        if (activated) {
          toActivate.push(activated);
        }
      }
    }

    return toActivate;
  }

  /**
   * Check and auto-end expired suspensions
   */
  async checkAutoEnd(): Promise<EngineerSuspend[]> {
    const now = new Date();
    const active = await this.getActiveSuspensions();
    const toEnd: EngineerSuspend[] = [];

    for (const suspend of active) {
      if (suspend.endTime <= now) {
        const ended = await this.endSuspend(suspend.id);
        if (ended) {
          toEnd.push(ended);
        }
      }
    }

    return toEnd;
  }

  /**
   * Start periodic checks for auto-activate and auto-end
   */
  startAutoChecks(intervalMs: number = 5 * 60 * 1000): void {
    this.stopAutoChecks();
    this.suspendCheckTimer = setInterval(async () => {
      const activated = await this.checkAutoActivate();
      const ended = await this.checkAutoEnd();
      if (activated.length > 0 || ended.length > 0) {
        logger.info(`[EngineerSuspendService] Auto-activated: ${activated.length}, Auto-ended: ${ended.length}`);
      }
    }, intervalMs);
  }

  /**
   * Stop periodic checks
   */
  stopAutoChecks(): void {
    if (this.suspendCheckTimer) {
      clearInterval(this.suspendCheckTimer);
      this.suspendCheckTimer = undefined;
    }
  }

  /**
   * Set callback for suspension activation
   */
  setOnActivateCallback(cb: (suspend: EngineerSuspend) => void): void {
    this.onActivateCallback = cb;
  }

  /**
   * Set callback for suspension end
   */
  setOnEndCallback(cb: (suspend: EngineerSuspend) => void): void {
    this.onEndCallback = cb;
  }

  /**
   * Clear (for testing - no-op in repository mode)
   */
  clearAll(): void {
    this.stopAutoChecks();
  }
}
