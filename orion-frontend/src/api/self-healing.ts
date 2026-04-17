/**
 * Self-Healing API Service
 * Incident management, strategy orchestration, approval workflow, and effectiveness tracking
 */
import { api } from './client';

export interface SelfHealingIncident {
  id: string;
  type: string;
  severity: 'critical' | 'warning' | 'info';
  appName: string;
  environment: string;
  status: string;
  strategy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SelfHealingStrategy {
  id: string;
  name: string;
  triggerType: string;
  actions: string[];
  confidence?: number;
  enabled: boolean;
  description?: string;
}

export interface SelfHealingApproval {
  id: string;
  incidentId: string;
  strategyId: string;
  status: 'pending' | 'approved' | 'rejected';
  reason?: string;
  respondedBy?: string;
  createdAt: string;
}

export interface SelfHealingEffectiveness {
  healingRate: number;
  avgMttr: number;
  totalIncidents: number;
  successRate: number;
}

export interface IncidentListParams {
  severity?: string;
  status?: string;
  appName?: string;
  page?: number;
  pageSize?: number;
}

export interface CreateIncidentInput {
  type: string;
  severity: 'critical' | 'warning' | 'info';
  appName: string;
  environment: string;
  strategyId?: string;
}

export interface StrategyListParams {
  triggerType?: string;
  enabled?: boolean;
}

export interface ApprovalListParams {
  status?: string;
  page?: number;
  pageSize?: number;
}

export interface ApprovalResponseInput {
  action: 'approved' | 'rejected';
  reason?: string;
  respondedBy?: string;
}

// ==================== Incident Management ====================

export function createIncident(data: CreateIncidentInput) {
  return api.post<SelfHealingIncident>('/v1/self-healing/incidents', data);
}

export function getIncident(id: string) {
  return api.get<SelfHealingIncident>(`/v1/self-healing/incidents/${id}`);
}

// ==================== Healing History ====================

export function getHealingHistory(params?: IncidentListParams) {
  return api.get<{ items: SelfHealingIncident[]; total: number }>('/v1/self-healing/history', { params });
}

// ==================== Effectiveness ====================

export function getEffectiveness(params?: { startDate?: string; endDate?: string }) {
  return api.get<SelfHealingEffectiveness>('/v1/self-healing/effectiveness', { params });
}

// ==================== Strategies ====================

export function getStrategies(params?: StrategyListParams) {
  return api.get<{ items: SelfHealingStrategy[] }>('/v1/self-healing/strategies', { params });
}

export function getStrategy(id: string) {
  return api.get<SelfHealingStrategy>(`/v1/self-healing/strategies/${id}`);
}

export function createStrategy(data: Omit<SelfHealingStrategy, 'id'>) {
  return api.post<SelfHealingStrategy>('/v1/self-healing/strategies', data);
}

export function toggleStrategy(id: string) {
  return api.post(`/v1/self-healing/strategies/${id}/toggle`);
}

// ==================== Approvals ====================

export function getApprovals(params?: ApprovalListParams) {
  return api.get<{ items: SelfHealingApproval[]; total: number }>('/v1/self-healing/approvals', { params });
}

export function getApproval(id: string) {
  return api.get<SelfHealingApproval>(`/v1/self-healing/approvals/${id}`);
}

export function respondToApproval(id: string, data: ApprovalResponseInput) {
  return api.post<SelfHealingApproval>(`/v1/self-healing/approvals/${id}/respond`, data);
}
