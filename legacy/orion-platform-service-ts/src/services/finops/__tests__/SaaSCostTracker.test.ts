/**
 * SaaSCostTracker 单元测试
 */

import { SaaSCostTracker } from '../SaaSCostTracker';

/** Convert camelCase to snake_case */
function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

function createMockDb() {
  const store: Record<string, any[]> = {};
  let idCounter = 0;

  const db = {
    query: jest.fn(async (text: string, params?: any[]) => {
      // CREATE
      if (text.includes('INSERT INTO')) {
        const table = text.match(/INSERT INTO (\w+)/)?.[1] || 'unknown';
        if (!store[table]) store[table] = [];
        const row: any = {};
        if (params) {
          const cols = text.match(/\(([^)]+)\)\s+VALUES/)?.[1]?.split(',').map(c => c.trim()) || [];
          cols.forEach((col, i) => { row[toSnakeCase(col)] = params[i]; });
        }
        if (!row.id) row.id = `mock-${++idCounter}`;
        if (!row.created_at) row.created_at = new Date();
        if (!row.updated_at) row.updated_at = new Date();
        store[table].push(row);
        return { rows: [row], rowCount: 1 };
      }
      // SELECT COUNT
      if (text.includes('COUNT(*)')) {
        const table = text.match(/FROM (\w+)/)?.[1] || 'unknown';
        return { rows: [{ count: String((store[table] || []).length) }], rowCount: 1 };
      }
      // SELECT by id
      if (text.includes('WHERE id = $1')) {
        const table = text.match(/FROM (\w+)/)?.[1] || 'unknown';
        const rows = (store[table] || []).filter(r => r.id === params?.[0]);
        return { rows, rowCount: rows.length };
      }
      // SELECT by tool
      if (text.includes('WHERE tool = $1')) {
        const table = text.match(/FROM (\w+)/)?.[1] || 'unknown';
        const rows = (store[table] || []).filter(r => r.tool === params?.[0]);
        return { rows, rowCount: rows.length };
      }
      // SELECT by status
      if (text.includes('WHERE status = $1')) {
        const table = text.match(/FROM (\w+)/)?.[1] || 'unknown';
        const rows = (store[table] || []).filter(r => r.status === params?.[0]);
        return { rows, rowCount: rows.length };
      }
      // SELECT all
      if (text.includes('SELECT * FROM')) {
        const table = text.match(/FROM (\w+)/)?.[1] || 'unknown';
        let rows = [...(store[table] || [])];
        if (text.includes('WHERE') && params && params.length > 0) {
          const whereClause = text.split('WHERE')[1]?.split('ORDER BY')[0]?.split('LIMIT')[0] || '';
          const conditions = whereClause.split('AND').map(c => c.trim()).filter(c => c && !c.startsWith('1=1'));
          let paramIdx = 0;
          for (const cond of conditions) {
            const colMatch = cond.match(/(\w+)\s*=\s*\$(\d+)/);
            if (colMatch) {
              const col = colMatch[1];
              const val = params[paramIdx];
              if (val !== undefined && val !== null) {
                rows = rows.filter(r => String(r[col]) === String(val));
              }
              paramIdx++;
            }
          }
        }
        return { rows, rowCount: rows.length };
      }
      // UPDATE
      if (text.includes('UPDATE')) {
        const table = text.match(/UPDATE (\w+)/)?.[1] || 'unknown';
        const rows = store[table] || [];
        // Extract id param position from WHERE clause (e.g. "id = $8")
        const idMatch = text.match(/id\s*=\s*\$(\d+)/);
        const idParamIdx = idMatch ? parseInt(idMatch[1]) - 1 : params?.length - 1;
        const id = params?.[idParamIdx];
        const idx = rows.findIndex(r => r.id === id);
        if (idx >= 0) {
          // Parse SET clause: match column = $N assignments
          const setMatch = text.match(/SET (.+?) WHERE/);
          if (setMatch && params) {
            const setPart = setMatch[1];
            // Split by comma but handle carefully
            const assignments = setPart.split(',').map(s => s.trim());
            let paramIdx = 0;
            for (const assignment of assignments) {
              const colMatch = assignment.match(/^(\w+)\s*=\s*\$(\d+)/);
              if (colMatch) {
                const col = toSnakeCase(colMatch[1]);
                rows[idx][col] = params[paramIdx];
                paramIdx++;
              } else if (assignment.includes('NOW()')) {
                // updated_at = NOW() - skip, no param consumed
              }
            }
          }
          rows[idx].updated_at = new Date();
          return { rows: [rows[idx]], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }
      // DELETE
      if (text.includes('DELETE')) {
        const table = text.match(/FROM (\w+)/)?.[1] || 'unknown';
        const rows = store[table] || [];
        const idx = rows.findIndex(r => r.id === params?.[0]);
        if (idx >= 0) {
          rows.splice(idx, 1);
          return { rows: [], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }
      return { rows: [], rowCount: 0 };
    }),
  };
  return db;
}

describe('SaaSCostTracker', () => {
  let tracker: SaaSCostTracker;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    tracker = new SaaSCostTracker(mockDb as any);
  });

  // ==================== Add Subscription ====================

  describe('addSubscription', () => {
    it('should add a monthly subscription', async () => {
      const sub = await tracker.addSubscription({
        tool: 'GitLab',
        subscription: 'Premium',
        seats: 10,
        unitCost: 29,
        billingCycle: 'monthly',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
      });

      expect(sub.id).toBeDefined();
      expect(sub.tool).toBe('GitLab');
      expect(sub.subscription).toBe('Premium');
      expect(sub.seats).toBe(10);
      expect(sub.unitCost).toBe(29);
      expect(sub.totalCost).toBe(290);
      expect(sub.billingCycle).toBe('monthly');
      expect(sub.status).toBe('active');
    });

    it('should calculate quarterly total cost correctly', async () => {
      const sub = await tracker.addSubscription({
        tool: 'Jira',
        subscription: 'Standard',
        seats: 5,
        unitCost: 7,
        billingCycle: 'quarterly',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
      });

      expect(sub.totalCost).toBe(105);
    });

    it('should calculate annual total cost correctly', async () => {
      const sub = await tracker.addSubscription({
        tool: 'Slack',
        subscription: 'Business+',
        seats: 20,
        unitCost: 12.50,
        billingCycle: 'annually',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
      });

      expect(sub.totalCost).toBe(3000);
    });

    it('should include optional tenant and notes', async () => {
      const sub = await tracker.addSubscription({
        tool: 'GitHub',
        subscription: 'Enterprise',
        seats: 50,
        unitCost: 21,
        billingCycle: 'monthly',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        tenantId: 'tenant-001',
        notes: 'Engineering team',
      });

      expect(sub.tenantId).toBe('tenant-001');
      expect(sub.notes).toBe('Engineering team');
    });
  });

  // ==================== Update Subscription ====================

  describe('updateSubscription', () => {
    let subId: string;

    beforeEach(async () => {
      const sub = await tracker.addSubscription({
        tool: 'GitLab',
        subscription: 'Premium',
        seats: 10,
        unitCost: 29,
        billingCycle: 'monthly',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
      });
      subId = sub.id;
    });

    it('should update seats', async () => {
      const updated = await tracker.updateSubscription(subId, { seats: 15 });

      expect(updated).not.toBeNull();
      expect(updated!.seats).toBe(15);
      expect(updated!.totalCost).toBe(435);
    });

    it('should update unit cost', async () => {
      const updated = await tracker.updateSubscription(subId, { unitCost: 35 });

      expect(updated).not.toBeNull();
      expect(updated!.unitCost).toBe(35);
      expect(updated!.totalCost).toBe(350);
    });

    it('should update status to cancelled', async () => {
      const updated = await tracker.updateSubscription(subId, { status: 'cancelled' });

      expect(updated).not.toBeNull();
      expect(updated!.status).toBe('cancelled');
    });

    it('should return null for non-existent subscription', async () => {
      const updated = await tracker.updateSubscription('non-existent-id', { seats: 5 });

      expect(updated).toBeNull();
    });
  });

  // ==================== Cancel Subscription ====================

  describe('cancelSubscription', () => {
    it('should cancel an active subscription', async () => {
      const sub = await tracker.addSubscription({
        tool: 'Jira',
        subscription: 'Standard',
        seats: 5,
        unitCost: 7,
        billingCycle: 'monthly',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
      });

      const result = await tracker.cancelSubscription(sub.id);

      expect(result).toBe(true);
    });

    it('should return false for non-existent subscription', async () => {
      const result = await tracker.cancelSubscription('non-existent');
      expect(result).toBe(false);
    });
  });

  // ==================== Get Subscriptions ====================

  describe('getSubscriptions', () => {
    it('should return all subscriptions from DB', async () => {
      await tracker.addSubscription({
        tool: 'GitLab',
        subscription: 'Premium',
        seats: 10,
        unitCost: 29,
        billingCycle: 'monthly',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
      });

      const subs = await tracker.getSubscriptions();
      expect(subs.length).toBe(1);
    });

    it('should filter by tool', async () => {
      await tracker.addSubscription({
        tool: 'GitLab',
        subscription: 'Premium',
        seats: 10,
        unitCost: 29,
        billingCycle: 'monthly',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
      });

      const subs = await tracker.getSubscriptions({ tool: 'GitLab' });
      expect(subs.length).toBe(1);
      expect(subs[0].tool).toBe('GitLab');
    });

    it('should sort by total cost descending', async () => {
      await tracker.addSubscription({
        tool: 'GitLab',
        subscription: 'Premium',
        seats: 10,
        unitCost: 29,
        billingCycle: 'monthly',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
      });

      await tracker.addSubscription({
        tool: 'Slack',
        subscription: 'Business',
        seats: 20,
        unitCost: 10,
        billingCycle: 'monthly',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
      });

      const subs = await tracker.getSubscriptions();

      for (let i = 0; i < subs.length - 1; i++) {
        expect(subs[i].totalCost).toBeGreaterThanOrEqual(subs[i + 1].totalCost);
      }
    });
  });

  // ==================== Get Subscription ====================

  describe('getSubscription', () => {
    it('should return subscription by ID', async () => {
      const sub = await tracker.addSubscription({
        tool: 'GitLab',
        subscription: 'Premium',
        seats: 10,
        unitCost: 29,
        billingCycle: 'monthly',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
      });

      const found = await tracker.getSubscription(sub.id);
      expect(found).toBeDefined();
      expect(found!.id).toBe(sub.id);
    });

    it('should return undefined for non-existent ID', async () => {
      const found = await tracker.getSubscription('non-existent');
      expect(found).toBeUndefined();
    });
  });

  // ==================== Monthly Cost ====================

  describe('getMonthlyCost', () => {
    it('should calculate total monthly cost for all active subscriptions', async () => {
      await tracker.addSubscription({
        tool: 'GitLab',
        subscription: 'Premium',
        seats: 10,
        unitCost: 29,
        billingCycle: 'monthly',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
      });

      const monthly = await tracker.getMonthlyCost();
      expect(monthly).toBeGreaterThan(0);
    });

    it('should filter by tool', async () => {
      await tracker.addSubscription({
        tool: 'GitLab',
        subscription: 'Premium',
        seats: 10,
        unitCost: 29,
        billingCycle: 'monthly',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
      });

      const monthly = await tracker.getMonthlyCost({ tool: 'GitLab' });
      expect(monthly).toBeGreaterThan(0);
    });
  });

  // ==================== Annual Projection ====================

  describe('getAnnualProjection', () => {
    it('should project annual cost from monthly', async () => {
      await tracker.addSubscription({
        tool: 'GitLab',
        subscription: 'Premium',
        seats: 10,
        unitCost: 29,
        billingCycle: 'monthly',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
      });

      const annual = await tracker.getAnnualProjection();
      expect(annual).toBeGreaterThan(0);

      const monthly = await tracker.getMonthlyCost();
      expect(annual).toBe(Math.round(monthly * 12 * 100) / 100);
    });
  });

  // ==================== Monthly Cost by Tool ====================

  describe('getMonthlyCostByTool', () => {
    it('should return costs grouped by tool', async () => {
      await tracker.addSubscription({
        tool: 'GitLab',
        subscription: 'Premium',
        seats: 10,
        unitCost: 29,
        billingCycle: 'monthly',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
      });

      await tracker.addSubscription({
        tool: 'Slack',
        subscription: 'Business',
        seats: 20,
        unitCost: 10,
        billingCycle: 'monthly',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
      });

      const costs = await tracker.getMonthlyCostByTool();

      expect(Object.keys(costs).length).toBe(2);
      expect(costs['GitLab']).toBeGreaterThan(0);
      expect(costs['Slack']).toBeGreaterThan(0);
    });
  });

  // ==================== License Utilization ====================

  describe('getLicenseUtilization', () => {
    it('should return utilization data for active tools', async () => {
      await tracker.addSubscription({
        tool: 'GitLab',
        subscription: 'Premium',
        seats: 10,
        unitCost: 29,
        billingCycle: 'monthly',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
      });

      const utilization = await tracker.getLicenseUtilization();

      expect(Object.keys(utilization).length).toBe(1);
      expect(utilization['GitLab']).toBeDefined();
      expect(utilization['GitLab'].totalSeats).toBe(10);
      expect(utilization['GitLab'].utilizationRate).toBeGreaterThan(0);
      expect(utilization['GitLab'].monthlyCost).toBeGreaterThan(0);
    });
  });

  // ==================== Record Management ====================

  describe('getSubscriptionCount', () => {
    it('should return count from DB', async () => {
      const count = await tracker.getSubscriptionCount();
      expect(count).toBe(0);
    });

    it('should return correct count after adding subscriptions', async () => {
      await tracker.addSubscription({
        tool: 'GitLab',
        subscription: 'Premium',
        seats: 10,
        unitCost: 29,
        billingCycle: 'monthly',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
      });

      const count = await tracker.getSubscriptionCount();
      expect(count).toBe(1);
    });
  });
});
