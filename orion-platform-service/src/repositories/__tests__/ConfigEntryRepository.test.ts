import { ConfigEntryRepository } from '../ConfigEntryRepository';

describe('ConfigEntryRepository', () => {
  let repo: ConfigEntryRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repo = new ConfigEntryRepository(mockDb);
  });

  test('should find config entries by tenant id', async () => {
    const mockRows = [
      { id: 'cfg-1', tenant_id: 't1', key: 'app.name', value: '{"v":"orion"}', version: 1, environment: 'default', status: 'active', description: null, encrypted: false, tags: '[]', created_by: null, updated_by: null, created_at: new Date(), updated_at: new Date() },
      { id: 'cfg-2', tenant_id: 't1', key: 'app.debug', value: '{"v":true}', version: 1, environment: 'default', status: 'active', description: null, encrypted: false, tags: '[]', created_by: null, updated_by: null, created_at: new Date(), updated_at: new Date() },
    ];
    mockDb.query.mockResolvedValue({ rows: mockRows, rowCount: 2 });

    const result = await repo.findByTenantId('t1');
    expect(result.length).toBe(2);
    expect(result[0].tenant_id).toBe('t1');
    expect(result[0].key).toBe('app.name');
    expect(result[0].value).toEqual({ v: 'orion' });
  });

  test('should find config entry by key', async () => {
    const mockRow = {
      id: 'cfg-1',
      tenant_id: 't1',
      key: 'db.host',
      value: '"localhost"',
      version: 2,
      environment: 'production',
      status: 'active',
      description: 'Database host',
      encrypted: false,
      tags: '["infra"]',
      created_by: 'admin',
      updated_by: 'admin',
      created_at: new Date(),
      updated_at: new Date(),
    };
    mockDb.query.mockResolvedValue({ rows: [mockRow], rowCount: 1 });

    const result = await repo.findByKey('t1', 'db.host');
    expect(result).toBeDefined();
    expect(result!.key).toBe('db.host');
    expect(result!.version).toBe(2);
    expect(result!.tags).toEqual(['infra']);
  });

  test('should return undefined when key not found', async () => {
    mockDb.query.mockResolvedValue({ rows: [], rowCount: 0 });

    const result = await repo.findByKey('t1', 'nonexistent.key');
    expect(result).toBeUndefined();
  });

  test('should upsert config entry', async () => {
    const mockRow = {
      id: 'cfg-1',
      tenant_id: 't1',
      key: 'feature.toggle',
      value: '{"enabled":true}',
      version: 1,
      environment: 'default',
      status: 'active',
      description: null,
      encrypted: false,
      tags: '[]',
      created_by: null,
      updated_by: null,
      created_at: new Date(),
      updated_at: new Date(),
    };
    mockDb.query.mockResolvedValue({ rows: [mockRow], rowCount: 1 });

    const result = await repo.upsert('t1', 'feature.toggle', { enabled: true });
    expect(result).toBeDefined();
    expect(result.key).toBe('feature.toggle');
    expect(result.value).toEqual({ enabled: true });
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT'),
      expect.arrayContaining(['t1', 'feature.toggle', { enabled: true }]),
    );
  });

  test('should find config history', async () => {
    const mockRows = [
      { id: 'hist-1', config_id: 'cfg-1', old_value: '{"v":1}', new_value: '{"v":2}', changed_by: 'admin', change_log: 'bump version', version: 2, created_at: new Date() },
      { id: 'hist-2', config_id: 'cfg-1', old_value: null, new_value: '{"v":1}', changed_by: 'admin', change_log: 'initial', version: 1, created_at: new Date() },
    ];
    mockDb.query.mockResolvedValue({ rows: mockRows, rowCount: 2 });

    const result = await repo.findHistory('cfg-1');
    expect(result.length).toBe(2);
    expect(result[0].config_id).toBe('cfg-1');
    expect(result[0].version).toBe(2);
    expect(result[0].changed_by).toBe('admin');
  });

  test('should delete config entry by key', async () => {
    mockDb.query.mockResolvedValue({ rows: [], rowCount: 1 });

    const result = await repo.deleteByKey('t1', 'old.key');
    expect(result).toBe(true);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM config_entries'),
      ['t1', 'old.key'],
    );
  });
});
