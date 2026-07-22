/**
 * ConfigRepository 单元测试
 */

import { ConfigRepository, ConfigEntity } from '../ConfigRepository';

describe('ConfigRepository', () => {
  let repo: ConfigRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repo = new ConfigRepository(mockDb);
  });

  test('should create config', async () => {
    const mockRow = {
      id: 'config-1',
      key: 'database.url',
      value: { host: 'localhost', port: 5432 },
      namespace: 'production',
      tenant_id: 'tenant-1',
      description: 'Database connection',
      created_at: new Date(),
      updated_at: new Date(),
    };
    mockDb.query.mockResolvedValue({ rows: [mockRow] });

    const result = await repo.createConfig({
      key: 'database.url',
      value: { host: 'localhost', port: 5432 },
      scope: 'production',
      scopeId: 'tenant-1',
      description: 'Database connection',
    });

    expect(result.key).toBe('database.url');
    expect(result.scope).toBe('production');
    expect(result.scopeId).toBe('tenant-1');
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO configs'),
      expect.arrayContaining(['database.url', expect.any(String), 'production', 'tenant-1', 'Database connection']),
    );
  });

  test('should find config by key', async () => {
    const mockRow = {
      id: 'config-1',
      key: 'api.timeout',
      value: { default: 30000, max: 60000 },
      namespace: 'production',
      tenant_id: 'tenant-1',
      description: 'API timeout settings',
      created_at: new Date(),
      updated_at: new Date(),
    };
    mockDb.query.mockResolvedValue({ rows: [mockRow] });

    const result = await repo.findByKey('api.timeout', 'production', 'tenant-1');

    expect(result?.key).toBe('api.timeout');
    expect(result?.scope).toBe('production');
    expect(result?.value.default).toBe(30000);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE key = $1'),
      expect.arrayContaining(['api.timeout', 'production', 'tenant-1']),
    );
  });

  test('should find configs by scope', async () => {
    const mockRows = [
      {
        id: 'config-1',
        key: 'api.timeout',
        value: { default: 30000 },
        namespace: 'production',
        tenant_id: 'tenant-1',
        description: 'API timeout',
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 'config-2',
        key: 'api.retries',
        value: { max: 3 },
        namespace: 'production',
        tenant_id: 'tenant-1',
        description: 'API retries',
        created_at: new Date(),
        updated_at: new Date(),
      },
    ];
    mockDb.query.mockResolvedValue({ rows: mockRows });

    const result = await repo.findByScope('production', 'tenant-1');

    expect(result).toHaveLength(2);
    expect(result[0].scope).toBe('production');
    expect(result[1].scope).toBe('production');
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE namespace = $1'),
      ['production', 'tenant-1'],
    );
  });

  test('should update config value', async () => {
    const mockRow = {
      id: 'config-1',
      key: 'api.timeout',
      value: { default: 60000, max: 120000 },
      namespace: 'production',
      tenant_id: 'tenant-1',
      description: 'API timeout settings',
      created_at: new Date(),
      updated_at: new Date(),
    };
    mockDb.query.mockResolvedValue({ rows: [mockRow] });

    const result = await repo.updateValue('config-1', { default: 60000, max: 120000 });

    expect(result.value.default).toBe(60000);
    expect(result.value.max).toBe(120000);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE configs SET value = $1'),
      [expect.any(String), 'config-1'],
    );
  });
});