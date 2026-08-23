/**
 * Alert Escalation API
 * /api/v1/alert-escalation — Policies / Triggers / Closures / Metrics
 */
import { api } from './client';

export interface EscalationRule {
  level: number;
  delayMinutes: number;
  target: string;
  channel: string;
  message: string;
  notifyOnFail: boolean;
}

export interface EscalationPolicy {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  severity: string;
  status: string;
  rules: EscalationRule[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface EscalationTrigger {
  id: string;
  tenantId: string;
  policyId: string;
  alertId: string;
  level: number;
  target: string;
  channel: string;
  message: string;
  triggeredAt: string;
  status: string;
  resolvedAt?: string;
}

export interface AlertClosure {
  id: string;
  tenantId: string;
  alertId: string;
  status: string;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  resolutionNote: string;
  mttrSeconds: number;
  createdAt: string;
  updatedAt: string;
}

export interface AlertMetrics {
  totalAlerts: number;
  acknowledgedCount: number;
  resolvedCount: number;
  openCount: number;
  avgMTTRSeconds: number;
  avgMTTRFormatted: string;
}

// --- Policies ---

export const listPolicies = async () => {
  const res = await api.get('/api/v1/alert-escalation/policies');
  return res.data;
};

export const getPolicy = async (id: string) => {
  const res = await api.get(`/api/v1/alert-escalation/policies/${id}`);
  return res.data;
};

export const createPolicy = async (data: {
  name: string;
  description?: string;
  severity: string;
  rules: EscalationRule[];
}) => {
  const res = await api.post('/api/v1/alert-escalation/policies', data);
  return res.data;
};

export const updatePolicy = async (
  id: string,
  data: {
    name?: string;
    description?: string;
    severity?: string;
    status?: string;
    rules?: EscalationRule[];
  }
) => {
  const res = await api.put(`/api/v1/alert-escalation/policies/${id}`, data);
  return res.data;
};

export const deletePolicy = async (id: string) => {
  const res = await api.delete(`/api/v1/alert-escalation/policies/${id}`);
  return res.data;
};

// --- Evaluate ---

export const evaluatePolicy = async (alertId: string, severity: string) => {
  const res = await api.post('/api/v1/alert-escalation/evaluate', { alertId, severity });
  return res.data;
};

// --- Triggers ---

export const listTriggers = async (policyId?: string) => {
  const params: Record<string, string> = {};
  if (policyId) params.policyId = policyId;
  const res = await api.get('/api/v1/alert-escalation/triggers', { params });
  return res.data;
};

export const resolveTrigger = async (id: string) => {
  const res = await api.put(`/api/v1/alert-escalation/triggers/${id}/resolve`);
  return res.data;
};

// --- Closures ---

export const listClosures = async (status?: string) => {
  const params: Record<string, string> = {};
  if (status) params.status = status;
  const res = await api.get('/api/v1/alert-escalation/closures', { params });
  return res.data;
};

export const getClosure = async (alertId: string) => {
  const res = await api.get(`/api/v1/alert-escalation/closures/${alertId}`);
  return res.data;
};

export const acknowledgeAlert = async (alertId: string, operator: string) => {
  const res = await api.post('/api/v1/alert-escalation/acknowledge', { alertId, operator });
  return res.data;
};

export const resolveAlert = async (alertId: string, operator: string, resolutionNote?: string) => {
  const res = await api.post('/api/v1/alert-escalation/resolve', {
    alertId,
    operator,
    resolutionNote,
  });
  return res.data;
};

// --- Metrics ---

export const getMetrics = async () => {
  const res = await api.get('/api/v1/alert-escalation/metrics');
  return res.data as AlertMetrics;
};
