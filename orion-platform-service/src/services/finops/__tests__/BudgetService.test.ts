/**
 * TASK-502: BudgetService 单元测试
 */

import { BudgetService } from '../BudgetService';

describe('BudgetService', () => {
  let service: BudgetService;

  beforeEach(() => {
    service = new BudgetService();
  });

  // ==================== Create Budget ====================

  describe('createBudget', () => {
    it('should create a budget with default thresholds', () => {
      const budget = service.createBudget({
        entityType: 'project',
        entityId: 'proj-001',
        amount: 5000,
        period: 'monthly',
      });

      expect(budget.id).toBeDefined();
      expect(budget.entityType).toBe('project');
      expect(budget.entityId).toBe('proj-001');
      expect(budget.amount).toBe(5000);
      expect(budget.period).toBe('monthly');
      expect(budget.currency).toBe('USD');
      expect(budget.alerts.length).toBe(4); // Default: 50, 75, 90, 100
      expect(budget.alerts[0].percentage).toBe(50);
      expect(budget.alerts[0].triggered).toBe(false);
    });

    it('should create a budget with custom thresholds', () => {
      const budget = service.createBudget({
        entityType: 'tenant',
        entityId: 'tenant-001',
        amount: 10000,
        period: 'quarterly',
        alerts: [
          { percentage: 60 },
          { percentage: 80 },
        ],
      });

      expect(budget.alerts.length).toBe(2);
      expect(budget.alerts[0].percentage).toBe(60);
      expect(budget.alerts[1].percentage).toBe(80);
    });

    it('should include optional fields', () => {
      const budget = service.createBudget({
        entityType: 'team',
        entityId: 'team-alpha',
        amount: 2000,
        period: 'monthly',
        currency: 'CNY',
        environment: 'staging',
        description: 'Team staging budget',
      });

      expect(budget.currency).toBe('CNY');
      expect(budget.environment).toBe('staging');
      expect(budget.description).toBe('Team staging budget');
    });
  });

  // ==================== Update Budget ====================

  describe('updateBudget', () => {
    let budgetId: string;

    beforeEach(() => {
      const budget = service.createBudget({
        entityType: 'project',
        entityId: 'proj-001',
        amount: 5000,
        period: 'monthly',
      });
      budgetId = budget.id;
    });

    it('should update budget amount', () => {
      const updated = service.updateBudget(budgetId, { amount: 8000 });

      expect(updated).not.toBeNull();
      expect(updated!.amount).toBe(8000);
    });

    it('should update budget period', () => {
      const updated = service.updateBudget(budgetId, { period: 'quarterly' });

      expect(updated).not.toBeNull();
      expect(updated!.period).toBe('quarterly');
    });

    it('should update alerts', () => {
      const updated = service.updateBudget(budgetId, {
        alerts: [{ percentage: 70 }, { percentage: 90 }],
      });

      expect(updated).not.toBeNull();
      expect(updated!.alerts.length).toBe(2);
      expect(updated!.alerts[0].triggered).toBe(false);
    });

    it('should return null for non-existent budget', () => {
      const updated = service.updateBudget('non-existent', { amount: 1000 });
      expect(updated).toBeNull();
    });

    it('should set updatedAt', () => {
      const updated = service.updateBudget(budgetId, { amount: 6000 });

      expect(updated!.updatedAt).toBeDefined();
    });
  });

  // ==================== Delete Budget ====================

  describe('deleteBudget', () => {
    it('should delete an existing budget', () => {
      const budget = service.createBudget({
        entityType: 'project',
        entityId: 'proj-001',
        amount: 5000,
        period: 'monthly',
      });

      const deleted = service.deleteBudget(budget.id);
      expect(deleted).toBe(true);

      const found = service.getBudget(budget.id);
      expect(found).toBeUndefined();
    });

    it('should return false for non-existent budget', () => {
      const deleted = service.deleteBudget('non-existent');
      expect(deleted).toBe(false);
    });
  });

  // ==================== Get/List Budgets ====================

  describe('listBudgets', () => {
    beforeEach(() => {
      service.createBudget({
        entityType: 'project',
        entityId: 'proj-001',
        amount: 5000,
        period: 'monthly',
      });

      service.createBudget({
        entityType: 'project',
        entityId: 'proj-002',
        amount: 3000,
        period: 'monthly',
      });

      service.createBudget({
        entityType: 'tenant',
        entityId: 'tenant-001',
        amount: 10000,
        period: 'quarterly',
      });
    });

    it('should return all budgets', () => {
      const budgets = service.listBudgets();
      expect(budgets.length).toBe(3);
    });

    it('should filter by entity type', () => {
      const budgets = service.listBudgets({ entityType: 'project' });
      expect(budgets.length).toBe(2);
    });

    it('should filter by entity ID', () => {
      const budgets = service.listBudgets({ entityId: 'tenant-001' });
      expect(budgets.length).toBe(1);
    });
  });

  // ==================== Update Entity Spend ====================

  describe('updateEntitySpend', () => {
    it('should update entity spend', () => {
      service.updateEntitySpend('project', 'proj-001', 1000);

      // Create budget to check status later
      const budget = service.createBudget({
        entityType: 'project',
        entityId: 'proj-001',
        amount: 5000,
        period: 'monthly',
      });

      const status = service.getBudgetStatus(budget.id);
      expect(status).not.toBeNull();
      expect(status!.currentSpend).toBe(1000);
    });

    it('should record spend history', () => {
      service.updateEntitySpend('project', 'proj-001', 100);
      service.updateEntitySpend('project', 'proj-001', 300);
      service.updateEntitySpend('project', 'proj-001', 500);

      const budget = service.createBudget({
        entityType: 'project',
        entityId: 'proj-001',
        amount: 1000,
        period: 'monthly',
      });

      const forecast = service.forecastBudget(budget.id);
      expect(forecast).not.toBeNull();
      expect(forecast!.history.length).toBe(3);
    });
  });

  // ==================== Check Budget Alerts ====================

  describe('checkBudgetAlerts', () => {
    it('should trigger alert when spend exceeds threshold', () => {
      service.createBudget({
        entityType: 'project',
        entityId: 'proj-001',
        amount: 1000,
        period: 'monthly',
        alerts: [{ percentage: 80 }],
      });

      service.updateEntitySpend('project', 'proj-001', 850);

      const triggered = service.checkBudgetAlerts();

      expect(triggered.length).toBe(1);
      expect(triggered[0].threshold).toBe(80);
      expect(triggered[0].actual).toBe(850);
      expect(triggered[0].percentage).toBe(85);
    });

    it('should not trigger alert when below threshold', () => {
      service.createBudget({
        entityType: 'project',
        entityId: 'proj-001',
        amount: 1000,
        period: 'monthly',
        alerts: [{ percentage: 80 }],
      });

      service.updateEntitySpend('project', 'proj-001', 500);

      const triggered = service.checkBudgetAlerts();
      expect(triggered.length).toBe(0);
    });

    it('should not trigger the same threshold twice', () => {
      service.createBudget({
        entityType: 'project',
        entityId: 'proj-001',
        amount: 1000,
        period: 'monthly',
        alerts: [{ percentage: 50 }],
      });

      service.updateEntitySpend('project', 'proj-001', 600);

      const first = service.checkBudgetAlerts();
      const second = service.checkBudgetAlerts();

      expect(first.length).toBe(1);
      expect(second.length).toBe(0);
    });

    it('should trigger multiple thresholds at once', () => {
      service.createBudget({
        entityType: 'project',
        entityId: 'proj-001',
        amount: 1000,
        period: 'monthly',
        alerts: [
          { percentage: 50 },
          { percentage: 75 },
          { percentage: 90 },
        ],
      });

      service.updateEntitySpend('project', 'proj-001', 950);

      const triggered = service.checkBudgetAlerts();
      expect(triggered.length).toBe(3);
    });

    it('should return empty when no budgets configured', () => {
      const triggered = service.checkBudgetAlerts();
      expect(triggered.length).toBe(0);
    });
  });

  // ==================== Budget Status ====================

  describe('getBudgetStatus', () => {
    it('should return budget status', () => {
      const budget = service.createBudget({
        entityType: 'project',
        entityId: 'proj-001',
        amount: 5000,
        period: 'monthly',
      });

      service.updateEntitySpend('project', 'proj-001', 3000);

      const status = service.getBudgetStatus(budget.id);

      expect(status).not.toBeNull();
      expect(status!.budgetId).toBe(budget.id);
      expect(status!.currentSpend).toBe(3000);
      expect(status!.usagePercent).toBe(60);
      expect(status!.remaining).toBe(2000);
      expect(status!.overBudget).toBe(false);
    });

    it('should detect over-budget status', () => {
      const budget = service.createBudget({
        entityType: 'tenant',
        entityId: 'tenant-001',
        amount: 1000,
        period: 'monthly',
      });

      service.updateEntitySpend('tenant', 'tenant-001', 1500);

      const status = service.getBudgetStatus(budget.id);

      expect(status!.overBudget).toBe(true);
      expect(status!.remaining).toBe(-500);
      expect(status!.usagePercent).toBe(150);
    });

    it('should return null for non-existent budget', () => {
      const status = service.getBudgetStatus('non-existent');
      expect(status).toBeNull();
    });

    it('should include triggered alerts', () => {
      const budget = service.createBudget({
        entityType: 'project',
        entityId: 'proj-001',
        amount: 1000,
        period: 'monthly',
        alerts: [{ percentage: 50 }],
      });

      service.updateEntitySpend('project', 'proj-001', 600);
      service.checkBudgetAlerts();

      const status = service.getBudgetStatus(budget.id);

      expect(status!.triggeredAlerts.length).toBe(1);
    });
  });

  // ==================== Budget Forecast ====================

  describe('forecastBudget', () => {
    it('should return null for non-existent budget', () => {
      const forecast = service.forecastBudget('non-existent');
      expect(forecast).toBeNull();
    });

    it('should forecast based on spend history', () => {
      const budget = service.createBudget({
        entityType: 'project',
        entityId: 'proj-001',
        amount: 5000,
        period: 'monthly',
      });

      // Simulate spend history over days
      service.updateEntitySpend('project', 'proj-001', 500);
      service.updateEntitySpend('project', 'proj-001', 1000);
      service.updateEntitySpend('project', 'proj-001', 1500);

      const forecast = service.forecastBudget(budget.id);

      expect(forecast).not.toBeNull();
      expect(forecast!.currentSpend).toBe(1500);
      // History entries are created at nearly the same time, so daily rate is ~0
      expect(forecast!.history.length).toBe(3);
    });

    it('should predict within budget', () => {
      const budget = service.createBudget({
        entityType: 'project',
        entityId: 'proj-001',
        amount: 10000,
        period: 'monthly',
      });

      service.updateEntitySpend('project', 'proj-001', 1000);

      const forecast = service.forecastBudget(budget.id);

      expect(forecast!.withinBudget).toBe(true);
    });

    it('should predict over budget', () => {
      const budget = service.createBudget({
        entityType: 'project',
        entityId: 'proj-001',
        amount: 1000,
        period: 'monthly',
      });

      // High daily spend rate
      service.updateEntitySpend('project', 'proj-001', 900);

      const forecast = service.forecastBudget(budget.id);

      expect(forecast!.withinBudget).toBe(false);
      expect(forecast!.projectedOverage).toBeGreaterThanOrEqual(0);
    });
  });

  // ==================== Alert Triggers ====================

  describe('getAlertTriggers', () => {
    beforeEach(() => {
      const budget = service.createBudget({
        entityType: 'project',
        entityId: 'proj-001',
        amount: 1000,
        period: 'monthly',
        alerts: [{ percentage: 50 }],
      });

      service.updateEntitySpend('project', 'proj-001', 600);
      service.checkBudgetAlerts();
    });

    it('should return all triggers', () => {
      const triggers = service.getAlertTriggers();
      expect(triggers.length).toBeGreaterThan(0);
    });

    it('should filter by budget ID', () => {
      const triggers = service.getAlertTriggers({
        budgetId: 'non-existent',
      });
      expect(triggers.length).toBe(0);
    });
  });

  // ==================== Clear All ====================

  describe('clearAll', () => {
    it('should clear all data', () => {
      service.createBudget({
        entityType: 'project',
        entityId: 'proj-001',
        amount: 5000,
        period: 'monthly',
      });

      service.updateEntitySpend('project', 'proj-001', 1000);

      service.clearAll();

      expect(service.listBudgets().length).toBe(0);
    });
  });
});
