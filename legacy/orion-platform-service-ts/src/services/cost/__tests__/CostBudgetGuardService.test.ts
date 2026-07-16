/**
 * Tests for CostBudgetGuardService
 */

import { CostBudgetGuardService, BudgetGuardAction, BudgetGuardStatus } from '../CostBudgetGuardService';

// Mock DatabasePool
const mockDb = {
  query: jest.fn(),
};

function makeGuard(overrides: Partial<any> = {}) {
  return {
    id: 'guard-001',
    tenant_id: 'tenant-001',
    name: 'Production Budget',
    description: null,
    budget_amount: 1000,
    currency: 'USD',
    action: BudgetGuardAction.WARN,
    scope: null,
    status: BudgetGuardStatus.ACTIVE,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

describe('CostBudgetGuardService', () => {
  let service: CostBudgetGuardService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.query.mockResolvedValue({ rows: [] }); // ensureTable
    service = new CostBudgetGuardService(mockDb as any);
  });

  // ==================== createBudgetGuard ====================

  describe('createBudgetGuard', () => {
    it('should create a budget guard with default currency', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await service.createBudgetGuard('tenant-001', {
        name: 'Production Budget',
        budgetAmount: 1000,
        action: BudgetGuardAction.WARN,
      });

      expect(result.id).toMatch(/^budget_guard_/);
      expect(result.tenantId).toBe('tenant-001');
      expect(result.name).toBe('Production Budget');
      expect(result.budgetAmount).toBe(1000);
      expect(result.currency).toBe('USD');
      expect(result.action).toBe(BudgetGuardAction.WARN);
      expect(result.status).toBe(BudgetGuardStatus.ACTIVE);
    });

    it('should create a budget guard with BLOCK action', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await service.createBudgetGuard('tenant-001', {
        name: 'Hard Limit',
        budgetAmount: 500,
        action: BudgetGuardAction.BLOCK,
      });

      expect(result.action).toBe(BudgetGuardAction.BLOCK);
    });

    it('should create a budget guard with custom currency', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await service.createBudgetGuard('tenant-001', {
        name: 'EU Budget',
        budgetAmount: 800,
        currency: 'EUR',
        action: BudgetGuardAction.WARN,
      });

      expect(result.currency).toBe('EUR');
    });

    it('should create a guard with scope', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await service.createBudgetGuard('tenant-001', {
        name: 'Project Budget',
        budgetAmount: 2000,
        action: BudgetGuardAction.BLOCK,
        scope: {
          projectIds: ['proj-001', 'proj-002'],
          environment: 'production',
        },
      });

      expect(result.scope).toEqual({
        projectIds: ['proj-001', 'proj-002'],
        environment: 'production',
      });
    });

    it('should use default values for optional fields', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await service.createBudgetGuard('tenant-001', {
        name: 'Simple Budget',
        budgetAmount: 100,
        action: BudgetGuardAction.WARN,
      });

      expect(result.description).toBeNull();
      expect(result.scope).toBeNull();
    });
  });

  // ==================== evaluateCostGuard ====================

  describe('evaluateCostGuard', () => {
    it('should allow when no active guards configured', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] }); // getBudgetGuards

      const result = await service.evaluateCostGuard('pipe-001', 50);

      expect(result.passed).toBe(true);
      expect(result.action).toBe(BudgetGuardAction.ALLOW);
      expect(result.matchedGuard).toBeNull();
      expect(result.message).toContain('No active budget guards');
    });

    it('should pass when cost is within budget (WARN action)', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [makeGuard({ action: 'warn' })] });
      mockDb.query.mockResolvedValue({ rows: [] }); // logEvaluation

      const result = await service.evaluateCostGuard('pipe-001', 500, {
        tenantId: 'tenant-001',
      });

      expect(result.passed).toBe(true);
      expect(result.action).toBe(BudgetGuardAction.WARN);
      expect(result.estimatedCost).toBe(500);
      expect(result.budgetAmount).toBe(1000);
      expect(result.usagePercent).toBe(50);
    });

    it('should pass with WARN action when cost is within budget', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [makeGuard({ action: 'warn' })] });
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await service.evaluateCostGuard('pipe-001', 800, {
        tenantId: 'tenant-001',
      });

      expect(result.passed).toBe(true);
      expect(result.action).toBe(BudgetGuardAction.WARN);
      expect(result.usagePercent).toBe(80);
    });

    it('should fail when cost exceeds budget with BLOCK action', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [makeGuard({ action: 'block' })] });
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await service.evaluateCostGuard('pipe-001', 1500, {
        tenantId: 'tenant-001',
      });

      expect(result.passed).toBe(false);
      expect(result.action).toBe(BudgetGuardAction.BLOCK);
      expect(result.usagePercent).toBe(150);
      expect(result.message).toContain('exceeds budget');
      expect(result.message).toContain('BLOCK');
    });

    it('should fail when cost exceeds budget with WARN action', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [makeGuard({ action: 'warn' })] });
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await service.evaluateCostGuard('pipe-001', 1200, {
        tenantId: 'tenant-001',
      });

      expect(result.passed).toBe(false);
      expect(result.action).toBe(BudgetGuardAction.WARN);
    });

    it('should skip inactive guards', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [
        makeGuard({ status: BudgetGuardStatus.INACTIVE }),
      ]});

      const result = await service.evaluateCostGuard('pipe-001', 5000, {
        tenantId: 'tenant-001',
      });

      expect(result.passed).toBe(true);
      expect(result.matchedGuard).toBeNull();
    });

    it('should match guard by project ID scope', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [
        makeGuard({
          scope: JSON.stringify({ projectIds: ['proj-001'], environment: null }),
        }),
      ]});

      const result = await service.evaluateCostGuard('pipe-001', 500, {
        tenantId: 'tenant-001',
        projectId: 'proj-001',
      });

      expect(result.matchedGuard).not.toBeNull();
    });

    it('should match guard by environment scope', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [
        makeGuard({
          scope: JSON.stringify({ projectIds: [], environment: 'production' }),
        }),
      ]});

      const result = await service.evaluateCostGuard('pipe-001', 500, {
        tenantId: 'tenant-001',
        environment: 'production',
      });

      expect(result.matchedGuard).not.toBeNull();
    });

    it('should fallback to first guard when scope does not match', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [
        makeGuard({
          scope: JSON.stringify({ projectIds: ['proj-999'], environment: null }),
        }),
      ]});

      const result = await service.evaluateCostGuard('pipe-001', 500, {
        tenantId: 'tenant-001',
        projectId: 'proj-001',
      });

      // Should fallback to first guard
      expect(result.matchedGuard).not.toBeNull();
    });

    it('should use default tenant when not specified', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.evaluateCostGuard('pipe-001', 100);

      expect(result.passed).toBe(true);
    });

    it('should handle zero budget amount', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [makeGuard({ budget_amount: 0 })] });
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await service.evaluateCostGuard('pipe-001', 50, {
        tenantId: 'tenant-001',
      });

      expect(result.usagePercent).toBe(0); // division by zero protection
    });
  });

  // ==================== getBudgetGuards ====================

  describe('getBudgetGuards', () => {
    it('should return budget guards for tenant', async () => {
      const row = {
        id: 'guard-001',
        tenant_id: 'tenant-001',
        name: 'Test Guard',
        description: 'Test',
        budget_amount: 500,
        currency: 'USD',
        action: 'warn',
        scope: null,
        status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
      };
      mockDb.query.mockResolvedValueOnce({ rows: [row] });

      const result = await service.getBudgetGuards('tenant-001');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Test Guard');
      expect(result[0].budgetAmount).toBe(500);
    });

    it('should parse JSONB scope', async () => {
      const row = {
        id: 'guard-001',
        tenant_id: 'tenant-001',
        name: 'Scoped Guard',
        description: null,
        budget_amount: 1000,
        currency: 'USD',
        action: 'block',
        scope: JSON.stringify({ projectIds: ['p1'], environment: 'prod' }),
        status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
      };
      mockDb.query.mockResolvedValueOnce({ rows: [row] });

      const result = await service.getBudgetGuards('tenant-001');

      expect(result[0].scope).toEqual({ projectIds: ['p1'], environment: 'prod' });
    });

    it('should return empty array when no guards', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.getBudgetGuards('tenant-001');

      expect(result).toHaveLength(0);
    });
  });

  // ==================== deleteBudgetGuard ====================

  describe('deleteBudgetGuard', () => {
    it('should delete a budget guard', async () => {
      mockDb.query.mockResolvedValueOnce({ rowCount: 1 });

      const result = await service.deleteBudgetGuard('guard-001', 'tenant-001');

      expect(result).toBe(true);
    });

    it('should return false for non-existent guard', async () => {
      mockDb.query.mockResolvedValueOnce({ rowCount: 0 });

      const result = await service.deleteBudgetGuard('non-existent', 'tenant-001');

      expect(result).toBe(false);
    });
  });
});
