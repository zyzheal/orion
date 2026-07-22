/**
 * DispatchAnalytics Stub - analytics for dispatch operations.
 */
import { Ticket, EngineerProfile, DispatchResult } from '../types/ticketing';

export interface DispatchMetrics {
  totalDispatches: number;
  autoDispatchCount: number;
  manualDispatchCount: number;
  ruleDispatchCount: number;
  averageScore: number;
  acceptanceRate: number;
}

export interface AssignmentSuccessMetrics {
  totalAssignments: number;
  successfulResolutions: number;
  successRate: number;
  avgTimeToResolutionMs: number;
}

export interface TimeToAssignmentStats {
  avgTimeToAssignmentMs: number;
  p50TimeToAssignmentMs: number;
  p95TimeToAssignmentMs: number;
  totalAssigned: number;
}

export interface EngineerPerformance {
  engineerId: string;
  totalDispatched: number;
  acceptedCount: number;
  avgScore: number;
  avgTimeToAcceptanceMs: number;
}

export class DispatchAnalytics {
  recordTicketCreated(_ticket: Ticket): void {}
  recordDispatch(_result: DispatchResult): void {}
  registerEngineer(_profile: EngineerProfile): void {}
  getDispatchMetrics(_options?: { periodStart?: Date; periodEnd?: Date }): DispatchMetrics {
    return { totalDispatches: 0, autoDispatchCount: 0, manualDispatchCount: 0, ruleDispatchCount: 0, averageScore: 0, acceptanceRate: 0 };
  }
  getAssignmentSuccess(_options?: { periodStart?: Date; periodEnd?: Date }): AssignmentSuccessMetrics {
    return { totalAssignments: 0, successfulResolutions: 0, successRate: 0, avgTimeToResolutionMs: 0 };
  }
  getTimeToAssignment(_options?: { periodStart?: Date; periodEnd?: Date }): TimeToAssignmentStats {
    return { avgTimeToAssignmentMs: 0, p50TimeToAssignmentMs: 0, p95TimeToAssignmentMs: 0, totalAssigned: 0 };
  }
  getEngineerPerformance(_engineerId: string): EngineerPerformance | null {
    return null;
  }
  getAllEngineerPerformances(): EngineerPerformance[] {
    return [];
  }
  clearAll(): void {}
}
