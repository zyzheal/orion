/**
 * OnCall Scheduling System - Types
 */

export interface OnCallSchedule {
  id: string;
  name: string;
  timezone: string;
  rotationType: 'daily' | 'weekly' | 'monthly';
  rotationStartHour: number;
  teamMembers: string[];
  startDate: Date;
  endDate?: Date;
  escalations: EscalationRule[];
  createdAt: Date;
  updatedAt: Date;
}

export interface EscalationRule {
  level: number;
  timeoutMinutes: number;
  targets: string[];
}

export interface OnCallAssignment {
  id: string;
  scheduleId: string;
  userId: string;
  startTime: Date;
  endTime: Date;
}

export interface OnCallOverride {
  id: string;
  scheduleId: string;
  originalUserId: string;
  overrideUserId: string;
  startTime: Date;
  endTime: Date;
  reason?: string;
}

export interface OnCallCheckResult {
  isOnCall: boolean;
  primaryUserId?: string;
  escalationTargets?: string[];
}
