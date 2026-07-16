/**
 * BudgetService - 业务逻辑层单元测试
 *
 * 测试覆盖: 预算CRUD、成本追踪、健康检查、告警规则、模型定价、仪表盘
 */

// Mock repositories before import
const mockBudgetRepo = {
  create: jest.fn(),
  findById: jest.fn(),
  findAll: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  findByEntity: jest.fn(),
  updateSpent: jest.fn(),
  updateSpentWithClient: jest.fn(),
  updateWithClient: jest.fn(),
};

const mockCostRecordRepo = {
  create: jest.fn(),
  createWithClient: jest.fn(),
  findAll: jest.fn(),
  getSummary: jest.fn(),
};

const mockAlertRuleRepo = {
  create: jest.fn(),
  findAll: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

const mockModelPricingRepo = {
  create: jest.fn(),
  findAll: jest.fn(),
  findByProviderModel: jest.fn(),
  delete: jest.fn(),
};

jest.mock('../../../repositories/BudgetRepository', () => ({
  BudgetRepository: jest.fn().mockImplementation(() => mockBudgetRepo),
}));

jest.mock('../../../repositories/CostRepositories', () => ({
  CostRecordRepository: jest.fn().mockImplementation(() => mockCostRecordRepo),
  AlertRuleRepository: jest.fn().mockImplementation(() => mockAlertRuleRepo),
  ModelPricingRepository: jest.fn().mockImplementation(() => mockModelPricingRepo),
}));

import { BudgetService } from '../BudgetService';

describe('BudgetService', () => {
  let service: BudgetService;
  let mockDb: { query: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = { query: jest.fn() };
    service = new BudgetService(mockDb as any);
  });

  // ==================== Budget CRUD ====================

  describe('createBudget', () => {
    it('should create budget with repository', async () => {
      mockBudgetRepo.create.mockResolvedValue({
        id: 'b-1', name: 'Test Budget', type: 'project', scope: 'proj-1',
        period: 'monthly', amount: 1000, thresholds: { warning: 0.8, critical: 0.95, hardLimit: 1.0 },
        status: 'active', spent: 0, createdAt: new Date(), updatedAt: new Date(),
      });

      const result = await service.createBudget({
        name: 'Test Budget', type: 'project', scope: 'proj-1', period: 'monthly', amount: 1000,
      });

      expect(result).toBeDefined();
      expect(result.name).toBe('Test Budget');
      expect(mockBudgetRepo.create).toHaveBeenCalled();
    });

    it('should return budget without repository when no db', async () => {
      const serviceNoDb = new BudgetService();
      const result = await serviceNoDb.createBudget({
        name: 'Test', type: 'project', scope: 'proj-1', period: 'monthly', amount: 500,
      });

      expect(result).toBeDefined();
      expect(result.name).toBe('Test');
    });
  });

  describe('getBudgetById', () => {
    it('should return budget by id', async () => {
      mockBudgetRepo.findById.mockResolvedValue({
        id: 'b-1', name: 'Budget 1', type: 'project', scope: 'proj-1',
        period: 'monthly', amount: 1000, thresholds: {},
        status: 'active', spent: 200, createdAt: new Date(), updatedAt: new Date(),
      });

      const result = await service.getBudgetById('b-1');

      expect(result).toBeDefined();
      expect(result!.id).toBe('b-1');
    });

    it('should return undefined when not found', async () => {
      mockBudgetRepo.findById.mockResolvedValue(undefined);

      const result = await service.getBudgetById('non-existent');

      expect(result).toBeUndefined();
    });

    it('should return undefined when no repository', async () => {
      const serviceNoDb = new BudgetService();
      const result = await serviceNoDb.getBudgetById('b-1');

      expect(result).toBeUndefined();
    });
  });

  describe('listBudgets', () => {
    it('should list budgets with pagination', async () => {
      const entities = Array.from({ length: 5 }, (_, i) => ({
        id: `b-${i}`, name: `Budget ${i}`, type: 'project', scope: 'proj-1',
        period: 'monthly', amount: 1000, thresholds: {},
        status: 'active', spent: 0, createdAt: new Date(), updatedAt: new Date(),
      }));
      mockBudgetRepo.findAll.mockResolvedValue({ entities });

      const result = await service.listBudgets({ page: 1, perPage: 3 });

      expect(result.budgets).toHaveLength(3);
      expect(result.total).toBe(5);
    });

    it('should filter by type', async () => {
      mockBudgetRepo.findAll.mockResolvedValue({
        entities: [
          { id: 'b-1', type: 'project', status: 'active', thresholds: {}, spent: 0 },
          { id: 'b-2', type: 'tenant', status: 'active', thresholds: {}, spent: 0 },
        ],
      });

      const result = await service.listBudgets({ type: 'project' });

      expect(result.budgets).toHaveLength(1);
    });

    it('should filter by scope', async () => {
      mockBudgetRepo.findAll.mockResolvedValue({
        entities: [
          { id: 'b-1', type: 'project', scope: 'proj-1', status: 'active', thresholds: {}, spent: 0 },
          { id: 'b-2', type: 'project', scope: 'proj-2', status: 'active', thresholds: {}, spent: 0 },
        ],
      });

      const result = await service.listBudgets({ scope: 'proj-1' });

      expect(result.budgets).toHaveLength(1);
    });

    it('should filter by status', async () => {
      mockBudgetRepo.findAll.mockResolvedValue({
        entities: [
          { id: 'b-1', type: 'project', status: 'active', thresholds: {}, spent: 0 },
          { id: 'b-2', type: 'project', status: 'exhausted', thresholds: {}, spent: 0 },
        ],
      });

      const result = await service.listBudgets({ status: 'active' });

      expect(result.budgets).toHaveLength(1);
    });

    it('should return empty when no repository', async () => {
      const serviceNoDb = new BudgetService();
      const result = await serviceNoDb.listBudgets();

      expect(result.budgets).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('updateBudget', () => {
    it('should update budget fields', async () => {
      mockBudgetRepo.findById.mockResolvedValue({ id: 'b-1', name: 'Old', status: 'active', thresholds: {}, spent: 0 });
      mockBudgetRepo.update.mockResolvedValue({ id: 'b-1', name: 'New', status: 'active', thresholds: {}, spent: 0 });

      const result = await service.updateBudget('b-1', { name: 'New' });

      expect(result).toBeDefined();
      expect(mockBudgetRepo.update).toHaveBeenCalled();
    });

    it('should update amount and thresholds', async () => {
      mockBudgetRepo.findById.mockResolvedValue({ id: 'b-1', name: 'Budget', status: 'active', thresholds: {}, spent: 0 });
      mockBudgetRepo.update.mockResolvedValue({ id: 'b-1', name: 'Budget', status: 'active', thresholds: {}, spent: 0 });

      await service.updateBudget('b-1', { amount: 2000, thresholds: { warning: 0.7, critical: 0.9, hardLimit: 1.0 } });

      expect(mockBudgetRepo.update).toHaveBeenCalled();
    });

    it('should return undefined when budget not found', async () => {
      mockBudgetRepo.findById.mockResolvedValue(undefined);

      const result = await service.updateBudget('non-existent', { name: 'New' });

      expect(result).toBeUndefined();
    });

    it('should return undefined when no repository', async () => {
      const serviceNoDb = new BudgetService();
      const result = await serviceNoDb.updateBudget('b-1', { name: 'New' });

      expect(result).toBeUndefined();
    });
  });

  describe('deleteBudget', () => {
    it('should delete budget', async () => {
      mockBudgetRepo.delete.mockResolvedValue(true);

      const result = await service.deleteBudget('b-1');

      expect(result).toBe(true);
    });

    it('should return false when not found', async () => {
      mockBudgetRepo.delete.mockResolvedValue(false);

      const result = await service.deleteBudget('non-existent');

      expect(result).toBe(false);
    });

    it('should return false when no repository', async () => {
      const serviceNoDb = new BudgetService();
      const result = await serviceNoDb.deleteBudget('b-1');

      expect(result).toBe(false);
    });
  });

  describe('restoreBudget', () => {
    it('should restore budget to active', async () => {
      mockBudgetRepo.update.mockResolvedValue({ id: 'b-1', status: 'active', thresholds: {}, spent: 0 });

      const result = await service.restoreBudget('b-1');

      expect(result).toBeDefined();
    });

    it('should return undefined when update returns null', async () => {
      mockBudgetRepo.update.mockResolvedValue(null);

      const result = await service.restoreBudget('b-1');

      expect(result).toBeUndefined();
    });

    it('should return undefined when no repository', async () => {
      const serviceNoDb = new BudgetService();
      const result = await serviceNoDb.restoreBudget('b-1');

      expect(result).toBeUndefined();
    });
  });

  // ==================== Cost Tracking ====================

  describe('recordCost', () => {
    it('should record cost without transaction', async () => {
      mockCostRecordRepo.create.mockResolvedValue({
        id: 'cr-1', requestId: 'req-1', model: 'gpt-4', provider: 'openai',
        inputTokens: 100, outputTokens: 50, inputCost: 0.01, outputCost: 0.005,
        totalCost: 0.015, tenantId: 't1', moduleType: 'chat', timestamp: new Date(),
      });

      const result = await service.recordCost({
        requestId: 'req-1', model: 'gpt-4', provider: 'openai',
        inputTokens: 100, outputTokens: 50, inputCost: 0.01, outputCost: 0.005,
        totalCost: 0.015, tenantId: 't1', moduleType: 'chat',
      });

      expect(result).toBeDefined();
      expect(result.model).toBe('gpt-4');
      expect(mockCostRecordRepo.create).toHaveBeenCalled();
    });

    it('should record cost with transaction', async () => {
      const mockTxClient = { query: jest.fn() };
      const serviceWithTx = new BudgetService({
        query: mockDb.query,
        transaction: jest.fn().mockImplementation(async (fn: any) => fn(mockTxClient)),
      } as any);

      mockCostRecordRepo.createWithClient.mockResolvedValue({
        id: 'cr-1', requestId: 'req-1', model: 'gpt-4', provider: 'openai',
        inputTokens: 100, outputTokens: 50, inputCost: 0.01, outputCost: 0.005,
        totalCost: 0.015, tenantId: 't1', moduleType: 'chat', timestamp: new Date(),
      });

      const result = await serviceWithTx.recordCost({
        requestId: 'req-1', model: 'gpt-4', provider: 'openai',
        inputTokens: 100, outputTokens: 50, inputCost: 0.01, outputCost: 0.005,
        totalCost: 0.015, tenantId: 't1', moduleType: 'chat',
      });

      expect(result).toBeDefined();
      expect(mockCostRecordRepo.createWithClient).toHaveBeenCalled();
    });

    it('should return record without persistence when no repository', async () => {
      const serviceNoDb = new BudgetService();
      const result = await serviceNoDb.recordCost({
        requestId: 'req-1', model: 'gpt-4', provider: 'openai',
        inputTokens: 100, outputTokens: 50, inputCost: 0.01, outputCost: 0.005,
        totalCost: 0.015, moduleType: 'chat',
      });

      expect(result).toBeDefined();
      expect(result.model).toBe('gpt-4');
    });
  });

  describe('queryCosts', () => {
    it('should query costs with filter', async () => {
      mockCostRecordRepo.findAll.mockResolvedValue([{
        id: 'cr-1', requestId: 'req-1', model: 'gpt-4', provider: 'openai',
        inputTokens: 100, outputTokens: 50, inputCost: 0.01, outputCost: 0.005,
        totalCost: 0.015, tenantId: 't1', moduleType: 'chat', timestamp: new Date(),
      }]);

      const result = await service.queryCosts({ tenantId: 't1', model: 'gpt-4' });

      expect(result.records).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should use default pagination', async () => {
      mockCostRecordRepo.findAll.mockResolvedValue([]);

      await service.queryCosts();

      expect(mockCostRecordRepo.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 50, offset: 0 })
      );
    });

    it('should return empty when no repository', async () => {
      const serviceNoDb = new BudgetService();
      const result = await serviceNoDb.queryCosts();

      expect(result.records).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('getCostSummary', () => {
    it('should get cost summary from repository', async () => {
      mockCostRecordRepo.getSummary.mockResolvedValue({
        totalCost: 100.5, totalInputTokens: 10000, totalOutputTokens: 5000,
        totalRequests: 50, costByModel: { 'gpt-4': 80 }, costByProvider: { openai: 80 },
        costByTenant: { t1: 100 }, costByModule: { chat: 100 },
      });

      const result = await service.getCostSummary({ tenantId: 't1' });

      expect(result.totalCost).toBe(100.5);
      expect(result.costByModel['gpt-4']).toBe(80);
    });

    it('should return zero summary when no repository', async () => {
      const serviceNoDb = new BudgetService();
      const result = await serviceNoDb.getCostSummary();

      expect(result.totalCost).toBe(0);
      expect(result.totalRequests).toBe(0);
      expect(result.costByModel).toEqual({});
    });
  });

  // ==================== Budget Health Check ====================

  describe('checkBudgetHealth', () => {
    it('should return ok status for low usage', async () => {
      mockBudgetRepo.findById.mockResolvedValue({
        id: 'b-1', name: 'Budget 1', type: 'project', scope: 'proj-1',
        period: 'monthly', amount: 1000, thresholds: { warning: 0.8, critical: 0.95, hardLimit: 1.0 },
        status: 'active', spent: 500, createdAt: new Date(), updatedAt: new Date(),
      });

      const result = await service.checkBudgetHealth('b-1');

      expect(result.status).toBe('ok');
      expect(result.usagePercent).toBe(0.5);
      expect(result.remaining).toBe(500);
    });

    it('should return warning status when >= 80%', async () => {
      mockBudgetRepo.findById.mockResolvedValue({
        id: 'b-1', name: 'Budget 1', type: 'project', scope: 'proj-1',
        period: 'monthly', amount: 1000, thresholds: { warning: 0.8, critical: 0.95, hardLimit: 1.0 },
        status: 'active', spent: 850, createdAt: new Date(), updatedAt: new Date(),
      });

      const result = await service.checkBudgetHealth('b-1');

      expect(result.status).toBe('warning');
    });

    it('should return critical status when >= 95%', async () => {
      mockBudgetRepo.findById.mockResolvedValue({
        id: 'b-1', name: 'Budget 1', type: 'project', scope: 'proj-1',
        period: 'monthly', amount: 1000, thresholds: { warning: 0.8, critical: 0.95, hardLimit: 1.0 },
        status: 'active', spent: 960, createdAt: new Date(), updatedAt: new Date(),
      });

      const result = await service.checkBudgetHealth('b-1');

      expect(result.status).toBe('critical');
    });

    it('should return exceeded status when >= 100%', async () => {
      mockBudgetRepo.findById.mockResolvedValue({
        id: 'b-1', name: 'Budget 1', type: 'project', scope: 'proj-1',
        period: 'monthly', amount: 1000, thresholds: { warning: 0.8, critical: 0.95, hardLimit: 1.0 },
        status: 'active', spent: 1100, createdAt: new Date(), updatedAt: new Date(),
      });

      const result = await service.checkBudgetHealth('b-1');

      expect(result.status).toBe('exceeded');
    });

    it('should throw when budget not found', async () => {
      mockBudgetRepo.findById.mockResolvedValue(undefined);

      await expect(service.checkBudgetHealth('non-existent')).rejects.toThrow('not found');
    });

    it('should handle zero amount budget', async () => {
      mockBudgetRepo.findById.mockResolvedValue({
        id: 'b-1', name: 'Budget 1', type: 'project', scope: 'proj-1',
        period: 'monthly', amount: 0, thresholds: { warning: 0.8, critical: 0.95, hardLimit: 1.0 },
        status: 'active', spent: 0, createdAt: new Date(), updatedAt: new Date(),
      });

      const result = await service.checkBudgetHealth('b-1');

      expect(result.status).toBe('ok');
      expect(result.usagePercent).toBe(0);
    });
  });

  // ==================== Alert Rules ====================

  describe('createAlertRule', () => {
    it('should create alert rule', async () => {
      mockAlertRuleRepo.create.mockResolvedValue({
        id: 'ar-1', name: 'High Cost', budgetId: 'b-1', condition: 'above',
        threshold: 800, severity: 'warning', recipients: ['admin@test.com'],
        status: 'active', lastTriggered: null, createdAt: new Date(),
      });

      const result = await service.createAlertRule({
        name: 'High Cost', budgetId: 'b-1', condition: 'above',
        threshold: 800, severity: 'warning', recipients: ['admin@test.com'],
      });

      expect(result).toBeDefined();
      expect(result.name).toBe('High Cost');
      expect(mockAlertRuleRepo.create).toHaveBeenCalled();
    });

    it('should return rule without persistence when no repository', async () => {
      const serviceNoDb = new BudgetService();
      const result = await serviceNoDb.createAlertRule({
        name: 'Test Rule', condition: 'above', threshold: 100,
        severity: 'critical', recipients: ['test@test.com'],
      });

      expect(result).toBeDefined();
      expect(result.name).toBe('Test Rule');
    });
  });

  describe('listAlertRules', () => {
    it('should list all alert rules', async () => {
      mockAlertRuleRepo.findAll.mockResolvedValue([
        { id: 'ar-1', name: 'Rule 1', recipients: ['a'], status: 'active' },
        { id: 'ar-2', name: 'Rule 2', recipients: ['b'], status: 'inactive' },
      ]);

      const result = await service.listAlertRules();

      expect(result).toHaveLength(2);
    });

    it('should filter by status', async () => {
      mockAlertRuleRepo.findAll.mockResolvedValue([
        { id: 'ar-1', name: 'Rule 1', recipients: ['a'], status: 'active' },
      ]);

      const result = await service.listAlertRules('active');

      expect(result).toHaveLength(1);
    });

    it('should return empty when no repository', async () => {
      const serviceNoDb = new BudgetService();
      const result = await serviceNoDb.listAlertRules();

      expect(result).toEqual([]);
    });
  });

  describe('getActiveAlerts', () => {
    it('should return active alerts', async () => {
      mockAlertRuleRepo.findAll.mockResolvedValue([
        { id: 'ar-1', name: 'Rule 1', recipients: ['a'], status: 'active' },
      ]);

      const result = await service.getActiveAlerts();

      expect(result).toHaveLength(1);
    });
  });

  describe('updateAlertRule', () => {
    it('should update alert rule', async () => {
      mockAlertRuleRepo.update.mockResolvedValue({
        id: 'ar-1', name: 'Updated', recipients: ['a'], status: 'active',
      });

      const result = await service.updateAlertRule('ar-1', { name: 'Updated' });

      expect(result).toBeDefined();
    });

    it('should update lastTriggered mapped to last_triggered', async () => {
      const now = new Date();
      mockAlertRuleRepo.update.mockResolvedValue({
        id: 'ar-1', name: 'Rule', recipients: ['a'], status: 'active', lastTriggered: now,
      });

      await service.updateAlertRule('ar-1', { lastTriggered: now });

      expect(mockAlertRuleRepo.update).toHaveBeenCalledWith('ar-1', expect.objectContaining({ last_triggered: now }));
    });

    it('should return undefined when no repository', async () => {
      const serviceNoDb = new BudgetService();
      const result = await serviceNoDb.updateAlertRule('ar-1', { name: 'Updated' });

      expect(result).toBeUndefined();
    });
  });

  describe('deleteAlertRule', () => {
    it('should delete alert rule', async () => {
      mockAlertRuleRepo.delete.mockResolvedValue(true);

      const result = await service.deleteAlertRule('ar-1');

      expect(result).toBe(true);
    });

    it('should return false when no repository', async () => {
      const serviceNoDb = new BudgetService();
      const result = await serviceNoDb.deleteAlertRule('ar-1');

      expect(result).toBe(false);
    });
  });

  // ==================== Model Pricing ====================

  describe('addModelPricing', () => {
    it('should add model pricing', async () => {
      mockModelPricingRepo.create.mockResolvedValue({
        id: 'mp-1', provider: 'openai', model: 'gpt-4',
        inputPricePer1k: 0.03, outputPricePer1k: 0.06,
        currency: 'USD', effectiveFrom: new Date(), effectiveTo: null, notes: null,
      });

      const result = await service.addModelPricing({
        provider: 'openai', model: 'gpt-4',
        inputPricePer1k: 0.03, outputPricePer1k: 0.06, currency: 'USD',
      });

      expect(result).toBeDefined();
      expect(result.provider).toBe('openai');
    });

    it('should return pricing without persistence when no repository', async () => {
      const serviceNoDb = new BudgetService();
      const result = await serviceNoDb.addModelPricing({
        provider: 'openai', model: 'gpt-4',
        inputPricePer1k: 0.03, outputPricePer1k: 0.06, currency: 'USD',
      });

      expect(result).toBeDefined();
    });
  });

  describe('getModelPricing', () => {
    it('should get all model pricing', async () => {
      mockModelPricingRepo.findAll.mockResolvedValue([{
        id: 'mp-1', provider: 'openai', model: 'gpt-4',
        inputPricePer1k: 0.03, outputPricePer1k: 0.06,
        currency: 'USD', effectiveFrom: new Date(), effectiveTo: null, notes: null,
      }]);

      const result = await service.getModelPricing();

      expect(result).toHaveLength(1);
    });

    it('should return empty when no repository', async () => {
      const serviceNoDb = new BudgetService();
      const result = await serviceNoDb.getModelPricing();

      expect(result).toEqual([]);
    });
  });

  describe('getPricingForModel', () => {
    it('should get pricing for specific model', async () => {
      mockModelPricingRepo.findByProviderModel.mockResolvedValue({
        id: 'mp-1', provider: 'openai', model: 'gpt-4',
        inputPricePer1k: 0.03, outputPricePer1k: 0.06,
        currency: 'USD', effectiveFrom: new Date(), effectiveTo: null, notes: null,
      });

      const result = await service.getPricingForModel('openai', 'gpt-4');

      expect(result).toBeDefined();
      expect(result!.model).toBe('gpt-4');
    });

    it('should return undefined when not found', async () => {
      mockModelPricingRepo.findByProviderModel.mockResolvedValue(null);

      const result = await service.getPricingForModel('openai', 'non-existent');

      expect(result).toBeUndefined();
    });

    it('should return undefined when no repository', async () => {
      const serviceNoDb = new BudgetService();
      const result = await serviceNoDb.getPricingForModel('openai', 'gpt-4');

      expect(result).toBeUndefined();
    });
  });

  describe('deleteModelPricing', () => {
    it('should delete model pricing', async () => {
      mockModelPricingRepo.delete.mockResolvedValue(true);

      const result = await service.deleteModelPricing('mp-1');

      expect(result).toBe(true);
    });

    it('should return false when no repository', async () => {
      const serviceNoDb = new BudgetService();
      const result = await serviceNoDb.deleteModelPricing('mp-1');

      expect(result).toBe(false);
    });
  });

  // ==================== Dashboard ====================

  describe('getDashboardData', () => {
    it('should return dashboard data', async () => {
      mockCostRecordRepo.getSummary.mockResolvedValue({
        totalCost: 100, totalInputTokens: 1000, totalOutputTokens: 500,
        totalRequests: 10, costByModel: { 'gpt-4': 80 }, costByProvider: { openai: 80 },
        costByTenant: { t1: 100 }, costByModule: { chat: 100 },
      });
      mockBudgetRepo.findAll.mockResolvedValue({
        entities: [{
          id: 'b-1', name: 'Budget 1', type: 'project', scope: 'proj-1',
          period: 'monthly', amount: 1000, thresholds: { warning: 0.8, critical: 0.95, hardLimit: 1.0 },
          status: 'active', spent: 500, createdAt: new Date(), updatedAt: new Date(),
        }],
      });
      mockAlertRuleRepo.findAll.mockResolvedValue([
        { id: 'ar-1', name: 'Rule 1', recipients: ['a'], status: 'active' },
      ]);
      mockCostRecordRepo.findAll.mockResolvedValue([{
        id: 'cr-1', requestId: 'req-1', model: 'gpt-4', provider: 'openai',
        inputTokens: 100, outputTokens: 50, inputCost: 0.01, outputCost: 0.005,
        totalCost: 0.015, tenantId: 't1', moduleType: 'chat', timestamp: new Date(),
      }]);

      const result = await service.getDashboardData();

      expect(result).toBeDefined();
      expect(result.totalCost).toBe(100);
      expect(result.totalRequests).toBe(10);
      expect(result.activeBudgets).toBe(1);
      expect(result.activeAlerts).toBe(1);
      expect(result.topModels).toBeDefined();
      expect(result.recentCosts).toBeDefined();
      expect(result.budgetHealth).toBeDefined();
      expect(result.budgetHealth[0].budgetId).toBe('b-1');
      expect(result.budgetHealth[0].status).toBe('ok');
    });

    it('should return dashboard data without repository', async () => {
      const serviceNoDb = new BudgetService();
      const result = await serviceNoDb.getDashboardData();

      expect(result.totalCost).toBe(0);
      expect(result.activeBudgets).toBe(0);
      expect(result.topModels).toEqual([]);
    });

    it('should compute budget health correctly', async () => {
      mockCostRecordRepo.getSummary.mockResolvedValue({
        totalCost: 0, totalInputTokens: 0, totalOutputTokens: 0,
        totalRequests: 0, costByModel: {}, costByProvider: {},
        costByTenant: {}, costByModule: {},
      });
      mockBudgetRepo.findAll.mockResolvedValue({
        entities: [{
          id: 'b-1', name: 'Budget 1', type: 'project', scope: 'proj-1',
          period: 'monthly', amount: 1000, thresholds: { warning: 0.8, critical: 0.95, hardLimit: 1.0 },
          status: 'active', spent: 950, createdAt: new Date(), updatedAt: new Date(),
        }],
      });
      mockAlertRuleRepo.findAll.mockResolvedValue([]);
      mockCostRecordRepo.findAll.mockResolvedValue([]);

      const result = await service.getDashboardData();

      expect(result.budgetHealth[0].status).toBe('critical');
      expect(result.budgetHealth[0].usagePercent).toBe(95);
    });
  });

  // ==================== Error Propagation ====================

  describe('error propagation', () => {
    it('should propagate database errors on create', async () => {
      mockBudgetRepo.create.mockRejectedValue(new Error('Connection refused'));

      await expect(service.createBudget({
        name: 'Test', type: 'project', scope: 'proj-1', period: 'monthly', amount: 1000,
      })).rejects.toThrow('Connection refused');
    });

    it('should propagate database errors on query', async () => {
      mockCostRecordRepo.findAll.mockRejectedValue(new Error('Query timeout'));

      await expect(service.queryCosts({ tenantId: 't1' })).rejects.toThrow('Query timeout');
    });

    it('should propagate database errors on health check', async () => {
      mockBudgetRepo.findById.mockRejectedValue(new Error('Connection lost'));

      await expect(service.checkBudgetHealth('b-1')).rejects.toThrow('Connection lost');
    });
  });
});
