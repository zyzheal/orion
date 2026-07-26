/**
 * EngineerSuspendService - manages engineer suspension/leave.
 */
import { EngineerSuspend, SuspensionImpact, Ticket } from '../types/ticketing';

export interface EngineerSuspendServiceOptions {
  ticketingRepository?: any;
}

export class EngineerSuspendService {
  private suspensions: Map<string, EngineerSuspend> = new Map();
  private onActivateCallback?: (suspend: EngineerSuspend) => void;
  private onEndCallback?: (suspend: EngineerSuspend) => void;
  private autoCheckInterval?: ReturnType<typeof setInterval>;

  constructor(private options?: EngineerSuspendServiceOptions) {}

  setOnActivateCallback(cb: (suspend: EngineerSuspend) => void): void {
    this.onActivateCallback = cb;
  }

  setOnEndCallback(cb: (suspend: EngineerSuspend) => void): void {
    this.onEndCallback = cb;
  }

  async createSuspend(input: {
    engineerId: string;
    reason: string;
    startTime: Date;
    endTime: Date;
    backupEngineerId?: string;
    autoReassignPending?: boolean;
    pauseSLAForPending?: boolean;
    notes?: string;
    createdBy: string;
  }): Promise<EngineerSuspend> {
    const suspension: EngineerSuspend = {
      id: `SUS-${crypto.randomUUID().slice(0, 8)}`,
      engineerId: input.engineerId,
      reason: input.reason,
      startTime: input.startTime,
      endTime: input.endTime,
      backupEngineerId: input.backupEngineerId,
      autoReassignPending: input.autoReassignPending ?? true,
      pauseSLAForPending: input.pauseSLAForPending ?? false,
      notes: input.notes,
      createdBy: input.createdBy,
      status: 'scheduled',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.suspensions.set(suspension.id, suspension);
    return suspension;
  }

  async activateSuspend(suspendId: string): Promise<EngineerSuspend | null> {
    const suspension = this.suspensions.get(suspendId);
    if (!suspension) return null;
    suspension.status = 'active';
    suspension.updatedAt = new Date();
    if (this.onActivateCallback) {
      this.onActivateCallback(suspension);
    }
    return suspension;
  }

  async endSuspend(suspendId: string): Promise<EngineerSuspend | null> {
    const suspension = this.suspensions.get(suspendId);
    if (!suspension) return null;
    suspension.status = 'ended';
    suspension.updatedAt = new Date();
    if (this.onEndCallback) {
      this.onEndCallback(suspension);
    }
    return suspension;
  }

  async cancelSuspend(suspendId: string): Promise<EngineerSuspend | null> {
    const suspension = this.suspensions.get(suspendId);
    if (!suspension) return null;
    suspension.status = 'cancelled';
    suspension.updatedAt = new Date();
    return suspension;
  }

  async isSuspended(engineerId: string): Promise<boolean> {
    for (const s of this.suspensions.values()) {
      if (s.engineerId === engineerId && s.status === 'active') {
        const now = new Date();
        if (now >= s.startTime && now <= s.endTime) return true;
      }
    }
    return false;
  }

  async getActiveSuspensions(): Promise<EngineerSuspend[]> {
    const now = new Date();
    return Array.from(this.suspensions.values()).filter(
      s => s.status === 'active' && now >= s.startTime && now <= s.endTime
    );
  }

  async getScheduledSuspensions(): Promise<EngineerSuspend[]> {
    return Array.from(this.suspensions.values()).filter(s => s.status === 'scheduled');
  }

  async getSuspend(suspendId: string): Promise<EngineerSuspend | null> {
    return this.suspensions.get(suspendId) || null;
  }

  async getEngineerSuspensions(engineerId: string): Promise<EngineerSuspend[]> {
    return Array.from(this.suspensions.values()).filter(s => s.engineerId === engineerId);
  }

  async analyzeImpact(suspendId: string, tickets: Ticket[]): Promise<SuspensionImpact> {
    const suspension = this.suspensions.get(suspendId);
    if (!suspension) {
      return { affectedTickets: [], totalAffected: 0, criticalCount: 0 };
    }
    const affected = tickets.filter(t => t.assignee === suspension.engineerId && t.status !== 'closed' && t.status !== 'resolved');
    return {
      affectedTickets: affected.map(t => ({ ticketId: t.id, priority: t.priority, status: t.status })),
      totalAffected: affected.length,
      criticalCount: affected.filter(t => t.priority === 'critical').length,
    };
  }

  async checkAutoActivate(): Promise<EngineerSuspend[]> {
    const now = new Date();
    const toActivate: EngineerSuspend[] = [];
    for (const s of this.suspensions.values()) {
      if (s.status === 'scheduled' && now >= s.startTime) {
        s.status = 'active';
        s.updatedAt = new Date();
        toActivate.push(s);
        if (this.onActivateCallback) this.onActivateCallback(s);
      }
    }
    return toActivate;
  }

  async checkAutoEnd(): Promise<EngineerSuspend[]> {
    const now = new Date();
    const toEnd: EngineerSuspend[] = [];
    for (const s of this.suspensions.values()) {
      if (s.status === 'active' && now > s.endTime) {
        s.status = 'ended';
        s.updatedAt = new Date();
        toEnd.push(s);
        if (this.onEndCallback) this.onEndCallback(s);
      }
    }
    return toEnd;
  }

  startAutoChecks(intervalMs: number = 60000): void {
    this.stopAutoChecks();
    this.autoCheckInterval = setInterval(async () => {
      await this.checkAutoActivate();
      await this.checkAutoEnd();
    }, intervalMs);
  }

  stopAutoChecks(): void {
    if (this.autoCheckInterval) {
      clearInterval(this.autoCheckInterval);
      this.autoCheckInterval = undefined;
    }
  }

  clearAll(): void {
    this.stopAutoChecks();
    this.suspensions.clear();
  }
}
