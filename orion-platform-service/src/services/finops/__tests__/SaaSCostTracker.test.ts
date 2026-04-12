/**
 * SaaSCostTracker 单元测试
 */

import { SaaSCostTracker } from '../SaaSCostTracker';

describe('SaaSCostTracker', () => {
  let tracker: SaaSCostTracker;

  beforeEach(() => {
    tracker = new SaaSCostTracker();
  });

  // ==================== Add Subscription ====================

  describe('addSubscription', () => {
    it('should add a monthly subscription', () => {
      const sub = tracker.addSubscription({
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
      expect(sub.totalCost).toBe(290); // 29 * 10
      expect(sub.billingCycle).toBe('monthly');
      expect(sub.status).toBe('active');
    });

    it('should calculate quarterly total cost correctly', () => {
      const sub = tracker.addSubscription({
        tool: 'Jira',
        subscription: 'Standard',
        seats: 5,
        unitCost: 7,
        billingCycle: 'quarterly',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
      });

      // 7 * 5 * 3 months = 105
      expect(sub.totalCost).toBe(105);
    });

    it('should calculate annual total cost correctly', () => {
      const sub = tracker.addSubscription({
        tool: 'Slack',
        subscription: 'Business+',
        seats: 20,
        unitCost: 12.50,
        billingCycle: 'annually',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
      });

      // 12.50 * 20 * 12 months = 3000
      expect(sub.totalCost).toBe(3000);
    });

    it('should include optional tenant and notes', () => {
      const sub = tracker.addSubscription({
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

    beforeEach(() => {
      const sub = tracker.addSubscription({
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

    it('should update seats', () => {
      const updated = tracker.updateSubscription(subId, { seats: 15 });

      expect(updated).not.toBeNull();
      expect(updated!.seats).toBe(15);
      expect(updated!.totalCost).toBe(435); // 29 * 15
    });

    it('should update unit cost', () => {
      const updated = tracker.updateSubscription(subId, { unitCost: 35 });

      expect(updated).not.toBeNull();
      expect(updated!.unitCost).toBe(35);
      expect(updated!.totalCost).toBe(350); // 35 * 10
    });

    it('should update status to cancelled', () => {
      const updated = tracker.updateSubscription(subId, { status: 'cancelled' });

      expect(updated).not.toBeNull();
      expect(updated!.status).toBe('cancelled');
    });

    it('should return null for non-existent subscription', () => {
      const updated = tracker.updateSubscription('non-existent-id', { seats: 5 });

      expect(updated).toBeNull();
    });
  });

  // ==================== Cancel Subscription ====================

  describe('cancelSubscription', () => {
    it('should cancel an active subscription', () => {
      const sub = tracker.addSubscription({
        tool: 'Jira',
        subscription: 'Standard',
        seats: 5,
        unitCost: 7,
        billingCycle: 'monthly',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
      });

      const result = tracker.cancelSubscription(sub.id);

      expect(result).toBe(true);
      const updated = tracker.getSubscription(sub.id);
      expect(updated!.status).toBe('cancelled');
    });

    it('should return false for non-existent subscription', () => {
      const result = tracker.cancelSubscription('non-existent');
      expect(result).toBe(false);
    });
  });

  // ==================== Get Subscriptions ====================

  describe('getSubscriptions', () => {
    beforeEach(() => {
      tracker.addSubscription({
        tool: 'GitLab',
        subscription: 'Premium',
        seats: 10,
        unitCost: 29,
        billingCycle: 'monthly',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        tenantId: 'tenant-001',
      });

      tracker.addSubscription({
        tool: 'Jira',
        subscription: 'Standard',
        seats: 5,
        unitCost: 7,
        billingCycle: 'monthly',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        tenantId: 'tenant-002',
      });

      tracker.addSubscription({
        tool: 'Slack',
        subscription: 'Business',
        seats: 20,
        unitCost: 10,
        billingCycle: 'monthly',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        tenantId: 'tenant-001',
      });
    });

    it('should return all subscriptions', () => {
      const subs = tracker.getSubscriptions();

      expect(subs.length).toBe(3);
    });

    it('should filter by tool', () => {
      const subs = tracker.getSubscriptions({ tool: 'GitLab' });

      expect(subs.length).toBe(1);
      expect(subs[0].tool).toBe('GitLab');
    });

    it('should filter by status', () => {
      const all = tracker.getSubscriptions();
      tracker.cancelSubscription(all[0].id);

      const active = tracker.getSubscriptions({ status: 'active' });
      expect(active.length).toBe(2);

      const cancelled = tracker.getSubscriptions({ status: 'cancelled' });
      expect(cancelled.length).toBe(1);
    });

    it('should filter by tenant ID', () => {
      const subs = tracker.getSubscriptions({ tenantId: 'tenant-001' });

      expect(subs.length).toBe(2);
    });

    it('should sort by total cost descending', () => {
      const subs = tracker.getSubscriptions();

      for (let i = 0; i < subs.length - 1; i++) {
        expect(subs[i].totalCost).toBeGreaterThanOrEqual(subs[i + 1].totalCost);
      }
    });
  });

  // ==================== Get Subscription ====================

  describe('getSubscription', () => {
    it('should return subscription by ID', () => {
      const sub = tracker.addSubscription({
        tool: 'GitLab',
        subscription: 'Premium',
        seats: 10,
        unitCost: 29,
        billingCycle: 'monthly',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
      });

      const found = tracker.getSubscription(sub.id);
      expect(found).toBeDefined();
      expect(found!.id).toBe(sub.id);
    });

    it('should return undefined for non-existent ID', () => {
      const found = tracker.getSubscription('non-existent');
      expect(found).toBeUndefined();
    });
  });

  // ==================== Monthly Cost ====================

  describe('getMonthlyCost', () => {
    beforeEach(() => {
      // Monthly: 29 * 10 = 290/month
      tracker.addSubscription({
        tool: 'GitLab',
        subscription: 'Premium',
        seats: 10,
        unitCost: 29,
        billingCycle: 'monthly',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
      });

      // Annual: 7 * 5 * 12 = 420/year -> 35/month (approximately)
      tracker.addSubscription({
        tool: 'Jira',
        subscription: 'Standard',
        seats: 5,
        unitCost: 7,
        billingCycle: 'annually',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
      });
    });

    it('should calculate total monthly cost for all active subscriptions', () => {
      const monthly = tracker.getMonthlyCost();

      // Should be positive
      expect(monthly).toBeGreaterThan(0);
    });

    it('should filter by tool', () => {
      const monthly = tracker.getMonthlyCost({ tool: 'GitLab' });

      expect(monthly).toBeGreaterThan(0);
    });

    it('should exclude cancelled subscriptions', () => {
      const all = tracker.getSubscriptions();
      tracker.cancelSubscription(all[0].id);

      const monthlyAfterCancel = tracker.getMonthlyCost();
      const monthlyBefore = tracker.addSubscription({
        tool: 'GitLab',
        subscription: 'Premium',
        seats: 10,
        unitCost: 29,
        billingCycle: 'monthly',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
      });

      // Should be different
      expect(monthlyAfterCancel).not.toBe(monthlyBefore.totalCost);
    });
  });

  // ==================== Annual Projection ====================

  describe('getAnnualProjection', () => {
    beforeEach(() => {
      tracker.addSubscription({
        tool: 'GitLab',
        subscription: 'Premium',
        seats: 10,
        unitCost: 29,
        billingCycle: 'monthly',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
      });
    });

    it('should project annual cost from monthly', () => {
      const annual = tracker.getAnnualProjection();

      expect(annual).toBeGreaterThan(0);
      // Should be approximately 12x monthly
      const monthly = tracker.getMonthlyCost();
      expect(annual).toBe(Math.round(monthly * 12 * 100) / 100);
    });
  });

  // ==================== Monthly Cost by Tool ====================

  describe('getMonthlyCostByTool', () => {
    beforeEach(() => {
      tracker.addSubscription({
        tool: 'GitLab',
        subscription: 'Premium',
        seats: 10,
        unitCost: 29,
        billingCycle: 'monthly',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
      });

      tracker.addSubscription({
        tool: 'Slack',
        subscription: 'Business',
        seats: 20,
        unitCost: 10,
        billingCycle: 'monthly',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
      });
    });

    it('should return costs grouped by tool', () => {
      const costs = tracker.getMonthlyCostByTool();

      expect(Object.keys(costs).length).toBe(2);
      expect(costs['GitLab']).toBeGreaterThan(0);
      expect(costs['Slack']).toBeGreaterThan(0);
    });
  });

  // ==================== License Utilization ====================

  describe('getLicenseUtilization', () => {
    beforeEach(() => {
      tracker.addSubscription({
        tool: 'GitLab',
        subscription: 'Premium',
        seats: 10,
        unitCost: 29,
        billingCycle: 'monthly',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
      });
    });

    it('should return utilization data for active tools', () => {
      const utilization = tracker.getLicenseUtilization();

      expect(Object.keys(utilization).length).toBe(1);
      expect(utilization['GitLab']).toBeDefined();
      expect(utilization['GitLab'].totalSeats).toBe(10);
      expect(utilization['GitLab'].utilizationRate).toBeGreaterThan(0);
      expect(utilization['GitLab'].monthlyCost).toBeGreaterThan(0);
    });

    it('should exclude cancelled subscriptions', () => {
      const all = tracker.getSubscriptions();
      tracker.cancelSubscription(all[0].id);

      const utilization = tracker.getLicenseUtilization();
      expect(Object.keys(utilization).length).toBe(0);
    });
  });

  // ==================== Record Management ====================

  describe('getSubscriptionCount', () => {
    it('should return 0 initially', () => {
      expect(tracker.getSubscriptionCount()).toBe(0);
    });

    it('should return correct count after adding subscriptions', () => {
      tracker.addSubscription({
        tool: 'GitLab',
        subscription: 'Premium',
        seats: 10,
        unitCost: 29,
        billingCycle: 'monthly',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
      });

      expect(tracker.getSubscriptionCount()).toBe(1);
    });
  });

  describe('clearSubscriptions', () => {
    it('should clear all subscriptions', () => {
      tracker.addSubscription({
        tool: 'GitLab',
        subscription: 'Premium',
        seats: 10,
        unitCost: 29,
        billingCycle: 'monthly',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
      });

      tracker.clearSubscriptions();

      expect(tracker.getSubscriptionCount()).toBe(0);
    });
  });
});
