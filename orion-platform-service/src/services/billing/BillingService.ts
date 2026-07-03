/**
 * Billing Service - Usage metering and billing records (Phase 4)
 *
 * Migrated to PostgreSQL Repository pattern.
 * When DatabasePool is provided, uses BillingRepository for persistent storage.
 * Falls back to in-memory Map() when no database is available (tests, dev mode).
 */

import { v4 as uuidv4 } from 'uuid';
import { DatabasePool } from '../database';
import { BillingRepository } from '../../repositories/BillingRepository';
import { createLogger } from '../utils/logger';

const logger = pino({ name: 'BillingService' });

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
// Service
// ============================================================================

export class BillingService {
  private repo: BillingRepository | null;
  private useDb: boolean;

  // In-memory fallback storage (used when no DB)
  private usageRecords = new Map<string, UsageRecord>();
  private billingRecords = new Map<string, BillingRecord>();

  constructor(db?: DatabasePool) {
    if (db) {
      this.repo = new BillingRepository(db);
      this.useDb = true;
    } else {
      this.repo = null;
      this.useDb = false;
    }
  }

  /**
   * Initialize the service by verifying DB connectivity.
   * No-op when running in Map()-only mode.
   */
  async init(): Promise<void> {
    if (!this.useDb || !this.repo) return;

    try {
      // Verify DB connectivity with a lightweight query
      await this.repo.findUsageByTenant('__init_probe__');
      logger.info('BillingService initialized with PostgreSQL persistence');
    } catch (err) {
      logger.error({ err }, 'Failed to initialize BillingService, falling back to in-memory');
      this.useDb = false;
      this.repo = null;
    }
  }

  // ---- Usage Metering ----

  async recordUsage(input: RecordUsageInput, tenantId: string): Promise<UsageRecord> {
    if (this.useDb && this.repo) {
      const entity = await this.repo.createUsageRecord(
        {
          service: input.service,
          metric: input.metric,
          quantity: input.quantity,
          unitPrice: input.unitPrice,
          totalCost: input.quantity * input.unitPrice,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          metadata: input.metadata,
        },
        tenantId,
      );
      return this.usageEntityToRecord(entity);
    }

    // Map() fallback
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
    this.usageRecords.set(record.id, record);
    return record;
  }

  async getUsageByTenant(tenantId: string, params?: { service?: string; periodStart?: string; periodEnd?: string }): Promise<UsageRecord[]> {
    if (this.useDb && this.repo) {
      const entities = await this.repo.findUsageByTenant(tenantId, {
        service: params?.service,
        periodStart: params?.periodStart,
        periodEnd: params?.periodEnd,
      });
      return entities.map((e) => this.usageEntityToRecord(e));
    }

    // Map() fallback
    let result = Array.from(this.usageRecords.values()).filter((r) => r.tenantId === tenantId);
    if (params?.service) result = result.filter((r) => r.service === params.service);
    if (params?.periodStart) result = result.filter((r) => r.periodStart >= params.periodStart!);
    if (params?.periodEnd) result = result.filter((r) => r.periodEnd <= params.periodEnd!);
    return result;
  }

