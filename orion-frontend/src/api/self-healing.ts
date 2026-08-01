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

export async function createIncident(data: CreateIncidentInput) {
  const res = await api.post('/api/v1/self-healing/incidents', data);
  const body = res.data as { success: boolean; data: SelfHealingIncident };
  return { data: { data: body.data } };
}

export async function getIncident(id: string) {
  const res = await api.get(`/api/v1/self-healing/incidents/${id}`);
  const body = res.data as { success: boolean; data: SelfHealingIncident };
  return { data: { data: body.data } };
}

// ==================== Healing History ====================

export async function getHealingHistory(params?: IncidentListParams) {
  const res = await api.get('/api/v1/self-healing/history', { params });
  const body = res.data as { success: boolean; data: { items: SelfHealingIncident[]; total: number } };
  return { data: { data: body.data } };
}

// ==================== Effectiveness ====================

export async function getEffectiveness(params?: { startDate?: string; endDate?: string }) {
  const res = await api.get('/api/v1/self-healing/effectiveness', { params });
  const body = res.data as { success: boolean; data: SelfHealingEffectiveness };
  return { data: { data: body.data } };
}

// ==================== Strategies ====================

export async function getStrategies(params?: StrategyListParams) {
  const res = await api.get('/api/v1/self-healing/strategies', { params });
  const body = res.data as { success: boolean; data: { items: SelfHealingStrategy[] } };
  return { data: { data: body.data } };
}

export async function getStrategy(id: string) {
  const res = await api.get(`/api/v1/self-healing/strategies/${id}`);
  return (res.data as { success: boolean; data: SelfHealingStrategy }).data;
}

export async function createStrategy(data: Omit<SelfHealingStrategy, 'id'>) {
  const res = await api.post('/api/v1/self-healing/strategies', data);
  return (res.data as { success: boolean; data: SelfHealingStrategy }).data;
}

export async function toggleStrategy(id: string) {
  const res = await api.post(`/api/v1/self-healing/strategies/${id}/toggle`);
  return res.data;
}

// ==================== Approvals ====================

export async function getApprovals(params?: ApprovalListParams) {
  const res = await api.get('/api/v1/self-healing/approvals', { params });
  const body = res.data as { success: boolean; data: { items: SelfHealingApproval[]; total: number } };
  return { data: { data: body.data } };
}

export async function getApproval(id: string) {
  const res = await api.get(`/api/v1/self-healing/approvals/${id}`);
  const body = res.data as { success: boolean; data: SelfHealingApproval };
  return { data: { data: body.data } };
}

export async function respondToApproval(id: string, data: ApprovalResponseInput) {
  const res = await api.post(`/api/v1/self-healing/approvals/${id}/respond`, data);
  const body = res.data as { success: boolean; data: SelfHealingApproval };
  return { data: { data: body.data } };
}
