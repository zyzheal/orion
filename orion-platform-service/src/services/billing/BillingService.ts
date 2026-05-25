/**
 * Billing Service - Usage metering and billing records (Phase 4)
 */

import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// Types
// ============================================================================

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
  metadata?: Record<string, any>;
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
  billingPeriod: string;  // "2026-05"
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

// ============================================================================
// In-memory storage
// ============================================================================

const usageRecords = new Map<string, UsageRecord>();
const billingRecords = new Map<string, BillingRecord>();

// ============================================================================
// Service
// ============================================================================

export class BillingService {
  // ---- Usage Metering ----

  async recordUsage(input: RecordUsageInput, tenantId: string): Promise<UsageRecord> {
    const record: UsageRecord = {
      id: uuidv4(),
      tenantId,
      service: input.service,
      metric: input.metric,
      quantity: input.quantity,
      unitPrice: input.unitPrice,
      totalCost: input.quantity * input.unitPrice,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      metadata: input.metadata,
    };
    usageRecords.set(record.id, record);
    return record;
  }

  async getUsageByTenant(tenantId: string, params?: { service?: string; periodStart?: string; periodEnd?: string }): Promise<UsageRecord[]> {
    let result = Array.from(usageRecords.values()).filter((r) => r.tenantId === tenantId);
    if (params?.service) result = result.filter((r) => r.service === params.service);
    if (params?.periodStart) result = result.filter((r) => r.periodStart >= params.periodStart!);
    if (params?.periodEnd) result = result.filter((r) => r.periodEnd <= params.periodEnd!);
    return result;
  }

  async getUsageSummary(tenantId: string, period: string): Promise<{ totalCost: number; byService: Record<string, number> }> {
    const records = Array.from(usageRecords.values()).filter(
      (r) => r.tenantId === tenantId && r.periodStart.startsWith(period)
    );
    const byService: Record<string, number> = {};
    let totalCost = 0;
    records.forEach((r) => {
      byService[r.service] = (byService[r.service] || 0) + r.totalCost;
      totalCost += r.totalCost;
    });
    return { totalCost, byService };
  }

  // ---- Billing Records ----

  async generateBillingRecord(tenantId: string, period: string): Promise<BillingRecord> {
    const summary = await this.getUsageSummary(tenantId, period);
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);  // 30-day payment term

    const items = Object.entries(summary.byService).map(([service, cost]) => ({
      service,
      amount: cost,
    }));

    const record: BillingRecord = {
      id: uuidv4(),
      tenantId,
      billingPeriod: period,
      status: 'draft',
      totalAmount: summary.totalCost,
      paidAmount: 0,
      dueDate: dueDate.toISOString().split('T')[0],
      items: items as any,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    billingRecords.set(record.id, record);
    return record;
  }

  async getBillingRecords(tenantId: string, params?: { status?: string; period?: string }): Promise<BillingRecord[]> {
    let result = Array.from(billingRecords.values()).filter((r) => r.tenantId === tenantId);
    if (params?.status) result = result.filter((r) => r.status === params.status);
    if (params?.period) result = result.filter((r) => r.billingPeriod === params.period);
    return result;
  }

  async getBillingRecord(id: string): Promise<BillingRecord | undefined> {
    return billingRecords.get(id);
  }

  async markAsPaid(id: string, paidAmount?: number): Promise<BillingRecord | undefined> {
    const record = billingRecords.get(id);
    if (!record) return undefined;
    record.status = 'paid';
    record.paidAmount = paidAmount ?? record.totalAmount;
    record.paidAt = new Date().toISOString();
    record.updatedAt = new Date().toISOString();
    billingRecords.set(id, record);
    return record;
  }

  async updateBillingStatus(id: string, status: BillingRecord['status']): Promise<BillingRecord | undefined> {
    const record = billingRecords.get(id);
    if (!record) return undefined;
    record.status = status;
    record.updatedAt = new Date().toISOString();
    billingRecords.set(id, record);
    return record;
  }

  async getBillingSummary(tenantId: string): Promise<BillingSummary> {
    const records = Array.from(billingRecords.values()).filter((r) => r.tenantId === tenantId);
    let totalBilling = 0;
    let paidAmount = 0;
    let pendingAmount = 0;
    let overdueAmount = 0;
    const currentMonth = new Date().toISOString().slice(0, 7);

    records.forEach((r) => {
      totalBilling += r.totalAmount;
      if (r.status === 'paid') paidAmount += r.paidAmount;
      if (r.status === 'pending') pendingAmount += r.totalAmount - r.paidAmount;
      if (r.status === 'overdue') overdueAmount += r.totalAmount - r.paidAmount;
    });

    return { totalBilling, paidAmount, pendingAmount, overdueAmount, currentMonthCost: 0 };
  }
}
