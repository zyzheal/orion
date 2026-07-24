import { SLODefinitionRepository } from '../SLODefinitionRepository';

describe('SLODefinitionRepository', () => {
  let repo: SLODefinitionRepository;
  let mockDb: any;

  const mockSloRow = (overrides: any = {}) => ({
    id: 'slo1',
    tenant_id: 't1',
    name: 'API Availability',
    description: '99.9% uptime target',
    slo_type: 'availability',
    target_value: '99.9',
    target_unit: 'percent',
    promql_query: 'up{job="api"}',
    window_days: 30,
    alert_threshold: '99.5',
    enabled: true,
    created_by: 'admin',
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  });

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repo = new SLODefinitionRepository(mockDb);
  });

  test('should create slo definition', async () => {
    mockDb.query.mockResolvedValue({ rows: [mockSloRow()], rowCount: 1 });
    const result = await repo.create({
      tenantId: 't1',
      name: 'API Availability',
      description: '99.9% uptime target',
      sloType: 'availability',
      targetValue: 99.9,
      targetUnit: 'percent',
      promqlQuery: 'up{job="api"}',
      windowDays: 30,
      alertThreshold: 99.5,
      enabled: true,
      createdBy: 'admin',
    } as any);
    expect(result.name).toBe('API Availability');
    expect(result.sloType).toBe('availability');
    expect(result.targetValue).toBe(99.9);
    expect(result.enabled).toBe(true);
  });

  test('should find slo definitions by tenant', async () => {
    mockDb.query
      .mockResolvedValueOnce({
        rows: [mockSloRow(), mockSloRow({ id: 'slo2', name: 'Latency SLO' })],
      })
      .mockResolvedValueOnce({
        rows: [{ count: '2' }],
      });
    const result = await repo.findByTenant('t1');
    expect(result.entities.length).toBe(2);
    expect(result.total).toBe(2);
    expect(result.entities[0].tenantId).toBe('t1');
  });

  test('should find slo definitions by type', async () => {
    mockDb.query.mockResolvedValue({
      rows: [mockSloRow(), mockSloRow({ id: 'slo2', name: 'Error Rate SLO' })],
    });
    const result = await repo.findByType('t1', 'availability');
    expect(result.length).toBe(2);
    expect(result[0].sloType).toBe('availability');
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('slo_type = $2'),
      ['t1', 'availability'],
    );
  });

  test('should find enabled slo definitions', async () => {
    mockDb.query.mockResolvedValue({
      rows: [mockSloRow()],
    });
    const result = await repo.findEnabled('t1');
    expect(result.length).toBe(1);
    expect(result[0].enabled).toBe(true);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('enabled = true'),
      ['t1'],
    );
  });

  test('should map snake_case row to camelCase entity', async () => {
    mockDb.query.mockResolvedValue({ rows: [mockSloRow()], rowCount: 1 });
    const result = await repo.create({
      tenantId: 't1',
      name: 'Test SLO',
      sloType: 'latency',
      targetValue: 200,
      targetUnit: 'ms',
      promqlQuery: 'histogram_quantile(0.95, ...)',
      windowDays: 7,
      alertThreshold: 250,
      enabled: false,
    } as any);
    expect(result.promqlQuery).toBe('up{job="api"}');
    expect(result.targetUnit).toBe('percent');
    expect(result.windowDays).toBe(30);
    expect(result.alertThreshold).toBe(99.5);
    expect(result.createdBy).toBe('admin');
  });
});
