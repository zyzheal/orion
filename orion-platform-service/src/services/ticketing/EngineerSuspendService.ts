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
 */

import { v4 as uuidv4 } from 'uuid';
import {
  EngineerSuspend,
  SuspendStatus,
  SuspendReason,
  EngineerProfile,
  Ticket,
  SuspensionImpact,
  EngineerAvailability,
} from './types';

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
  private suspensions: Map<string, EngineerSuspend> = new Map();
  private engineerSuspends: Map<string, string[]> = new Map(); // engineerId -> suspend IDs
  private suspendCheckTimer?: NodeJS.Timeout;
  private onActivateCallback?: (suspend: EngineerSuspend) => void;
  private onEndCallback?: (suspend: EngineerSuspend) => void;

  /**
   * Create a new suspension record
   */
  createSuspend(input: {
    engineerId: string;
    reason: SuspendReason;
    startTime: Date;
    endTime: Date;
    backupEngineerId?: string;
    autoReassignPending?: boolean;
    pauseSLAForPending?: boolean;
    notes?: string;
    createdBy: string;
  }): EngineerSuspend {
    const suspend: EngineerSuspend = {
      id: `SUSP-${uuidv4()}`,
      engineerId: input.engineerId,
      reason: input.reason,
      status: input.startTime <= new Date() ? 'active' : 'scheduled',
      startTime: input.startTime,
      endTime: input.endTime,
      backupEngineerId: input.backupEngineerId,
      autoReassignPending: input.autoReassignPending ?? true,
      pauseSLAForPending: input.pauseSLAForPending ?? false,
      notes: input.notes,
      createdBy: input.createdBy,
      createdAt: new Date(),
      ticketsReassigned: 0,
    };

    this.suspensions.set(suspend.id, suspend);

    const existingIds = this.engineerSuspends.get(input.engineerId) || [];
    existingIds.push(suspend.id);
    this.engineerSuspends.set(input.engineerId, existingIds);

    return suspend;
  }

  /**
   * Activate a scheduled suspension
   */
  activateSuspend(suspendId: string): EngineerSuspend | null {
    const suspend = this.suspensions.get(suspendId);
    if (!suspend) return null;

    suspend.status = 'active';
    suspend.startTime = new Date(); // Update to actual activation time
    this.suspensions.set(suspendId, suspend);

    this.onActivateCallback?.(suspend);
    return suspend;
  }

  /**
   * End a suspension and restore engineer availability
   */
  endSuspend(suspendId: string): EngineerSuspend | null {
    const suspend = this.suspensions.get(suspendId);
    if (!suspend) return null;
    if (suspend.status !== 'active') return null;

    suspend.status = 'completed';
    suspend.actualEndTime = new Date();
    this.suspensions.set(suspendId, suspend);

    this.onEndCallback?.(suspend);
    return suspend;
  }

  /**
   * Cancel a scheduled suspension
   */
  cancelSuspend(suspendId: string): EngineerSuspend | null {
    const suspend = this.suspensions.get(suspendId);
    if (!suspend) return null;
    if (suspend.status !== 'scheduled') return null;

    suspend.status = 'cancelled';
    this.suspensions.set(suspendId, suspend);
    return suspend;
  }

  /**
   * Get active suspensions
   */
  getActiveSuspensions(): EngineerSuspend[] {
    return Array.from(this.suspensions.values())
      .filter(s => s.status === 'active')
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  }

  /**
   * Get scheduled (future) suspensions
   */
  getScheduledSuspensions(): EngineerSuspend[] {
    return Array.from(this.suspensions.values())
      .filter(s => s.status === 'scheduled')
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  }

  /**
   * Get suspension by ID
   */
  getSuspend(suspendId: string): EngineerSuspend | null {
    const s = this.suspensions.get(suspendId);
    return s ? { ...s } : null;
  }

  /**
   * Get suspensions for an engineer
   */
  getEngineerSuspensions(engineerId: string): EngineerSuspend[] {
    const suspendIds = this.engineerSuspends.get(engineerId) || [];
    return suspendIds
      .map(id => this.suspensions.get(id))
      .filter((s): s is EngineerSuspend => s !== undefined)
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
  }

  /**
   * Check if an engineer is currently suspended
   */
  isSuspended(engineerId: string): boolean {
    const activeSuspends = this.getActiveSuspensions();
    return activeSuspends.some(s => s.engineerId === engineerId);
  }

  /**
   * Get backup engineer for a suspended engineer
   */
  getBackupEngineer(engineerId: string, allEngineers: EngineerProfile[]): EngineerProfile | null {
    const activeSuspend = this.getActiveSuspensions().find(s => s.engineerId === engineerId);
    if (!activeSuspend?.backupEngineerId) return null;

    return allEngineers.find(e => e.id === activeSuspend.backupEngineerId) || null;
  }

  /**
   * Analyze suspension impact on tickets
   */
  analyzeImpact(suspendId: string, tickets: Ticket[]): SuspensionImpact {
    const suspend = this.suspensions.get(suspendId);
    if (!suspend) {
      throw new Error(`Suspend ${suspendId} not found`);
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
  checkAutoActivate(): EngineerSuspend[] {
    const now = new Date();
    const toActivate: EngineerSuspend[] = [];

    for (const suspend of this.suspensions.values()) {
      if (suspend.status === 'scheduled' && suspend.startTime <= now) {
        this.activateSuspend(suspend.id);
        toActivate.push(suspend);
      }
    }

    return toActivate;
  }

  /**
   * Check and auto-end expired suspensions
   */
  checkAutoEnd(): EngineerSuspend[] {
    const now = new Date();
    const toEnd: EngineerSuspend[] = [];

    for (const suspend of this.suspensions.values()) {
      if (suspend.status === 'active' && suspend.endTime <= now) {
        this.endSuspend(suspend.id);
        toEnd.push(suspend);
      }
    }

    return toEnd;
  }

  /**
   * Start periodic checks for auto-activate and auto-end
   */
  startAutoChecks(intervalMs: number = 5 * 60 * 1000): void {
    this.stopAutoChecks();
    this.suspendCheckTimer = setInterval(() => {
      const activated = this.checkAutoActivate();
      const ended = this.checkAutoEnd();
      if (activated.length > 0 || ended.length > 0) {
        console.log(`[EngineerSuspendService] Auto-activated: ${activated.length}, Auto-ended: ${ended.length}`);
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
   * Clear all data (for testing)
   */
  clearAll(): void {
    this.suspensions.clear();
    this.engineerSuspends.clear();
    this.stopAutoChecks();
  }
}