  async getUsageSummary(tenantId: string, period: string): Promise<{ totalCost: number; byService: Record<string, number> }> {
    if (this.useDb && this.repo) {
      return this.repo.getUsageSummary(tenantId, period);
    }

    // Map() fallback
    const records = Array.from(this.usageRecords.values()).filter(
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

    if (this.useDb && this.repo) {
      const entity = await this.repo.createBillingRecord({
        tenantId,
        billingPeriod: period,
        status: 'draft',
        totalAmount: summary.totalCost,
        paidAmount: 0,
        dueDate: dueDate.toISOString().split('T')[0],
        items,
      });
      return this.billingEntityToRecord(entity);
    }

    // Map() fallback
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
    this.billingRecords.set(record.id, record);
    return record;
  }

  async getBillingRecords(tenantId: string, params?: { status?: string; period?: string }): Promise<BillingRecord[]> {
    if (this.useDb && this.repo) {
      const entities = await this.repo.findBillingRecords(tenantId, {
        status: params?.status,
        period: params?.period,
      });
      return entities.map((e) => this.billingEntityToRecord(e));
    }

    // Map() fallback
    let result = Array.from(this.billingRecords.values()).filter((r) => r.tenantId === tenantId);
    if (params?.status) result = result.filter((r) => r.status === params.status);
    if (params?.period) result = result.filter((r) => r.billingPeriod === params.period);
    return result;
  }

  async getBillingRecord(id: string): Promise<BillingRecord | undefined> {
    if (this.useDb && this.repo) {
      const entity = await this.repo.findBillingRecordById(id);
      return entity ? this.billingEntityToRecord(entity) : undefined;
    }

    // Map() fallback
    return this.billingRecords.get(id);
  }

  async markAsPaid(id: string, paidAmount?: number): Promise<BillingRecord | undefined> {
    if (this.useDb && this.repo) {
      const existing = await this.repo.findBillingRecordById(id);
      if (!existing) return undefined;

      const entity = await this.repo.updateBillingRecord(id, {
        status: 'paid',
        paidAmount: paidAmount ?? existing.totalAmount,
        paidAt: new Date().toISOString(),
      });
      return entity ? this.billingEntityToRecord(entity) : undefined;
    }

    // Map() fallback
    const record = this.billingRecords.get(id);
    if (!record) return undefined;
    record.status = 'paid';
    record.paidAmount = paidAmount ?? record.totalAmount;
    record.paidAt = new Date().toISOString();
    record.updatedAt = new Date().toISOString();
    this.billingRecords.set(id, record);
    return record;
  }

  async updateBillingStatus(id: string, status: BillingRecord['status']): Promise<BillingRecord | undefined> {
    if (this.useDb && this.repo) {
      const entity = await this.repo.updateBillingRecord(id, { status });
      return entity ? this.billingEntityToRecord(entity) : undefined;
    }

    // Map() fallback
    const record = this.billingRecords.get(id);
    if (!record) return undefined;
    record.status = status;
    record.updatedAt = new Date().toISOString();
    this.billingRecords.set(id, record);
    return record;
  }

  async getBillingSummary(tenantId: string): Promise<BillingSummary> {
    if (this.useDb && this.repo) {
      return this.repo.getBillingSummary(tenantId);
    }

    // Map() fallback
    const records = Array.from(this.billingRecords.values()).filter((r) => r.tenantId === tenantId);
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

  // ---- Entity Mappers ----

  private usageEntityToRecord(entity: { id: string; tenantId: string; service: string; metric: string; quantity: number; unitPrice: number; totalCost: number; periodStart: string; periodEnd: string; metadata: Record<string, any> }): UsageRecord {
    return {
      id: entity.id,
      tenantId: entity.tenantId,
      service: entity.service,
      metric: entity.metric,
      quantity: entity.quantity,
      unitPrice: entity.unitPrice,
      totalCost: entity.totalCost,
      periodStart: entity.periodStart,
      periodEnd: entity.periodEnd,
      metadata: entity.metadata,
    };
  }

  private billingEntityToRecord(entity: { id: string; tenantId: string; billingPeriod: string; status: string; totalAmount: number; paidAmount: number; dueDate: string | null; paidAt: Date | null; items: Record<string, any>; createdAt: Date; updatedAt: Date }): BillingRecord {
    return {
      id: entity.id,
      tenantId: entity.tenantId,
      billingPeriod: entity.billingPeriod,
      status: entity.status as BillingRecord['status'],
      totalAmount: entity.totalAmount,
      paidAmount: entity.paidAmount,
      dueDate: entity.dueDate ?? undefined,
      paidAt: entity.paidAt ? entity.paidAt.toISOString() : undefined,
      items: entity.items,
      createdAt: entity.createdAt instanceof Date ? entity.createdAt.toISOString() : entity.createdAt,
      updatedAt: entity.updatedAt instanceof Date ? entity.updatedAt.toISOString() : entity.updatedAt,
    };
  }
}
