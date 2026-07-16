import { BudgetRepository, BudgetEntity } from '../BudgetRepository';

describe('BudgetRepository', () => {
  let repo: BudgetRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repo = new BudgetRepository(mockDb);
  });

  test('should create budget', async () => {
    const mockRow = { id: 'b1', name: 'Monthly Budget', amount: 1000, period: 'monthly', created_at: new Date() };
    mockDb.query.mockResolvedValue({ rows: [mockRow] });
    const result = await repo.create({ name: 'Monthly Budget', amount: 1000, period: 'monthly' } as any);
    expect(result.name).toBe('Monthly Budget');
  });

  test('should find by entity', async () => {
    mockDb.query.mockResolvedValue({ rows: [{ id: 'b1', type: 'project', scope: 'p1', name: 'Budget', period: 'monthly', amount: 1000, created_at: new Date(), updated_at: new Date() }] });
    const result = await repo.findByEntity('project', 'p1');
    expect(result?.scope).toBe('p1');
  });

  test('should update spent amount', async () => {
    mockDb.query.mockResolvedValue({ rows: [{ id: 'b1', spent: 500 }] });
    await repo.updateSpent('b1', 500);
    expect(mockDb.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE'), expect.any(Array));
  });

  test('should list active budgets', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'b1', status: 'active' }] });
    mockDb.query.mockResolvedValueOnce({ rows: [{ count: '1' }] });
    const result = await repo.findAll({ where: { status: 'active' } });
    expect(result.entities.length).toBe(1);
  });

  test('should delete budget', async () => {
    mockDb.query.mockResolvedValue({ rowCount: 1 });
    const result = await repo.delete('b1');
    expect(result).toBe(true);
  });
});