/**
 * CostRecord 模型测试
 */
import {
  createBudget,
  createCostRecord,
  createAlertRule,
  createModelPricing,
} from '../CostRecord';

describe('CostRecord', () => {
  describe('createBudget', () => {
    it('should create budget with defaults', () => {
      const budget = createBudget({
        name: 'monthly-budget',
        type: 'tenant',
        scope: 't1',
        period: 'monthly',
        amount: 10000,
      });

      expect(budget.id).toBeDefined();
      expect(budget.name).toBe('monthly-budget');
      expect(budget.type).toBe('tenant');
      expect(budget.scope).toBe('t1');
      expect(budget.period).toBe('monthly');
      expect(budget.amount).toBe(10000);
      expect(budget.thresholds).toEqual({ warning: 0.8, critical: 0.95, hardLimit: 1.0 });
      expect(budget.status).toBe('active');
      expect(budget.spent).toBe(0);
      expect(budget.createdAt).toBeInstanceOf(Date);
    });

    it('should accept custom thresholds', () => {
      const budget = createBudget({
        name: 'b',
        type: 'project',
        scope: 'p1',
        period: 'daily',
        amount: 100,
        thresholds: { warning: 0.5, critical: 0.8, hardLimit: 0.9 },
      });

      expect(budget.thresholds.warning).toBe(0.5);
    });
  });

  describe('createCostRecord', () => {
    it('should create cost record', () => {
      const record = createCostRecord({
        requestId: 'req-1',
        model: 'gpt-4o',
        provider: 'openai',
        inputTokens: 1000,
        outputTokens: 500,
        inputCost: 0.01,
        outputCost: 0.005,
        totalCost: 0.015,
        moduleType: 'chat',
      });

      expect(record.id).toBeDefined();
      expect(record.requestId).toBe('req-1');
      expect(record.model).toBe('gpt-4o');
      expect(record.provider).toBe('openai');
      expect(record.inputTokens).toBe(1000);
      expect(record.outputTokens).toBe(500);
      expect(record.totalCost).toBe(0.015);
      expect(record.moduleType).toBe('chat');
      expect(record.timestamp).toBeInstanceOf(Date);
    });

    it('should accept optional tenant/project/user', () => {
      const record = createCostRecord({
        requestId: 'r1',
        model: 'm1',
        provider: 'p1',
        inputTokens: 100,
        outputTokens: 50,
        inputCost: 1,
        outputCost: 1,
        totalCost: 2,
        moduleType: 'svc',
        tenantId: 't1',
        projectId: 'p1',
        userId: 'u1',
      });

      expect(record.tenantId).toBe('t1');
      expect(record.projectId).toBe('p1');
      expect(record.userId).toBe('u1');
    });
  });

  describe('createAlertRule', () => {
    it('should create alert rule', () => {
      const rule = createAlertRule({
        name: 'budget-alert',
        condition: 'budget_percentage',
        threshold: 0.8,
        severity: 'warning',
        recipients: ['admin@example.com'],
      });

      expect(rule.id).toBeDefined();
      expect(rule.name).toBe('budget-alert');
      expect(rule.condition).toBe('budget_percentage');
      expect(rule.threshold).toBe(0.8);
      expect(rule.severity).toBe('warning');
      expect(rule.recipients).toEqual(['admin@example.com']);
      expect(rule.status).toBe('active');
      expect(rule.createdAt).toBeInstanceOf(Date);
    });

    it('should accept optional budgetId', () => {
      const rule = createAlertRule({
        name: 'r',
        condition: 'absolute_cost',
        threshold: 100,
        severity: 'critical',
        recipients: [],
        budgetId: 'budget-1',
      });

      expect(rule.budgetId).toBe('budget-1');
    });
  });

  describe('createModelPricing', () => {
    it('should create pricing with defaults', () => {
      const pricing = createModelPricing({
        provider: 'openai',
        model: 'gpt-4o-mini',
        inputPricePer1k: 0.00015,
        outputPricePer1k: 0.0006,
      });

      expect(pricing.id).toBeDefined();
      expect(pricing.provider).toBe('openai');
      expect(pricing.model).toBe('gpt-4o-mini');
      expect(pricing.currency).toBe('CNY');
      expect(pricing.effectiveFrom).toBeInstanceOf(Date);
    });

    it('should accept custom currency and dates', () => {
      const pricing = createModelPricing({
        provider: 'p',
        model: 'm',
        inputPricePer1k: 1,
        outputPricePer1k: 2,
        currency: 'USD',
        effectiveFrom: new Date('2024-01-01'),
        effectiveTo: new Date('2025-01-01'),
        notes: 'v1 pricing',
      });

      expect(pricing.currency).toBe('USD');
      expect(pricing.notes).toBe('v1 pricing');
    });
  });
});
