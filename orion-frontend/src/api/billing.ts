/**
 * Billing API Service (Phase 4 - Quota & Billing)
 * Usage metering, billing records, billing summary
 */
import { api } from './client';

export interface UsageRecord {
  id: string;
  tenantId: string;
  service: string;
  metric: string;
  quantity: number;
  unitPrice: number;
  totalCost: number;
  periodStart: string;
  periodEnd: string;
}

export interface RecordUsageInput {
  service: string;
  metric: string;
  quantity: number;
  unitPrice: number;
  periodStart: string;
  periodEnd: string;
  metadata?: Record<string, any>;
}

export interface BillingRecord {
  id: string;
  tenantId: string;
  billingPeriod: string;
  status: 'draft' | 'pending' | 'paid' | 'overdue' | 'cancelled';
  totalAmount: number;
  paidAmount: number;
  dueDate?: string;
  paidAt?: string;
  items?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface BillingSummary {
  totalBilling: number;
  paidAmount: number;
  pendingAmount: number;
  overdueAmount: number;
  currentMonthCost: number;
}

export interface UsageSummary {
  totalCost: number;
  byService: Record<string, number>;
}

// ============================================================================
// Usage Metering
// ============================================================================

export function recordUsage(input: RecordUsageInput) {
  return api.post('/billing/usage', input);
}

export function getUsage(params?: { service?: string; periodStart?: string; periodEnd?: string }) {
  return api.get<{ data: UsageRecord[] }>('/billing/usage', { params });
}

export function getUsageSummary(params?: { period?: string }) {
  return api.get<{ data: UsageSummary }>('/billing/usage/summary', { params });
}

// ============================================================================
// Billing Records
// ============================================================================

export function generateBillingRecord(params?: { period?: string }) {
  return api.post('/billing/records', params);
}

export function getBillingRecords(params?: { status?: string; period?: string }) {
  return api.get<{ data: BillingRecord[] }>('/billing/records', { params });
}

export function getBillingRecord(id: string) {
  return api.get<{ data: BillingRecord }>(`/billing/records/${id}`);
}

export function markBillingPaid(id: string, amount?: number) {
  return api.post(`/billing/records/${id}/pay`, { amount });
}

export function updateBillingStatus(id: string, status: BillingRecord['status']) {
  return api.put(`/billing/records/${id}/status`, { status });
}

// ============================================================================
// Billing Summary
// ============================================================================

export function getBillingSummary() {
  return api.get<{ data: BillingSummary }>('/billing/summary');
}
