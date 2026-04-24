import { AlertSuppressionRepository, AlertSuppressionRuleEntity } from '../AlertSuppressionRepository';

describe('AlertSuppressionRepository', () => {
  let repo: AlertSuppressionRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repo = new AlertSuppressionRepository(mockDb);
  });

  test('should create alert suppression rule', async () => {
    const mockRow = {
      id: 'sr1',
      tenant_id: 't1',
      name: 'Suppress CPU Alerts',
      condition: { alertName: 'HighCPU', severity: 'warning' },
      schedule: { type: 'recurring', cron: '0 22 * * *' },
      reason: 'Scheduled maintenance window',
      enabled: true,
      expires_at: new Date('2024-12-31T23:59:59Z'),
      created_at: new Date(),
    };
    mockDb.query.mockResolvedValue({ rows: [mockRow] });
    const result = await repo.create({
      tenantId: 't1',
      name: 'Suppress CPU Alerts',
      condition: { alertName: 'HighCPU', severity: 'warning' },
      schedule: { type: 'recurring', cron: '0 22 * * *' },
      reason: 'Scheduled maintenance window',
      enabled: true,
      expiresAt: new Date('2024-12-31T23:59:59Z'),
    } as any);
    expect(result.name).toBe('Suppress CPU Alerts');
    expect(result.enabled).toBe(true);
    expect(result.condition).toEqual({ alertName: 'HighCPU', severity: 'warning' });
  });

  test('should find by tenant id', async () => {
    mockDb.query.mockResolvedValue({
      rows: [
        { id: 'sr1', tenant_id: 't1', name: 'Rule 1', condition: {}, schedule: null, reason: null, enabled: true, expires_at: null, created_at: new Date() },
        { id: 'sr2', tenant_id: 't1', name: 'Rule 2', condition: {}, schedule: null, reason: null, enabled: false, expires_at: null, created_at: new Date() },
      ],
    });
    const result = await repo.findByTenantId('t1');
    expect(result.length).toBe(2);
    expect(result[0].tenantId).toBe('t1');
    expect(result[1].tenantId).toBe('t1');
  });

  test('should find enabled rules', async () => {
    mockDb.query.mockResolvedValue({
      rows: [
        { id: 'sr1', tenant_id: 't1', name: 'Enabled Rule', condition: {}, schedule: null, reason: null, enabled: true, expires_at: null, created_at: new Date() },
      ],
    });
    const result = await repo.findEnabled();
    expect(result.length).toBe(1);
    expect(result[0].enabled).toBe(true);
  });

  test('should find active rules by tenant (enabled and not expired)', async () => {
    mockDb.query.mockResolvedValue({
      rows: [
        { id: 'sr1', tenant_id: 't1', name: 'Active Rule', condition: {}, schedule: null, reason: null, enabled: true, expires_at: new Date('2025-01-01'), created_at: new Date() },
      ],
    });
    const result = await repo.findActiveByTenant('t1');
    expect(result.length).toBe(1);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('enabled = true'),
      ['t1'],
    );
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('expires_at IS NULL OR expires_at > NOW()'),
      ['t1'],
    );
  });

  test('should set enabled status', async () => {
    mockDb.query.mockResolvedValue({ rows: [] });
    await repo.setEnabled('sr1', false);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE alert_suppression_rules'),
      [false, 'sr1'],
    );
  });
});