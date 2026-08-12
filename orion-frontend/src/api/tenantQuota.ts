/**
 * Tenant Quota API
 * /api/v1/tenant-quota — Plans / Usage / Alerts
 */
import { api } from './client';

export interface QuotaPlan {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  status: string;
  apiRateLimitPerMin: number;
  apiRateLimitPerHour: number;
  maxCIs: number;
  maxUsers: number;
  maxStorageMB: number;
  maxPipelines: number;
  maxConcurrentJobs: number;
  maxAlertsPerDay: number;
  slaTier: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuotaUsage {
  id: string;
  tenantId: string;
  metric: string;
  currentValue: number;
  peakValue: number;
  windowStart: string;
  windowEnd: string;
  resetAt: string;
  updatedAt: string;
}

export interface QuotaAlert {
  id: string;
  tenantId: string;
  metric: string;
  currentValue: number;
  limitValue: number;
  usagePct: number;
  alertLevel: string;
  notifiedAt: string;
}

export interface QuotaCheckResult {
  metric: string;
  currentValue: number;
  limit: number;
  remaining: number;
  usagePct: number;
  allowed: boolean;
  exceeded: boolean;
}

// --- Plans ---

export const listPlans = async () => {
  const res = await api.get('/api/v1/tenant-quota/plans');
  return res.data;
};

export const getPlan = async (id: string) => {
  const res = await api.get(`/api/v1/tenant-quota/plans/${id}`);
  return res.data;
};

export const createPlan = async (data: Partial<QuotaPlan> & { name: string }) => {
  const res = await api.post('/api/v1/tenant-quota/plans', data);
  return res.data;
};

export const updatePlan = async (id: string, data: Partial<QuotaPlan>) => {
  const res = await api.put(`/api/v1/tenant-quota/plans/${id}`, data);
  return res.data;
};

export const deletePlan = async (id: string) => {
  const res = await api.delete(`/api/v1/tenant-quota/plans/${id}`);
  return res.data;
};

// --- Usage ---

export const listUsage = async () => {
  const res = await api.get('/api/v1/tenant-quota/usage');
  return res.data;
};

export const getUsage = async (metric: string) => {
  const res = await api.get(`/api/v1/tenant-quota/usage/${metric}`);
  return res.data;
};

export const incrementUsage = async (metric: string, amount: number, window?: string) => {
  const res = await api.post('/api/v1/tenant-quota/usage/increment', { metric, amount, window });
  return res.data;
};

export const resetUsage = async () => {
  const res = await api.post('/api/v1/tenant-quota/usage/reset');
  return res.data;
};

export const checkQuota = async (metric: string, amount: number = 1) => {
  const res = await api.post('/api/v1/tenant-quota/check', { metric, amount });
  return res.data as QuotaCheckResult;
};

// --- Alerts ---

export const listAlerts = async () => {
  const res = await api.get('/api/v1/tenant-quota/alerts');
  return res.data;
};