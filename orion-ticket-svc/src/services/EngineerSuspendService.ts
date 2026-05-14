/**
 * EngineerSuspendService Stub - manages engineer suspension/leave.
 */
import { EngineerSuspend, SuspensionImpact, Ticket } from '../types/ticketing';

export interface EngineerSuspendServiceOptions {
  ticketingRepository?: any;
}

export class EngineerSuspendService {
  constructor(options?: EngineerSuspendServiceOptions) {}
  setOnActivateCallback(cb: (suspend: EngineerSuspend) => void): void {}
  setOnEndCallback(cb: (suspend: EngineerSuspend) => void): void {}
  createSuspend(input: {
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
    throw new Error('NOT_IMPLEMENTED');
  }
  activateSuspend(suspendId: string): Promise<EngineerSuspend | null> {
    return Promise.resolve(null);
  }
  endSuspend(suspendId: string): Promise<EngineerSuspend | null> {
    return Promise.resolve(null);
  }
  cancelSuspend(suspendId: string): Promise<EngineerSuspend | null> {
    return Promise.resolve(null);
  }
  isSuspended(engineerId: string): Promise<boolean> {
    return Promise.resolve(false);
  }
  getActiveSuspensions(): Promise<EngineerSuspend[]> {
    return Promise.resolve([]);
  }
  getScheduledSuspensions(): Promise<EngineerSuspend[]> {
    return Promise.resolve([]);
  }
  getSuspend(suspendId: string): Promise<EngineerSuspend | null> {
    return Promise.resolve(null);
  }
  getEngineerSuspensions(engineerId: string): Promise<EngineerSuspend[]> {
    return Promise.resolve([]);
  }
  analyzeImpact(suspendId: string, tickets: Ticket[]): Promise<SuspensionImpact> {
    throw new Error('NOT_IMPLEMENTED');
  }
  checkAutoActivate(): Promise<EngineerSuspend[]> {
    return Promise.resolve([]);
  }
  checkAutoEnd(): Promise<EngineerSuspend[]> {
    return Promise.resolve([]);
  }
  startAutoChecks(intervalMs?: number): void {}
  stopAutoChecks(): void {}
  clearAll(): void {}
}
