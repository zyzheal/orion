/**
 * BillingService - Billing Records Tests
 * Covers: generateBillingRecord, getBillingRecords, getBillingRecord,
 *         markAsPaid, updateBillingStatus, getBillingSummary
 */

import type { RecordUsageInput, BillingRecord } from '../BillingService';

describe('BillingService - Billing Records', () => {
  let BillingService: typeof import('../BillingService').BillingService;

  beforeEach(() => {
    jest.resetModules();
    BillingService = require('../BillingService').BillingService;
  });

  // Helper: seed usage data for billing generation
  async function seedUsage(svc: InstanceType<typeof BillingService>, tenantId: string, period: string) {
    const inputs: RecordUsageInput[] = [
      { service: 'pipeline', metric: 'builds', quantity: 20, unitPrice: 1.5, periodStart: `${period}-01`, periodEnd: `${period}-31` },
      { service: 'ai', metric: 'tokens', quantity: 5000, unitPrice: 0.02, periodStart: `${period}-01`, periodEnd: `${period}-31` },
    ];
    for (const input of inputs) {
      await svc.recordUsage(input, tenantId);
    }
  }

  // =========================================================================
  // generateBillingRecord
  // =========================================================================
  describe('generateBillingRecord', () => {
    it('should generate a billing record from usage data', async () => {
      const svc = new BillingService();
      await seedUsage(svc, 'tenant-1', '2026-05');

      const record = await svc.generateBillingRecord('tenant-1', '2026-05');

      expect(record.id).toBeDefined();
      expect(record.tenantId).toBe('tenant-1');
      expect(record.billingPeriod).toBe('2026-05');
      expect(record.status).toBe('draft');
      expect(record.totalAmount).toBe(30 + 100); // pipeline + ai
      expect(record.paidAmount).toBe(0);
      expect(record.dueDate).toBeDefined();
      expect(record.items).toBeDefined();
      expect(Array.isArray(record.items)).toBe(true);
    });

    it('should set dueDate 30 days in the future', async () => {
      const svc = new BillingService();
      await seedUsage(svc, 'tenant-1', '2026-05');

      const now = new Date();
      const expectedDue = new Date(now);
      expectedDue.setDate(expectedDue.getDate() + 30);
      const expectedDueStr = expectedDue.toISOString().split('T')[0];

      const record = await svc.generateBillingRecord('tenant-1', '2026-05');

      // Allow +/- 1 day for test execution edge cases
      const dueDate = new Date(record.dueDate!);
      const diff = Math.abs(dueDate.getTime() - expectedDue.getTime());
      expect(diff).toBeLessThan(2 * 24 * 60 * 60 * 1000); // within 2 days
    });

    it('should create billing items per service', async () => {
      const svc = new BillingService();
      await seedUsage(svc, 'tenant-1', '2026-05');

      const record = await svc.generateBillingRecord('tenant-1', '2026-05');
      const items = record.items as Array<{ service: string; amount: number }>;

      expect(items).toHaveLength(2);
      const pipelineItem = items.find((i) => i.service === 'pipeline');
      const aiItem = items.find((i) => i.service === 'ai');
      expect(pipelineItem?.amount).toBe(30);
      expect(aiItem?.amount).toBe(100);
    });

    it('should generate a zero-amount billing record when no usage exists', async () => {
      const svc = new BillingService();

      const record = await svc.generateBillingRecord('tenant-1', '2099-01');

      expect(record.totalAmount).toBe(0);
      expect(record.items).toEqual([]);
      expect(record.status).toBe('draft');
    });

    it('should set createdAt and updatedAt timestamps', async () => {
      const svc = new BillingService();
      const before = new Date().toISOString();

      const record = await svc.generateBillingRecord('tenant-1', '2026-05');

      const after = new Date().toISOString();
      expect(record.createdAt >= before).toBe(true);
      expect(record.createdAt <= after).toBe(true);
      expect(record.updatedAt >= before).toBe(true);
      expect(record.updatedAt <= after).toBe(true);
    });

    it('should generate unique IDs for multiple records', async () => {
      const svc = new BillingService();

      const r1 = await svc.generateBillingRecord('tenant-1', '2026-05');
      const r2 = await svc.generateBillingRecord('tenant-1', '2026-06');

      expect(r1.id).not.toBe(r2.id);
    });
  });

  // =========================================================================
  // getBillingRecords
  // =========================================================================
  describe('getBillingRecords', () => {
    async function seedBillingRecords(svc: InstanceType<typeof BillingService>) {
      // Generate records for different tenants and periods
      await svc.generateBillingRecord('t1', '2026-04');
      await svc.generateBillingRecord('t1', '2026-05');
      await svc.generateBillingRecord('t2', '2026-05');
    }

    it('should return all billing records for a tenant', async () => {
      const svc = new BillingService();
      await seedBillingRecords(svc);

      const result = await svc.getBillingRecords('t1');

      expect(result).toHaveLength(2);
      result.forEach((r) => expect(r.tenantId).toBe('t1'));
    });

    it('should return empty array for non-existent tenant', async () => {
      const svc = new BillingService();
      await seedBillingRecords(svc);

      const result = await svc.getBillingRecords('ghost');

      expect(result).toEqual([]);
    });

    it('should filter by status', async () => {
      const svc = new BillingService();
      await seedBillingRecords(svc);
      // Update one record status
      const all = await svc.getBillingRecords('t1');
      await svc.updateBillingStatus(all[0].id, 'pending');

      const result = await svc.getBillingRecords('t1', { status: 'pending' });

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('pending');
    });

    it('should filter by period', async () => {
      const svc = new BillingService();
      await seedBillingRecords(svc);

      const result = await svc.getBillingRecords('t1', { period: '2026-05' });

      expect(result).toHaveLength(1);
      expect(result[0].billingPeriod).toBe('2026-05');
    });

    it('should combine status and period filters', async () => {
      const svc = new BillingService();
      await seedBillingRecords(svc);
      const all = await svc.getBillingRecords('t1');
      await svc.updateBillingStatus(all[0].id, 'paid');

      const result = await svc.getBillingRecords('t1', { status: 'paid', period: all[0].billingPeriod });

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('paid');
    });

    it('should return empty when filters exclude all records', async () => {
      const svc = new BillingService();
      await seedBillingRecords(svc);

      const result = await svc.getBillingRecords('t1', { status: 'paid' });

      expect(result).toEqual([]);
    });
  });

  // =========================================================================
  // getBillingRecord (single)
  // =========================================================================
  describe('getBillingRecord', () => {
    it('should return a billing record by ID', async () => {
      const svc = new BillingService();
      const created = await svc.generateBillingRecord('t1', '2026-05');

      const result = await svc.getBillingRecord(created.id);

      expect(result).toBeDefined();
      expect(result!.id).toBe(created.id);
      expect(result!.tenantId).toBe('t1');
    });

    it('should return undefined for non-existent ID', async () => {
      const svc = new BillingService();

      const result = await svc.getBillingRecord('non-existent-id');

      expect(result).toBeUndefined();
    });

    it('should return the same object reference (no cloning)', async () => {
      const svc = new BillingService();
      const created = await svc.generateBillingRecord('t1', '2026-05');

      const result = await svc.getBillingRecord(created.id);

      // In-memory Map returns the same reference
      expect(result).toBe(created);
    });
  });

  // =========================================================================
  // markAsPaid
  // =========================================================================
  describe('markAsPaid', () => {
    it('should mark record as paid with full amount when paidAmount not specified', async () => {
      const svc = new BillingService();
      const created = await svc.generateBillingRecord('t1', '2026-05');

      const result = await svc.markAsPaid(created.id);

      expect(result).toBeDefined();
      expect(result!.status).toBe('paid');
      expect(result!.paidAmount).toBe(result!.totalAmount);
      expect(result!.paidAt).toBeDefined();
    });

    it('should mark record as paid with custom paidAmount', async () => {
      const svc = new BillingService();
      const created = await svc.generateBillingRecord('t1', '2026-05');

      const result = await svc.markAsPaid(created.id, 50);

      expect(result!.status).toBe('paid');
      expect(result!.paidAmount).toBe(50);
    });

    it('should update updatedAt when marking as paid', async () => {
      const svc = new BillingService();
      const created = await svc.generateBillingRecord('t1', '2026-05');
      const originalUpdatedAt = created.updatedAt;

      // Small delay to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      const result = await svc.markAsPaid(created.id);

      expect(result!.updatedAt >= originalUpdatedAt).toBe(true);
    });

    it('should set paidAt to current ISO timestamp', async () => {
      const svc = new BillingService();
      const before = new Date().toISOString();
      const created = await svc.generateBillingRecord('t1', '2026-05');

      const result = await svc.markAsPaid(created.id);

      const after = new Date().toISOString();
      expect(result!.paidAt).toBeDefined();
      expect(result!.paidAt! >= before).toBe(true);
      expect(result!.paidAt! <= after).toBe(true);
    });

    it('should return undefined for non-existent record', async () => {
      const svc = new BillingService();

      const result = await svc.markAsPaid('fake-id');

      expect(result).toBeUndefined();
    });

    it('should persist changes and be retrievable via getBillingRecord', async () => {
      const svc = new BillingService();
      const created = await svc.generateBillingRecord('t1', '2026-05');

      await svc.markAsPaid(created.id, 42);
      const retrieved = await svc.getBillingRecord(created.id);

      expect(retrieved!.status).toBe('paid');
      expect(retrieved!.paidAmount).toBe(42);
    });

    it('should handle zero paidAmount', async () => {
      const svc = new BillingService();
      const created = await svc.generateBillingRecord('t1', '2026-05');

      const result = await svc.markAsPaid(created.id, 0);

      expect(result!.paidAmount).toBe(0);
      expect(result!.status).toBe('paid');
    });
  });

  // =========================================================================
  // updateBillingStatus
  // =========================================================================
  describe('updateBillingStatus', () => {
    it('should update status to pending', async () => {
      const svc = new BillingService();
      const created = await svc.generateBillingRecord('t1', '2026-05');

      const result = await svc.updateBillingStatus(created.id, 'pending');

      expect(result).toBeDefined();
      expect(result!.status).toBe('pending');
    });

    it('should update status to overdue', async () => {
      const svc = new BillingService();
      const created = await svc.generateBillingRecord('t1', '2026-05');

      const result = await svc.updateBillingStatus(created.id, 'overdue');

      expect(result!.status).toBe('overdue');
    });

    it('should update status to cancelled', async () => {
      const svc = new BillingService();
      const created = await svc.generateBillingRecord('t1', '2026-05');

      const result = await svc.updateBillingStatus(created.id, 'cancelled');

      expect(result!.status).toBe('cancelled');
    });

    it('should update updatedAt timestamp', async () => {
      const svc = new BillingService();
      const created = await svc.generateBillingRecord('t1', '2026-05');
      const originalUpdatedAt = created.updatedAt;

      await new Promise((resolve) => setTimeout(resolve, 10));
      const result = await svc.updateBillingStatus(created.id, 'pending');

      expect(result!.updatedAt >= originalUpdatedAt).toBe(true);
    });

    it('should return undefined for non-existent record', async () => {
      const svc = new BillingService();

      const result = await svc.updateBillingStatus('ghost-id', 'pending');

      expect(result).toBeUndefined();
    });

    it('should allow transitioning through all status values', async () => {
      const svc = new BillingService();
      const created = await svc.generateBillingRecord('t1', '2026-05');
      const statuses: BillingRecord['status'][] = ['pending', 'paid', 'overdue', 'cancelled', 'draft'];

      for (const status of statuses) {
        const result = await svc.updateBillingStatus(created.id, status);
        expect(result!.status).toBe(status);
      }
    });

    it('should persist status changes across getBillingRecord calls', async () => {
      const svc = new BillingService();
      const created = await svc.generateBillingRecord('t1', '2026-05');

      await svc.updateBillingStatus(created.id, 'overdue');
      const retrieved = await svc.getBillingRecord(created.id);

      expect(retrieved!.status).toBe('overdue');
    });
  });

  // =========================================================================
  // getBillingSummary
  // =========================================================================
  describe('getBillingSummary', () => {
    it('should compute summary with mixed statuses', async () => {
      const svc = new BillingService();

      // Create 3 billing records with different statuses
      const r1 = await svc.generateBillingRecord('t1', '2026-04');
      const r2 = await svc.generateBillingRecord('t1', '2026-05');
      const r3 = await svc.generateBillingRecord('t1', '2026-06');

      await svc.markAsPaid(r1.id);
      await svc.updateBillingStatus(r2.id, 'pending');
      await svc.updateBillingStatus(r3.id, 'overdue');

      const summary = await svc.getBillingSummary('t1');

      expect(summary.totalBilling).toBe(r1.totalAmount + r2.totalAmount + r3.totalAmount);
      expect(summary.paidAmount).toBe(r1.totalAmount);
      expect(summary.pendingAmount).toBe(r2.totalAmount - 0); // paidAmount is 0
      expect(summary.overdueAmount).toBe(r3.totalAmount - 0);
    });

    it('should return all zeros for tenant with no billing records', async () => {
      const svc = new BillingService();

      const summary = await svc.getBillingSummary('non-existent');

      expect(summary.totalBilling).toBe(0);
      expect(summary.paidAmount).toBe(0);
      expect(summary.pendingAmount).toBe(0);
      expect(summary.overdueAmount).toBe(0);
      expect(summary.currentMonthCost).toBe(0);
    });

    it('should only count paidAmount for paid records', async () => {
      const svc = new BillingService();
      const r1 = await svc.generateBillingRecord('t1', '2026-05');
      await svc.markAsPaid(r1.id, 50); // partial payment

      const summary = await svc.getBillingSummary('t1');

      expect(summary.paidAmount).toBe(50);
    });

    it('should calculate pendingAmount as totalAmount minus paidAmount', async () => {
      const svc = new BillingService();
      const r1 = await svc.generateBillingRecord('t1', '2026-05');
      await svc.updateBillingStatus(r1.id, 'pending');
      // r1.paidAmount is 0, so pendingAmount = totalAmount - 0

      const summary = await svc.getBillingSummary('t1');

      expect(summary.pendingAmount).toBe(r1.totalAmount);
    });

    it('should calculate overdueAmount as totalAmount minus paidAmount', async () => {
      const svc = new BillingService();
      const r1 = await svc.generateBillingRecord('t1', '2026-05');
      await svc.updateBillingStatus(r1.id, 'overdue');

      const summary = await svc.getBillingSummary('t1');

      expect(summary.overdueAmount).toBe(r1.totalAmount);
    });

    it('should always return currentMonthCost as 0', async () => {
      const svc = new BillingService();
      await svc.generateBillingRecord('t1', '2026-05');

      const summary = await svc.getBillingSummary('t1');

      // currentMonthCost is hardcoded to 0 in the implementation
      expect(summary.currentMonthCost).toBe(0);
    });

    it('should isolate summary between tenants', async () => {
      const svc = new BillingService();
      const r1 = await svc.generateBillingRecord('t1', '2026-05');
      const r2 = await svc.generateBillingRecord('t2', '2026-05');
      await svc.markAsPaid(r1.id);
      await svc.updateBillingStatus(r2.id, 'overdue');

      const s1 = await svc.getBillingSummary('t1');
      const s2 = await svc.getBillingSummary('t2');

      expect(s1.paidAmount).toBe(r1.totalAmount);
      expect(s1.overdueAmount).toBe(0);
      expect(s2.paidAmount).toBe(0);
      expect(s2.overdueAmount).toBe(r2.totalAmount);
    });

    it('should handle draft and cancelled statuses as neutral (not counted)', async () => {
      const svc = new BillingService();
      const r1 = await svc.generateBillingRecord('t1', '2026-04');
      const r2 = await svc.generateBillingRecord('t1', '2026-05');
      // r1 stays draft
      await svc.updateBillingStatus(r2.id, 'cancelled');

      const summary = await svc.getBillingSummary('t1');

      // draft and cancelled don't contribute to paid/pending/overdue
      expect(summary.paidAmount).toBe(0);
      expect(summary.pendingAmount).toBe(0);
      expect(summary.overdueAmount).toBe(0);
      // totalBilling still sums all records regardless of status
      expect(summary.totalBilling).toBe(r1.totalAmount + r2.totalAmount);
    });
  });

  // =========================================================================
  // Cross-method integration
  // =========================================================================
  describe('Cross-method integration', () => {
    it('should generate billing from usage and then mark as paid end-to-end', async () => {
      const svc = new BillingService();

      // 1. Record usage
      await svc.recordUsage(
        { service: 'pipeline', metric: 'builds', quantity: 100, unitPrice: 1, periodStart: '2026-05-01', periodEnd: '2026-05-31' },
        'tenant-e2e'
      );
      await svc.recordUsage(
        { service: 'storage', metric: 'gb', quantity: 500, unitPrice: 0.2, periodStart: '2026-05-01', periodEnd: '2026-05-31' },
        'tenant-e2e'
      );

      // 2. Generate billing
      const billing = await svc.generateBillingRecord('tenant-e2e', '2026-05');
      expect(billing.totalAmount).toBe(100 + 100); // pipeline + storage

      // 3. Submit for payment
      const submitted = await svc.updateBillingStatus(billing.id, 'pending');
      expect(submitted!.status).toBe('pending');

      // 4. Mark as paid
      const paid = await svc.markAsPaid(billing.id, 180); // partial payment
      expect(paid!.status).toBe('paid');
      expect(paid!.paidAmount).toBe(180);

      // 5. Verify summary
      const summary = await svc.getBillingSummary('tenant-e2e');
      expect(summary.totalBilling).toBe(200);
      expect(summary.paidAmount).toBe(180);
      expect(summary.pendingAmount).toBe(0);
      expect(summary.overdueAmount).toBe(0);
    });

    it('should support multiple billing periods for same tenant', async () => {
      const svc = new BillingService();

      // Record usage for two months
      await svc.recordUsage(
        { service: 'pipeline', metric: 'builds', quantity: 10, unitPrice: 1, periodStart: '2026-04-01', periodEnd: '2026-04-30' },
        't-multi'
      );
      await svc.recordUsage(
        { service: 'pipeline', metric: 'builds', quantity: 20, unitPrice: 1, periodStart: '2026-05-01', periodEnd: '2026-05-31' },
        't-multi'
      );

      const b1 = await svc.generateBillingRecord('t-multi', '2026-04');
      const b2 = await svc.generateBillingRecord('t-multi', '2026-05');

      expect(b1.totalAmount).toBe(10);
      expect(b2.totalAmount).toBe(20);

      const records = await svc.getBillingRecords('t-multi');
      expect(records).toHaveLength(2);
    });
  });
});
