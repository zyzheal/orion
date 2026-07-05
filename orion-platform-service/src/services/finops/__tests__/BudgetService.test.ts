/**
 * TASK-502: BudgetService 单元测试
 */

import { BudgetService } from '../BudgetService';

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
        let rows = store[table] || [];
        // Apply simple WHERE filters
        if (params && params.length > 0 && text.includes('WHERE')) {
          const whereParts = text.split('WHERE')[1];
          if (whereParts) {
            const conditions = whereParts.split('AND').map(c => c.trim());
            let paramIdx = 0;
            for (const cond of conditions) {
              if (cond.includes('COUNT') || cond.includes('ORDER') || cond.includes('LIMIT')) continue;
              const colMatch = cond.match(/(\w+)\s*=\s*\$(\d+)/);
              if (colMatch) {
                const col = colMatch[1];
                const val = params[paramIdx];
                rows = rows.filter(r => String(r[col]) === String(val));
                paramIdx++;
              }
            }
          }
        }
        return { rows: [{ count: String(rows.length) }], rowCount: 1 };
      }
      // SUM
      if (text.includes('SUM(')) {
        const table = text.match(/FROM (\w+)/)?.[1] || 'unknown';
        let rows = store[table] || [];
        if (params && params.length >= 2) {
          rows = rows.filter(r => r.entity_type === params[0] && r.entity_id === params[1]);
        }
        const total = rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
        return { rows: [{ total: String(total) }], rowCount: 1 };
      }
      // SELECT by id (with or without tenant_id)
      if (text.includes('WHERE id = $1')) {
        const table = text.match(/FROM (\w+)/)?.[1] || 'unknown';
        let rows = (store[table] || []).filter(r => r.id === params?.[0]);
        // If there's a tenant_id filter, apply it
        if (text.includes('AND tenant_id = $2') && params?.[1] !== undefined && params[1] !== null) {
          rows = rows.filter(r => String(r.tenant_id) === String(params[1]));
        }
        return { rows, rowCount: rows.length };
      }
      // SELECT by entity_type and entity_id
      if (text.includes('WHERE entity_type = $1 AND entity_id = $2')) {
        const table = text.match(/FROM (\w+)/)?.[1] || 'unknown';
        const rows = (store[table] || []).filter(r => r.entity_type === params?.[0] && r.entity_id === params?.[1]);
        return { rows, rowCount: rows.length };
      }
      // SELECT by budget_id
      if (text.includes('WHERE budget_id = $1')) {
        const table = text.match(/FROM (\w+)/)?.[1] || 'unknown';
        const rows = (store[table] || []).filter(r => r.budget_id === params?.[0]);
        return { rows, rowCount: rows.length };
      }
      // SELECT by entity_type
      if (text.includes('WHERE entity_type = $1')) {
        const table = text.match(/FROM (\w+)/)?.[1] || 'unknown';
        const rows = (store[table] || []).filter(r => r.entity_type === params?.[0]);
        return { rows, rowCount: rows.length };
      }
      // SELECT by provider
      if (text.includes('WHERE provider = $1')) {
        const table = text.match(/FROM (\w+)/)?.[1] || 'unknown';
        const rows = (store[table] || []).filter(r => r.provider === params?.[0]);
        return { rows, rowCount: rows.length };
      }
      // SELECT all (with optional WHERE, ORDER, LIMIT)
      if (text.includes('SELECT * FROM')) {
        const table = text.match(/FROM (\w+)/)?.[1] || 'unknown';
        let rows = [...(store[table] || [])];
        // Apply WHERE filters if present
        if (text.includes('WHERE') && params && params.length > 0) {
          const whereClause = text.split('WHERE')[1]?.split('ORDER BY')[0]?.split('LIMIT')[0] || '';
          const conditions = whereClause.split('AND').map(c => c.trim()).filter(c => c && !c.startsWith('1=1'));
          let paramIdx = 0;
          for (const cond of conditions) {
            if (cond.includes('COUNT') || cond.includes('ORDER') || cond.includes('LIMIT')) continue;
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
      // UPDATE (with tenant_id in WHERE)
      if (text.includes('UPDATE')) {
        const table = text.match(/UPDATE (\w+)/)?.[1] || 'unknown';
        const rows = store[table] || [];
        // Find the row by id (and optionally tenant_id)
        const idParamIdx = params ? params.length - (text.includes('AND tenant_id') ? 2 : 1) : -1;
        const id = idParamIdx >= 0 ? params![idParamIdx] : null;
        const idx = rows.findIndex(r => r.id === id);
        if (idx >= 0) {
          // Parse SET values
          const setMatch = text.match(/SET (.+?) WHERE/);
          if (setMatch && params) {
            const setPart = setMatch[1];
            const assignments = setPart.split(',').map(s => s.trim());
            let paramIdx = 0;
            for (const assignment of assignments) {
              const colMatch = assignment.match(/^(\w+)\s*=/);
              if (colMatch) {
                const col = colMatch[1];
                if (col === 'updated_at' && assignment.includes('NOW()')) {
                  rows[idx][col] = new Date();
                } else {
                  rows[idx][col] = params[paramIdx];
                  paramIdx++;
                }
              }
            }
          }
          rows[idx].updated_at = new Date();
          return { rows: [rows[idx]], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }
      // DELETE (with or without tenant_id)
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

describe('BudgetService', () => {
  let service: BudgetService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    service = new BudgetService(mockDb as any);
  });

  // ==================== Create Budget ====================

  describe('createBudget', () => {
    it('should create a budget with default thresholds', async () => {
      const budget = await service.createBudget({
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
      expect(budget.alerts.length).toBe(4);
      expect(budget.alerts[0].percentage).toBe(50);
      expect(budget.alerts[0].triggered).toBe(false);
    });

    it('should create a budget with custom thresholds', async () => {
      const budget = await service.createBudget({
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

    it('should include optional fields', async () => {
      const budget = await service.createBudget({
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

    beforeEach(async () => {
      const budget = await service.createBudget({
        entityType: 'project',
        entityId: 'proj-001',
        amount: 5000,
        period: 'monthly',
      });
      budgetId = budget.id;
    });

    it('should update budget amount', async () => {
      const updated = await service.updateBudget(budgetId, { amount: 8000 });

      expect(updated).not.toBeNull();
      expect(updated!.amount).toBe(8000);
    });

    it('should return null for non-existent budget', async () => {
      const updated = await service.updateBudget('non-existent', { amount: 1000 });
      expect(updated).toBeNull();
    });

    it('should set updatedAt', async () => {
      const updated = await service.updateBudget(budgetId, { amount: 6000 });

      expect(updated!.updatedAt).toBeDefined();
    });
  });

  // ==================== Delete Budget ====================

  describe('deleteBudget', () => {
    it('should delete an existing budget', async () => {
      const budget = await service.createBudget({
        entityType: 'project',
        entityId: 'proj-001',
        amount: 5000,
        period: 'monthly',
      });

      const deleted = await service.deleteBudget(budget.id);
      expect(deleted).toBe(true);
    });

    it('should return false for non-existent budget', async () => {
      const deleted = await service.deleteBudget('non-existent');
      expect(deleted).toBe(false);
    });
  });

  // ==================== Get/List Budgets ====================

  describe('listBudgets', () => {
    it('should return budgets from DB', async () => {
      await service.createBudget({
        entityType: 'project',
        entityId: 'proj-001',
        amount: 5000,
        period: 'monthly',
      });

      const budgets = await service.listBudgets();
      expect(budgets.length).toBe(1);
    });
  });

  // ==================== Update Entity Spend ====================

  describe('updateEntitySpend', () => {
    it('should record entity spend to DB', async () => {
      await service.updateEntitySpend('project', 'proj-001', 1000);

      expect(mockDb.query).toHaveBeenCalled();
    });
  });

  // ==================== Check Budget Alerts ====================

  describe('checkBudgetAlerts', () => {
    it('should return empty when no budgets configured', async () => {
      const triggered = await service.checkBudgetAlerts();
      expect(triggered.length).toBe(0);
    });
  });

  // ==================== Budget Status ====================

  describe('getBudgetStatus', () => {
    it('should return null for non-existent budget', async () => {
      const status = await service.getBudgetStatus('non-existent');
      expect(status).toBeNull();
    });
  });

  // ==================== Budget Forecast ====================

  describe('forecastBudget', () => {
    it('should return null for non-existent budget', async () => {
      const forecast = await service.forecastBudget('non-existent');
      expect(forecast).toBeNull();
    });
  });

  // ==================== Alert Triggers ====================

  describe('getAlertTriggers', () => {
    it('should return triggers from DB', async () => {
      const triggers = await service.getAlertTriggers();
      expect(Array.isArray(triggers)).toBe(true);
    });
  });
});
