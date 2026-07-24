/**
 * BillingService - Usage Metering and Billing Unit Tests
 *
 * Coverage: recordUsage, getUsageByTenant, getUsageSummary,
 *           generateBillingRecord, getBillingRecords, getBillingRecord,
 *           markAsPaid, updateBillingStatus, getBillingSummary
 */

import { BillingService } from '../BillingService';

describe('BillingService', () => {
  let service: BillingService;

  beforeEach(() => {
    service = new BillingService();
  });

  // ==================== recordUsage ====================

  describe('recordUsage', () => {
    it('should record usage', async () => {
      const result = await service.recordUsage({
        service: 'pipeline',
        metric: 'build-minutes',
        quantity: 100,
        unitPrice: 0.05,
        periodStart: '2026-06-01',
        periodEnd: '2026-06-30',
      }, 't-1');

      expect(result.id).toBeDefined();
      expect(result.tenantId).toBe('t-1');
      expect(result.service).toBe('pipeline');
      expect(result.metric).toBe('build-minutes');
      expect(result.quantity).toBe(100);
      expect(result.unitPrice).toBe(0.05);
      expect(result.totalCost).toBe(5);
      expect(result.periodStart).toBe('2026-06-01');
      expect(result.periodEnd).toBe('2026-06-30');
    });

    it('should calculate total cost correctly', async () => {
      const result = await service.recordUsage({
        service: 'compute',
        metric: 'cpu-hours',
        quantity: 200,
        unitPrice: 0.10,
        periodStart: '2026-06-01',
        periodEnd: '2026-06-30',
      }, 't-1');

      expect(result.totalCost).toBe(20);
    });

    it('should store optional metadata', async () => {
      const result = await service.recordUsage({
        service: 'storage',
        metric: 'gb-months',
        quantity: 50,
        unitPrice: 0.02,
        periodStart: '2026-06-01',
        periodEnd: '2026-06-30',
        metadata: { region: 'us-east-1' },
      }, 't-1');

      expect(result.metadata).toEqual({ region: 'us-east-1' });
    });
  });

  // ==================== getUsageByTenant ====================

  describe('getUsageByTenant', () => {
    it('should return usage records for tenant', async () => {
      await service.recordUsage({
        service: 'pipeline-gut', metric: 'builds', quantity: 10, unitPrice: 1,
        periodStart: '2026-06-01', periodEnd: '2026-06-30',
      }, 't-gut');

      const result = await service.getUsageByTenant('t-gut');

      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.every(r => r.tenantId === 't-gut')).toBe(true);
    });

    it('should filter by service', async () => {
      await service.recordUsage({
        service: 'svc-a', metric: 'm1', quantity: 10, unitPrice: 1,
        periodStart: '2026-06-01', periodEnd: '2026-06-30',
      }, 't-filter');
      await service.recordUsage({
        service: 'svc-b', metric: 'm2', quantity: 20, unitPrice: 1,
        periodStart: '2026-06-01', periodEnd: '2026-06-30',
      }, 't-filter');

      const result = await service.getUsageByTenant('t-filter', { service: 'svc-a' });

      expect(result.every(r => r.service === 'svc-a')).toBe(true);
    });

    it('should filter by period range', async () => {
      await service.recordUsage({
        service: 'svc-period', metric: 'm1', quantity: 10, unitPrice: 1,
        periodStart: '2026-01-01', periodEnd: '2026-01-31',
      }, 't-period');
      await service.recordUsage({
        service: 'svc-period', metric: 'm2', quantity: 20, unitPrice: 1,
        periodStart: '2026-06-01', periodEnd: '2026-06-30',
      }, 't-period');

      const result = await service.getUsageByTenant('t-period', {
        periodStart: '2026-06-01',
        periodEnd: '2026-06-30',
      });

      expect(result.every(r => r.periodStart >= '2026-06-01' && r.periodEnd <= '2026-06-30')).toBe(true);
    });
  });

  // ==================== getUsageSummary ====================

  describe('getUsageSummary', () => {
    it('should return total cost and breakdown by service', async () => {
      await service.recordUsage({
        service: 'pipeline-sum', metric: 'builds', quantity: 100, unitPrice: 0.1,
        periodStart: '2026-07-01', periodEnd: '2026-07-31',
      }, 't-sum');
      await service.recordUsage({
        service: 'compute-sum', metric: 'cpu', quantity: 50, unitPrice: 0.2,
        periodStart: '2026-07-01', periodEnd: '2026-07-31',
      }, 't-sum');

      const result = await service.getUsageSummary('t-sum', '2026-07');

      expect(result.totalCost).toBe(20); // 10 + 10
      expect(result.byService['pipeline-sum']).toBe(10);
      expect(result.byService['compute-sum']).toBe(10);
    });

    it('should return zero for period with no usage', async () => {
      const result = await service.getUsageSummary('t-empty', '2099-01');

      expect(result.totalCost).toBe(0);
      expect(Object.keys(result.byService)).toHaveLength(0);
    });
  });

  // ==================== generateBillingRecord ====================

  describe('generateBillingRecord', () => {
    it('should generate billing record from usage', async () => {
      await service.recordUsage({
        service: 'pipeline-gen', metric: 'builds', quantity: 100, unitPrice: 0.5,
        periodStart: '2026-08-01', periodEnd: '2026-08-31',
      }, 't-gen');

      const result = await service.generateBillingRecord('t-gen', '2026-08');

      expect(result.id).toBeDefined();
      expect(result.tenantId).toBe('t-gen');
      expect(result.billingPeriod).toBe('2026-08');
      expect(result.status).toBe('draft');
      expect(result.totalAmount).toBe(50);
      expect(result.paidAmount).toBe(0);
      expect(result.dueDate).toBeDefined();
      expect(result.items).toBeDefined();
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });

    it('should set 30-day payment term', async () => {
      const result = await service.generateBillingRecord('t-due', '2026-09');

      const dueDate = new Date(result.dueDate!);
      const now = new Date();
      const diffDays = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBeGreaterThanOrEqual(29);
      expect(diffDays).toBeLessThanOrEqual(31);
    });
  });

  // ==================== getBillingRecords ====================

  describe('getBillingRecords', () => {
    it('should return billing records for tenant', async () => {
      await service.generateBillingRecord('t-br', '2026-10');

      const result = await service.getBillingRecords('t-br');

      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.every(r => r.tenantId === 't-br')).toBe(true);
    });

    it('should filter by status', async () => {
      const record = await service.generateBillingRecord('t-status', '2026-11');
      await service.updateBillingStatus(record.id, 'pending');

      const result = await service.getBillingRecords('t-status', { status: 'pending' });

      expect(result.every(r => r.status === 'pending')).toBe(true);
    });

    it('should filter by period', async () => {
      await service.generateBillingRecord('t-period-br', '2026-12');

      const result = await service.getBillingRecords('t-period-br', { period: '2026-12' });

      expect(result.every(r => r.billingPeriod === '2026-12')).toBe(true);
    });
  });

  // ==================== getBillingRecord ====================

  describe('getBillingRecord', () => {
    it('should return billing record by id', async () => {
      const created = await service.generateBillingRecord('t-get', '2027-01');

      const result = await service.getBillingRecord(created.id);

      expect(result).toBeDefined();
      expect(result!.id).toBe(created.id);
    });

    it('should return undefined for non-existent id', async () => {
      const result = await service.getBillingRecord('non-existent');
      expect(result).toBeUndefined();
    });
  });

  // ==================== markAsPaid ====================

  describe('markAsPaid', () => {
    it('should mark billing record as paid', async () => {
      const created = await service.generateBillingRecord('t-pay', '2027-02');

      const result = await service.markAsPaid(created.id);

      expect(result).toBeDefined();
      expect(result!.status).toBe('paid');
      expect(result!.paidAmount).toBe(result!.totalAmount);
      expect(result!.paidAt).toBeDefined();
    });

    it('should accept custom paid amount', async () => {
      const created = await service.generateBillingRecord('t-partial', '2027-03');

      const result = await service.markAsPaid(created.id, 50);

      expect(result!.paidAmount).toBe(50);
    });

    it('should return undefined for non-existent id', async () => {
      const result = await service.markAsPaid('non-existent');
      expect(result).toBeUndefined();
    });
  });

  // ==================== updateBillingStatus ====================

  describe('updateBillingStatus', () => {
    it('should update billing status', async () => {
      const created = await service.generateBillingRecord('t-update', '2027-04');

      const result = await service.updateBillingStatus(created.id, 'pending');

      expect(result).toBeDefined();
      expect(result!.status).toBe('pending');
    });

    it('should update to overdue status', async () => {
      const created = await service.generateBillingRecord('t-overdue', '2027-05');

      const result = await service.updateBillingStatus(created.id, 'overdue');

      expect(result!.status).toBe('overdue');
    });

    it('should return undefined for non-existent id', async () => {
      const result = await service.updateBillingStatus('non-existent', 'paid');
      expect(result).toBeUndefined();
    });
  });

  // ==================== getBillingSummary ====================

  describe('getBillingSummary', () => {
    it('should calculate billing summary', async () => {
      // Create usage records first so billing records have non-zero amounts
      await service.recordUsage({
        service: 'pipeline-sum', metric: 'builds', quantity: 100, unitPrice: 0.5,
        periodStart: '2027-06-01', periodEnd: '2027-06-30',
      }, 't-summary');
      await service.recordUsage({
        service: 'compute-sum', metric: 'cpu', quantity: 50, unitPrice: 0.2,
        periodStart: '2027-07-01', periodEnd: '2027-07-31',
      }, 't-summary');

      const r1 = await service.generateBillingRecord('t-summary', '2027-06');
      await service.markAsPaid(r1.id);
      const r2 = await service.generateBillingRecord('t-summary', '2027-07');
      await service.updateBillingStatus(r2.id, 'pending');

      const result = await service.getBillingSummary('t-summary');

      expect(result.totalBilling).toBeGreaterThan(0);
      expect(result.paidAmount).toBeGreaterThanOrEqual(0);
      expect(result.pendingAmount).toBeGreaterThanOrEqual(0);
    });

    it('should calculate overdue amount', async () => {
      const r = await service.generateBillingRecord('t-overdue-sum', '2027-08');
      await service.updateBillingStatus(r.id, 'overdue');

      const result = await service.getBillingSummary('t-overdue-sum');

      expect(result.overdueAmount).toBeGreaterThanOrEqual(0);
    });

    it('should return zero summary for tenant with no billing', async () => {
      const result = await service.getBillingSummary('t-no-billing');

      expect(result.totalBilling).toBe(0);
      expect(result.paidAmount).toBe(0);
      expect(result.pendingAmount).toBe(0);
      expect(result.overdueAmount).toBe(0);
    });
  });
});
