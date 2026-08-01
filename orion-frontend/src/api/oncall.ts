/**
 * OnCall Scheduling API Service
 * Schedule management, rotation assignments, and overrides
 */
import { api } from './client';

// ---- Types ----

export type RotationType = 'daily' | 'weekly' | 'monthly';

export interface EscalationRule {
  level: number;
  timeoutMinutes: number;
  targets: string[];
}

export interface OnCallAssignment {
  id: string;
  scheduleId: string;
  userId: string;
  userName?: string;
  startTime: string;
  endTime: string;
}

export interface OnCallOverride {
  id: string;
  scheduleId: string;
  originalUserId: string;
  originalUserName?: string;
  overrideUserId: string;
  overrideUserName?: string;
  startTime: string;
  endTime: string;
  reason?: string;
}

export interface OnCallSchedule {
  id: string;
  name: string;
  timezone: string;
  rotationType: RotationType;
  rotationStartHour: number;
  teamMembers: string[];
  startDate: string;
  endDate?: string;
  escalations: EscalationRule[];
  createdAt: string;
  updatedAt: string;
}

export interface CurrentOnCallResult {
  isOnCall: boolean;
  primaryUserId?: string;
  primaryUserName?: string;
  escalationTargets?: string[];
  assignment?: OnCallAssignment;
  activeOverride?: OnCallOverride;
}

export interface CreateScheduleInput {
  name: string;
  timezone: string;
  rotationType: RotationType;
  teamMembers: string[];
  rotationStartHour?: number;
  escalations?: EscalationRule[];
}

export interface CreateOverrideInput {
  scheduleId: string;
  originalUserId: string;
  overrideUserId: string;
  startTime: string;
  endTime: string;
  reason?: string;
}

export interface ScheduleListResponse {
  schedules: OnCallSchedule[];
}

// ---- Schedule CRUD ----

export function getSchedules() {
  return api.get<ScheduleListResponse>('/api/oncall/schedules');
}

export function getSchedule(id: string) {
  return api.get<OnCallSchedule>(`/api/oncall/schedules/${id}`);
}

export function createSchedule(data: CreateScheduleInput) {
  return api.post<OnCallSchedule>('/api/oncall/schedules', data);
}

export function deleteSchedule(id: string) {
  return api.delete(`/api/oncall/schedules/${id}`);
}

// ---- Current On-Call ----

export function getCurrentOnCall(scheduleId: string) {
  return api.get<CurrentOnCallResult>(`/api/oncall/schedules/${scheduleId}/current`);
}

// ---- Overrides ----

export function createOverride(data: CreateOverrideInput) {
  return api.post<OnCallOverride>('/api/oncall/overrides', data);
}
