/**
 * BillingService - Usage Metering Tests
 * Covers: recordUsage, getUsageByTenant, getUsageSummary
 */

import type { RecordUsageInput } from '../BillingService';

describe('BillingService - Usage Metering', () => {
  let BillingService: typeof import('../BillingService').BillingService;

  beforeEach(() => {
    jest.resetModules();
    // Re-import to get a fresh module with clean Maps
    BillingService = require('../BillingService').BillingService;
  });

  // =========================================================================
  // recordUsage
  // =========================================================================
  describe('recordUsage', () => {
    it('should create a usage record with calculated totalCost', async () => {
      const svc = new BillingService();
      const input: RecordUsageInput = {
        service: 'pipeline',
        metric: 'build-minutes',
        quantity: 100,
        unitPrice: 0.5,
        periodStart: '2026-05-01',
        periodEnd: '2026-05-31',
      };

      const result = await svc.recordUsage(input, 'tenant-1');

      expect(result.id).toBeDefined();
      expect(result.tenantId).toBe('tenant-1');
      expect(result.service).toBe('pipeline');
      expect(result.metric).toBe('build-minutes');
      expect(result.quantity).toBe(100);
      expect(result.unitPrice).toBe(0.5);
      expect(result.totalCost).toBe(50);
      expect(result.periodStart).toBe('2026-05-01');
      expect(result.periodEnd).toBe('2026-05-31');
    });

    it('should include metadata when provided', async () => {
      const svc = new BillingService();
      const input: RecordUsageInput = {
        service: 'ai',
        metric: 'llm-tokens',
        quantity: 10000,
        unitPrice: 0.01,
        periodStart: '2026-05-01',
        periodEnd: '2026-05-31',
        metadata: { model: 'gpt-4', region: 'us-east-1' },
      };

      const result = await svc.recordUsage(input, 'tenant-2');

      expect(result.metadata).toEqual({ model: 'gpt-4', region: 'us-east-1' });
    });

    it('should handle undefined metadata gracefully', async () => {
      const svc = new BillingService();
      const input: RecordUsageInput = {
        service: 'storage',
        metric: 'gb-hours',
        quantity: 50,
        unitPrice: 0.1,
        periodStart: '2026-05-01',
        periodEnd: '2026-05-31',
      };

      const result = await svc.recordUsage(input, 'tenant-1');

      expect(result.metadata).toBeUndefined();
    });

    it('should generate unique IDs for different records', async () => {
      const svc = new BillingService();
      const input: RecordUsageInput = {
        service: 'pipeline',
        metric: 'build-minutes',
        quantity: 10,
        unitPrice: 1,
        periodStart: '2026-05-01',
        periodEnd: '2026-05-31',
      };

      const r1 = await svc.recordUsage(input, 'tenant-1');
      const r2 = await svc.recordUsage(input, 'tenant-1');

      expect(r1.id).not.toBe(r2.id);
    });

    it('should calculate totalCost correctly for fractional unitPrice', async () => {
      const svc = new BillingService();
      const input: RecordUsageInput = {
        service: 'storage',
        metric: 'gb-hours',
        quantity: 333,
        unitPrice: 0.003,
        periodStart: '2026-05-01',
        periodEnd: '2026-05-31',
      };

      const result = await svc.recordUsage(input, 'tenant-1');

      expect(result.totalCost).toBeCloseTo(0.999, 5);
    });

    it('should handle zero quantity', async () => {
      const svc = new BillingService();
      const input: RecordUsageInput = {
        service: 'pipeline',
        metric: 'build-minutes',
        quantity: 0,
        unitPrice: 0.5,
        periodStart: '2026-05-01',
        periodEnd: '2026-05-31',
      };

      const result = await svc.recordUsage(input, 'tenant-1');

      expect(result.totalCost).toBe(0);
      expect(result.quantity).toBe(0);
    });

    it('should isolate records between tenants', async () => {
      const svc = new BillingService();
      const input: RecordUsageInput = {
        service: 'pipeline',
        metric: 'builds',
        quantity: 10,
        unitPrice: 1,
        periodStart: '2026-05-01',
        periodEnd: '2026-05-31',
      };

      await svc.recordUsage(input, 'tenant-a');
      await svc.recordUsage(input, 'tenant-b');

      const aRecords = await svc.getUsageByTenant('tenant-a');
      const bRecords = await svc.getUsageByTenant('tenant-b');

      expect(aRecords).toHaveLength(1);
      expect(bRecords).toHaveLength(1);
      expect(aRecords[0].tenantId).toBe('tenant-a');
      expect(bRecords[0].tenantId).toBe('tenant-b');
    });
  });

  // =========================================================================
  // getUsageByTenant
  // =========================================================================
  describe('getUsageByTenant', () => {
    async function seedRecords(svc: InstanceType<typeof BillingService>) {
      const inputs: Array<RecordUsageInput & { tenantId: string }> = [
        { service: 'pipeline', metric: 'builds', quantity: 10, unitPrice: 1, periodStart: '2026-05-01', periodEnd: '2026-05-31', tenantId: 't1' },
        { service: 'pipeline', metric: 'minutes', quantity: 50, unitPrice: 0.5, periodStart: '2026-04-01', periodEnd: '2026-04-30', tenantId: 't1' },
        { service: 'ai', metric: 'tokens', quantity: 1000, unitPrice: 0.01, periodStart: '2026-05-01', periodEnd: '2026-05-31', tenantId: 't1' },
        { service: 'pipeline', metric: 'builds', quantity: 5, unitPrice: 1, periodStart: '2026-05-01', periodEnd: '2026-05-31', tenantId: 't2' },
      ];
      for (const inp of inputs) {
        const { tenantId, ...input } = inp;
        await svc.recordUsage(input, tenantId);
      }
    }

    it('should return all records for a tenant without filters', async () => {
      const svc = new BillingService();
      await seedRecords(svc);

      const result = await svc.getUsageByTenant('t1');

      expect(result).toHaveLength(3);
      result.forEach((r) => expect(r.tenantId).toBe('t1'));
    });

    it('should return empty array for non-existent tenant', async () => {
      const svc = new BillingService();
      await seedRecords(svc);

      const result = await svc.getUsageByTenant('non-existent');

      expect(result).toEqual([]);
    });

    it('should filter by service', async () => {
      const svc = new BillingService();
      await seedRecords(svc);

      const result = await svc.getUsageByTenant('t1', { service: 'ai' });

      expect(result).toHaveLength(1);
      expect(result[0].service).toBe('ai');
    });

    it('should filter by periodStart', async () => {
      const svc = new BillingService();
      await seedRecords(svc);

      const result = await svc.getUsageByTenant('t1', { periodStart: '2026-05-01' });

      expect(result).toHaveLength(2);
      result.forEach((r) => expect(r.periodStart >= '2026-05-01').toBe(true));
    });

    it('should filter by periodEnd', async () => {
      const svc = new BillingService();
      await seedRecords(svc);

      const result = await svc.getUsageByTenant('t1', { periodEnd: '2026-04-30' });

      expect(result).toHaveLength(1);
      expect(result[0].periodEnd).toBe('2026-04-30');
    });

    it('should combine service and period filters', async () => {
      const svc = new BillingService();
      await seedRecords(svc);

      const result = await svc.getUsageByTenant('t1', {
        service: 'pipeline',
        periodStart: '2026-05-01',
      });

      expect(result).toHaveLength(1);
      expect(result[0].service).toBe('pipeline');
      expect(result[0].periodStart).toBe('2026-05-01');
    });

    it('should return empty array when no records match all filters', async () => {
      const svc = new BillingService();
      await seedRecords(svc);

      const result = await svc.getUsageByTenant('t1', {
        service: 'storage',
        periodStart: '2026-06-01',
      });

      expect(result).toEqual([]);
    });
  });

  // =========================================================================
  // getUsageSummary
  // =========================================================================
  describe('getUsageSummary', () => {
    it('should aggregate costs by service for a given period prefix', async () => {
      const svc = new BillingService();
      await svc.recordUsage(
        { service: 'pipeline', metric: 'builds', quantity: 10, unitPrice: 2, periodStart: '2026-05-01', periodEnd: '2026-05-31' },
        't1'
      );
      await svc.recordUsage(
        { service: 'ai', metric: 'tokens', quantity: 1000, unitPrice: 0.01, periodStart: '2026-05-01', periodEnd: '2026-05-31' },
        't1'
      );
      await svc.recordUsage(
        { service: 'pipeline', metric: 'minutes', quantity: 50, unitPrice: 0.5, periodStart: '2026-05-01', periodEnd: '2026-05-31' },
        't1'
      );

      const summary = await svc.getUsageSummary('t1', '2026-05');

      expect(summary.totalCost).toBe(20 + 10 + 25);
      expect(summary.byService['pipeline']).toBe(45);
      expect(summary.byService['ai']).toBe(10);
    });

    it('should return zero costs when no records match period', async () => {
      const svc = new BillingService();
      await svc.recordUsage(
        { service: 'pipeline', metric: 'builds', quantity: 10, unitPrice: 2, periodStart: '2026-04-01', periodEnd: '2026-04-30' },
        't1'
      );

      const summary = await svc.getUsageSummary('t1', '2026-05');

      expect(summary.totalCost).toBe(0);
      expect(summary.byService).toEqual({});
    });

    it('should return zero costs for non-existent tenant', async () => {
      const svc = new BillingService();

      const summary = await svc.getUsageSummary('ghost-tenant', '2026-05');

      expect(summary.totalCost).toBe(0);
      expect(summary.byService).toEqual({});
    });

    it('should exclude records from other tenants', async () => {
      const svc = new BillingService();
      await svc.recordUsage(
        { service: 'pipeline', metric: 'builds', quantity: 10, unitPrice: 2, periodStart: '2026-05-01', periodEnd: '2026-05-31' },
        't1'
      );
      await svc.recordUsage(
        { service: 'pipeline', metric: 'builds', quantity: 100, unitPrice: 2, periodStart: '2026-05-01', periodEnd: '2026-05-31' },
        't2'
      );

      const summary = await svc.getUsageSummary('t1', '2026-05');

      expect(summary.totalCost).toBe(20);
    });

    it('should handle empty period prefix gracefully', async () => {
      const svc = new BillingService();
      await svc.recordUsage(
        { service: 'pipeline', metric: 'builds', quantity: 10, unitPrice: 1, periodStart: '2026-05-01', periodEnd: '2026-05-31' },
        't1'
      );

      // Empty prefix matches all records via startsWith('')
      const summary = await svc.getUsageSummary('t1', '');

      expect(summary.totalCost).toBe(10);
    });
  });
});
