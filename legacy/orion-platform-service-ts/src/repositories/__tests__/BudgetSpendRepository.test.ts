import { BudgetSpendRepository } from '../BudgetSpendRepository';

describe('BudgetSpendRepository', () => {
  let repo: BudgetSpendRepository;
  let mockDb: any;

  const mockSpendRow = (overrides: any = {}) => ({
    id: 'bs1',
    entity_type: 'team',
    entity_id: 'team-1',
    amount: '500.00',
    recorded_at: new Date('2024-06-15T10:00:00Z'),
    window_start: new Date('2024-06-01T00:00:00Z'),
    window_end: new Date('2024-06-30T23:59:59Z'),
    tenant_id: 't1',
    created_at: new Date(),
    ...overrides,
  });

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repo = new BudgetSpendRepository(mockDb);
  });

  test('should create budget spend record', async () => {
    mockDb.query.mockResolvedValue({ rows: [mockSpendRow()], rowCount: 1 });
    const result = await repo.create({
      entityType: 'team',
      entityId: 'team-1',
      amount: 500,
      recordedAt: new Date('2024-06-15T10:00:00Z'),
      windowStart: new Date('2024-06-01T00:00:00Z'),
      windowEnd: new Date('2024-06-30T23:59:59Z'),
      tenantId: 't1',
    } as any);
    expect(result.id).toBe('bs1');
    expect(result.entityType).toBe('team');
    expect(result.entityId).toBe('team-1');
    expect(result.amount).toBe(500);
    expect(result.tenantId).toBe('t1');
  });

  test('should find spend records by entity', async () => {
    mockDb.query.mockResolvedValue({
      rows: [
        mockSpendRow(),
        mockSpendRow({ id: 'bs2', amount: '300.00', recorded_at: new Date('2024-06-10T10:00:00Z') }),
      ],
    });
    const result = await repo.findByEntity('team', 'team-1');
    expect(result.length).toBe(2);
    expect(result[0].entityType).toBe('team');
    expect(result[0].entityId).toBe('team-1');
    expect(result[1].amount).toBe(300);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE entity_type = $1 AND entity_id = $2'),
      ['team', 'team-1'],
    );
  });

  test('should get total spend for entity', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{ total: '1500.75' }],
    });
    const result = await repo.getTotalSpend('team', 'team-1');
    expect(result).toBe(1500.75);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('SUM(amount)'),
      ['team', 'team-1'],
    );
  });

  test('should return 0 total when no spend records exist', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{ total: '0' }],
    });
    const result = await repo.getTotalSpend('project', 'proj-999');
    expect(result).toBe(0);
  });

  test('should find spend records returning empty array when none exist', async () => {
    mockDb.query.mockResolvedValue({ rows: [] });
    const result = await repo.findByEntity('team', 'nonexistent');
    expect(result.length).toBe(0);
  });
});
