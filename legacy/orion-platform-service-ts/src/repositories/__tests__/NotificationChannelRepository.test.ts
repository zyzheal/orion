import { NotificationChannelRepository } from '../NotificationChannelRepository';

describe('NotificationChannelRepository', () => {
  let repo: NotificationChannelRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repo = new NotificationChannelRepository(mockDb);
  });

  test('should create notification channel', async () => {
    const mockRow = {
      id: 'ch-1',
      tenant_id: 'tenant-1',
      name: 'Slack Alerts',
      type: 'slack',
      config: { webhookUrl: 'https://hooks.slack.com/...' },
      enabled: true,
      created_at: new Date(),
      updated_at: new Date(),
    };
    mockDb.query.mockResolvedValue({ rows: [mockRow] });

    const result = await repo.create({
      tenantId: 'tenant-1',
      name: 'Slack Alerts',
      type: 'slack',
      config: { webhookUrl: 'https://hooks.slack.com/...' },
    });

    expect(result.id).toBe('ch-1');
    expect(result.name).toBe('Slack Alerts');
    expect(result.type).toBe('slack');
    expect(result.config).toEqual({ webhookUrl: 'https://hooks.slack.com/...' });
  });

  test('should find channels by tenant', async () => {
    mockDb.query.mockResolvedValue({
      rows: [
        { id: 'ch-1', tenant_id: 'tenant-1', name: 'Slack', type: 'slack', config: {}, enabled: true, created_at: new Date(), updated_at: new Date() },
        { id: 'ch-2', tenant_id: 'tenant-1', name: 'Email', type: 'email', config: {}, enabled: true, created_at: new Date(), updated_at: new Date() },
      ],
    });

    const result = await repo.findByTenant('tenant-1');

    expect(result).toHaveLength(2);
    expect(result[0].tenantId).toBe('tenant-1');
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE tenant_id = $1'),
      ['tenant-1'],
    );
  });

  test('should find channels by type', async () => {
    mockDb.query.mockResolvedValue({
      rows: [
        { id: 'ch-1', tenant_id: 'tenant-1', name: 'Slack Alerts', type: 'slack', config: {}, enabled: true, created_at: new Date(), updated_at: new Date() },
      ],
    });

    const result = await repo.findByType('tenant-1', 'slack');

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('slack');
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('AND type = $2'),
      ['tenant-1', 'slack'],
    );
  });

  test('should update channel enabled status', async () => {
    const mockRow = {
      id: 'ch-1',
      tenant_id: 'tenant-1',
      name: 'Slack',
      type: 'slack',
      config: {},
      enabled: false,
      created_at: new Date(),
      updated_at: new Date(),
    };
    mockDb.query.mockResolvedValue({ rows: [mockRow] });

    const result = await repo.update('ch-1', { enabled: false });

    expect(result.enabled).toBe(false);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE notification_channels'),
      [false, 'ch-1', expect.any(String)],
    );
  });
});