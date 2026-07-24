import { AlertRuleRepository, AlertRuleEntity } from '../AlertRuleRepository';

describe('AlertRuleRepository', () => {
  let repo: AlertRuleRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repo = new AlertRuleRepository(mockDb);
  });

  test('should create alert rule', async () => {
    const mockRow = {
      id: 'ar1',
      name: 'Budget Warning',
      budget_id: 'b1',
      condition: 'budget_percentage',
      threshold: 0.8,
      severity: 'warning',
      recipients: ['admin@example.com'],
      status: 'active',
      last_triggered: null,
      created_at: new Date(),
    };
    mockDb.query.mockResolvedValue({ rows: [mockRow] });
    const result = await repo.create({
      name: 'Budget Warning',
      budgetId: 'b1',
      condition: 'budget_percentage',
      threshold: 0.8,
      severity: 'warning',
      recipients: ['admin@example.com'],
    } as any);
    expect(result.name).toBe('Budget Warning');
    expect(result.threshold).toBe(0.8);
  });

  test('should find by budget id', async () => {
    mockDb.query.mockResolvedValue({
      rows: [
        { id: 'ar1', name: 'Rule 1', budget_id: 'b1', condition: 'budget_percentage', threshold: 0.8, severity: 'warning', recipients: [], status: 'active', last_triggered: null, created_at: new Date() },
        { id: 'ar2', name: 'Rule 2', budget_id: 'b1', condition: 'absolute_cost', threshold: 1000, severity: 'critical', recipients: [], status: 'active', last_triggered: null, created_at: new Date() },
      ],
    });
    const result = await repo.findByBudgetId('b1');
    expect(result.length).toBe(2);
    expect(result[0].budgetId).toBe('b1');
  });

  test('should find active rules', async () => {
    mockDb.query.mockResolvedValue({
      rows: [
        { id: 'ar1', name: 'Active Rule', budget_id: 'b1', condition: 'budget_percentage', threshold: 0.9, severity: 'critical', recipients: ['ops@example.com'], status: 'active', last_triggered: null, created_at: new Date() },
      ],
    });
    const result = await repo.findActive();
    expect(result.length).toBe(1);
    expect(result[0].status).toBe('active');
  });

  test('should update last triggered', async () => {
    mockDb.query.mockResolvedValue({ rows: [] });
    const triggeredAt = new Date('2024-01-15T10:30:00Z');
    await repo.updateLastTriggered('ar1', triggeredAt);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE alert_rules'),
      [triggeredAt, 'ar1'],
    );
  });
});