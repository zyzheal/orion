/**
 * ConfigRepository Unit Tests
 *
 * Tests for in-memory mode, repository mode, and direct SQL mode.
 * Covers CRUD operations, query filtering, history retrieval, and error handling.
 */

import { ConfigRepository, ConfigEntry, ConfigHistory } from '../ConfigRepository';

// --- Mock helpers ---

function createMockPool(rows: any[] = [], rowCount: number | null = null) {
  return {
    query: jest.fn().mockResolvedValue({ rows, rowCount: rowCount ?? rows.length }),
  } as any;
}

function createMockRepo(overrides: Record<string, jest.Mock> = {}) {
  return {
    findById: jest.fn(),
    findByKey: jest.fn(),
    findByTenantId: jest.fn(),
    upsert: jest.fn(),
    updateByKey: jest.fn(),
    deleteByKey: jest.fn(),
    findHistory: jest.fn(),
    findHistoryByKey: jest.fn(),
    ...overrides,
  } as any;
}

function makeEntry(overrides: Partial<ConfigEntry> = {}): ConfigEntry {
  return {
    id: 'entry-1',
    tenant_id: 'tenant-1',
    key: 'database.url',
    value: { host: 'localhost' },
    version: 1,
    environment: 'default',
    status: 'active',
    description: undefined,
    encrypted: false,
    tags: [],
    created_by: undefined,
    updated_by: undefined,
    createdBy: undefined,
    updatedBy: undefined,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01'),
    ...overrides,
  };
}

function makeEntity(overrides: Record<string, any> = {}) {
  return {
    id: 'entry-1',
    tenant_id: 'tenant-1',
    key: 'database.url',
    value: { host: 'localhost' },
    version: 1,
    environment: 'default',
    status: 'active',
    description: undefined,
    encrypted: false,
    tags: [],
    created_by: 'admin',
    updated_by: 'admin',
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01'),
    ...overrides,
  };
}

function makeHistoryEntity(overrides: Record<string, any> = {}) {
  return {
    id: 'hist-1',
    config_id: 'entry-1',
    old_value: { host: 'old' },
    new_value: { host: 'new' },
    changed_by: 'admin',
    change_log: 'Updated',
    version: 2,
    created_at: new Date('2026-01-02'),
    ...overrides,
  };
}

// =========================================================================
// In-Memory Mode Tests (no pool)
// =========================================================================

describe('ConfigRepository (in-memory mode)', () => {
  let repo: ConfigRepository;

  beforeEach(() => {
    repo = new ConfigRepository();
  });

  describe('constructor', () => {
    it('should create repository without pool', () => {
      expect(repo).toBeInstanceOf(ConfigRepository);
    });
  });

  describe('findById', () => {
    it('should return null when no entries exist', async () => {
      const result = await repo.findById('non-existent');
      expect(result).toBeNull();
    });

    it('should find entry by id after set', async () => {
      await repo.set('tenant-1', 'app.name', { value: 'orion' });
      const all = await repo.findAll('tenant-1');
      const found = await repo.findById(all[0].id);
      expect(found).not.toBeNull();
      expect(found!.key).toBe('app.name');
    });

    it('should return null for mismatched id', async () => {
      await repo.set('tenant-1', 'app.name', { value: 'orion' });
      const found = await repo.findById('wrong-id');
      expect(found).toBeNull();
    });
  });

  describe('findByKey', () => {
    it('should return null when no entries match', async () => {
      const result = await repo.findByKey('tenant-1', 'missing.key');
      expect(result).toBeNull();
    });

    it('should find entry by tenant and key', async () => {
      await repo.set('tenant-1', 'database.url', { value: 'postgres://localhost' });
      const found = await repo.findByKey('tenant-1', 'database.url');
      expect(found).not.toBeNull();
      expect(found!.key).toBe('database.url');
      expect(found!.tenant_id).toBe('tenant-1');
    });

    it('should not find entry from different tenant', async () => {
      await repo.set('tenant-1', 'database.url', { value: 'postgres://localhost' });
      const found = await repo.findByKey('tenant-2', 'database.url');
      expect(found).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should return empty array when no entries exist', async () => {
      const result = await repo.findAll('tenant-1');
      expect(result).toEqual([]);
    });

    it('should return all entries for a tenant', async () => {
      await repo.set('tenant-1', 'key1', { value: 'v1' });
      await repo.set('tenant-1', 'key2', { value: 'v2' });
      const result = await repo.findAll('tenant-1');
      expect(result.length).toBe(2);
    });

    it('should not return entries from other tenants', async () => {
      await repo.set('tenant-1', 'key1', { value: 'v1' });
      await repo.set('tenant-2', 'key2', { value: 'v2' });
      const result = await repo.findAll('tenant-1');
      expect(result.length).toBe(1);
      expect(result[0].key).toBe('key1');
    });
  });

  describe('set', () => {
    it('should create a new entry', async () => {
      const entry = await repo.set('tenant-1', 'database.url', {
        value: 'postgres://localhost',
        environment: 'dev',
      });

      expect(entry.id).toBeDefined();
      expect(entry.key).toBe('database.url');
      expect(entry.tenant_id).toBe('tenant-1');
      expect(entry.version).toBe(1);
      expect(entry.status).toBe('active');
      expect(entry.environment).toBe('dev');
    });

    it('should use undefined environment when not provided in value', async () => {
      const entry = await repo.set('tenant-1', 'app.name', { value: 'orion' });
      // environment is extracted from value.environment, which is undefined when not set
      // internally the key uses 'default' via `value.environment || 'default'`
      expect(entry.environment).toBeUndefined();
    });

    it('should increment version on update of same key', async () => {
      const first = await repo.set('tenant-1', 'database.url', { value: 'v1', environment: 'dev' });
      const second = await repo.set('tenant-1', 'database.url', { value: 'v2', environment: 'dev' });

      expect(first.version).toBe(1);
      expect(second.version).toBe(2);
      expect(second.id).toBe(first.id);
    });

    it('should preserve created_at on update', async () => {
      const first = await repo.set('tenant-1', 'database.url', { value: 'v1', environment: 'dev' });
      const second = await repo.set('tenant-1', 'database.url', { value: 'v2', environment: 'dev' });

      expect(second.created_at).toEqual(first.created_at);
      expect(second.createdAt).toEqual(first.createdAt);
    });

    it('should extract environment, description, encrypted, tags from value', async () => {
      const entry = await repo.set('tenant-1', 'app.config', {
        host: 'localhost',
        environment: 'prod',
        description: 'Production config',
        encrypted: true,
        tags: ['database', 'primary'],
      });

      expect(entry.environment).toBe('prod');
      expect(entry.description).toBe('Production config');
      expect(entry.encrypted).toBe(true);
      expect(entry.tags).toEqual(['database', 'primary']);
    });

    it('should create different entries for same key in different environments', async () => {
      const dev = await repo.set('tenant-1', 'db.url', { value: 'dev-db', environment: 'dev' });
      const prod = await repo.set('tenant-1', 'db.url', { value: 'prod-db', environment: 'prod' });

      expect(dev.id).not.toBe(prod.id);
      expect(dev.version).toBe(1);
      expect(prod.version).toBe(1);
    });
  });

  describe('updateByKey', () => {
    it('should update existing entry by key', async () => {
      await repo.set('tenant-1', 'database.url', { value: 'old', environment: 'dev' });
      const updated = await repo.updateByKey('database.url', { value: 'new' });

      expect(updated).not.toBeNull();
      expect(updated!.value).toEqual({ value: 'new' });
      expect(updated!.version).toBe(2);
    });

    it('should return null when key does not exist', async () => {
      const result = await repo.updateByKey('missing.key', { value: 'v' });
      expect(result).toBeNull();
    });

    it('should update the updated_at timestamp', async () => {
      await repo.set('tenant-1', 'database.url', { value: 'old', environment: 'dev' });
      const before = new Date();
      const updated = await repo.updateByKey('database.url', { value: 'new' });

      expect(updated!.updated_at.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(updated!.updatedAt!.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });
  });

  describe('delete', () => {
    it('should delete entry by tenant and key', async () => {
      await repo.set('tenant-1', 'database.url', { value: 'v', environment: 'dev' });
      const deleted = await repo.delete('tenant-1', 'database.url');

      expect(deleted).toBe(true);
      const found = await repo.findByKey('tenant-1', 'database.url');
      expect(found).toBeNull();
    });

    it('should return false when entry does not exist', async () => {
      const deleted = await repo.delete('tenant-1', 'missing.key');
      expect(deleted).toBe(false);
    });

    it('should not delete entries from other tenants', async () => {
      await repo.set('tenant-1', 'database.url', { value: 'v1', environment: 'dev' });
      await repo.set('tenant-2', 'database.url', { value: 'v2', environment: 'dev' });

      await repo.delete('tenant-1', 'database.url');

      const remaining = await repo.findAll('tenant-2');
      expect(remaining.length).toBe(1);
    });
  });

  describe('getHistory', () => {
    it('should return empty array in memory mode', async () => {
      const history = await repo.getHistory('tenant-1', 'database.url');
      expect(history).toEqual([]);
    });

    it('should respect limit parameter', async () => {
      const history = await repo.getHistory('tenant-1', 'key', 5);
      expect(history).toEqual([]);
    });
  });

  describe('getHistoryByConfigId', () => {
    it('should return empty array in memory mode', async () => {
      const history = await repo.getHistoryByConfigId('config-1');
      expect(history).toEqual([]);
    });
  });
});

// =========================================================================
// Repository Mode Tests (pool + repo mock)
// =========================================================================

describe('ConfigRepository (repository mode)', () => {
  let repo: ConfigRepository;
  let mockPool: any;
  let mockRepo: any;

  beforeEach(() => {
    mockPool = createMockPool();
    mockRepo = createMockRepo();
    repo = new ConfigRepository(mockPool);
    // Inject mock repo
    (repo as any).repo = mockRepo;
  });

  describe('findById', () => {
    it('should delegate to repo.findById and map entity', async () => {
      mockRepo.findById.mockResolvedValue(makeEntity());

      const result = await repo.findById('entry-1');

      expect(mockRepo.findById).toHaveBeenCalledWith('entry-1');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('entry-1');
      expect(result!.key).toBe('database.url');
      expect(result!.created_by).toBe('admin');
      expect(result!.createdBy).toBe('admin');
    });

    it('should return null when repo returns undefined', async () => {
      mockRepo.findById.mockResolvedValue(undefined);

      const result = await repo.findById('missing');
      expect(result).toBeNull();
    });

    it('should map all entity fields correctly', async () => {
      mockRepo.findById.mockResolvedValue(
        makeEntity({
          description: 'DB connection',
          encrypted: true,
          tags: ['db', 'prod'],
          updated_by: 'operator',
        }),
      );

      const result = await repo.findById('entry-1');

      expect(result!.description).toBe('DB connection');
      expect(result!.encrypted).toBe(true);
      expect(result!.tags).toEqual(['db', 'prod']);
      expect(result!.updated_by).toBe('operator');
      expect(result!.updatedBy).toBe('operator');
    });
  });

  describe('findByKey', () => {
    it('should delegate to repo.findByKey', async () => {
      mockRepo.findByKey.mockResolvedValue(makeEntity());

      const result = await repo.findByKey('tenant-1', 'database.url');

      expect(mockRepo.findByKey).toHaveBeenCalledWith('tenant-1', 'database.url');
      expect(result).not.toBeNull();
      expect(result!.key).toBe('database.url');
    });

    it('should return null when repo returns undefined', async () => {
      mockRepo.findByKey.mockResolvedValue(undefined);

      const result = await repo.findByKey('tenant-1', 'missing');
      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should delegate to repo.findByTenantId and map entities', async () => {
      mockRepo.findByTenantId.mockResolvedValue([
        makeEntity({ id: 'e1', key: 'key1' }),
        makeEntity({ id: 'e2', key: 'key2' }),
      ]);

      const result = await repo.findAll('tenant-1');

      expect(mockRepo.findByTenantId).toHaveBeenCalledWith('tenant-1');
      expect(result.length).toBe(2);
      expect(result[0].key).toBe('key1');
      expect(result[1].key).toBe('key2');
    });

    it('should return empty array when no entries found', async () => {
      mockRepo.findByTenantId.mockResolvedValue([]);

      const result = await repo.findAll('tenant-1');
      expect(result).toEqual([]);
    });
  });

  describe('set', () => {
    it('should delegate to repo.upsert', async () => {
      mockRepo.upsert.mockResolvedValue(
        makeEntity({ key: 'new.key', version: 1 }),
      );

      const result = await repo.set('tenant-1', 'new.key', { value: 'v' }, 'admin');

      expect(mockRepo.upsert).toHaveBeenCalledWith('tenant-1', 'new.key', { value: 'v' }, 'admin');
      expect(result.key).toBe('new.key');
      expect(result.version).toBe(1);
    });

    it('should pass changedBy to repo.upsert', async () => {
      mockRepo.upsert.mockResolvedValue(makeEntity());

      await repo.set('tenant-1', 'key', { value: 'v' }, 'operator');

      expect(mockRepo.upsert).toHaveBeenCalledWith('tenant-1', 'key', { value: 'v' }, 'operator');
    });
  });

  describe('updateByKey', () => {
    it('should delegate to repo.updateByKey', async () => {
      mockRepo.updateByKey.mockResolvedValue(makeEntity({ version: 2 }));

      const result = await repo.updateByKey('database.url', { value: 'new' });

      expect(mockRepo.updateByKey).toHaveBeenCalledWith('database.url', { value: 'new' });
      expect(result!.version).toBe(2);
    });

    it('should return null when repo returns undefined', async () => {
      mockRepo.updateByKey.mockResolvedValue(undefined);

      const result = await repo.updateByKey('missing', { value: 'v' });
      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delegate to repo.deleteByKey', async () => {
      mockRepo.deleteByKey.mockResolvedValue(true);

      const result = await repo.delete('tenant-1', 'database.url');

      expect(mockRepo.deleteByKey).toHaveBeenCalledWith('tenant-1', 'database.url');
      expect(result).toBe(true);
    });

    it('should return false when repo returns false', async () => {
      mockRepo.deleteByKey.mockResolvedValue(false);

      const result = await repo.delete('tenant-1', 'missing');
      expect(result).toBe(false);
    });
  });

  describe('getHistory', () => {
    it('should delegate to repo.findHistoryByKey and map fields', async () => {
      mockRepo.findHistoryByKey.mockResolvedValue([makeHistoryEntity()]);

      const result = await repo.getHistory('tenant-1', 'database.url', 10);

      expect(mockRepo.findHistoryByKey).toHaveBeenCalledWith('tenant-1', 'database.url', 10);
      expect(result.length).toBe(1);
      expect(result[0].config_id).toBe('entry-1');
      expect(result[0].configId).toBe('entry-1');
      expect(result[0].changed_by).toBe('admin');
      expect(result[0].changedBy).toBe('admin');
      expect(result[0].old_value).toEqual({ host: 'old' });
      expect(result[0].oldValue).toEqual({ host: 'old' });
      expect(result[0].new_value).toEqual({ host: 'new' });
      expect(result[0].newValue).toEqual({ host: 'new' });
      expect(result[0].key).toBe('database.url');
      expect(result[0].version).toBe(2);
      expect(result[0].changeLog).toBe('Updated');
      expect(result[0].createdBy).toBe('admin');
    });

    it('should default limit to 10', async () => {
      mockRepo.findHistoryByKey.mockResolvedValue([]);

      await repo.getHistory('tenant-1', 'key');

      expect(mockRepo.findHistoryByKey).toHaveBeenCalledWith('tenant-1', 'key', 10);
    });

    it('should handle null changed_by', async () => {
      mockRepo.findHistoryByKey.mockResolvedValue([
        makeHistoryEntity({ changed_by: null }),
      ]);

      const result = await repo.getHistory('tenant-1', 'key');
      expect(result[0].changed_by).toBeNull();
      expect(result[0].changedBy).toBeUndefined();
    });
  });

  describe('getHistoryByConfigId', () => {
    it('should delegate to repo.findHistory and map fields', async () => {
      mockRepo.findHistory.mockResolvedValue([makeHistoryEntity()]);

      const result = await repo.getHistoryByConfigId('entry-1', 5);

      expect(mockRepo.findHistory).toHaveBeenCalledWith('entry-1', 5);
      expect(result.length).toBe(1);
      expect(result[0].config_id).toBe('entry-1');
      expect(result[0].configId).toBe('entry-1');
    });

    it('should default limit to 10', async () => {
      mockRepo.findHistory.mockResolvedValue([]);

      await repo.getHistoryByConfigId('entry-1');

      expect(mockRepo.findHistory).toHaveBeenCalledWith('entry-1', 10);
    });
  });
});

// =========================================================================
// Direct SQL Mode Tests (pool without repo)
// =========================================================================

describe('ConfigRepository (direct SQL mode)', () => {
  let repo: ConfigRepository;
  let mockPool: any;

  beforeEach(() => {
    mockPool = createMockPool();
    repo = new ConfigRepository(mockPool);
    // Ensure no repo is set - direct SQL mode
    (repo as any).repo = undefined;
  });

  describe('findById', () => {
    it('should execute SELECT query with id', async () => {
      mockPool.query.mockResolvedValue({ rows: [makeEntry()], rowCount: 1 });

      const result = await repo.findById('entry-1');

      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM config_entries WHERE id = $1',
        ['entry-1'],
      );
      expect(result).not.toBeNull();
      expect(result!.id).toBe('entry-1');
    });

    it('should return null when no rows found', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await repo.findById('missing');
      expect(result).toBeNull();
    });
  });

  describe('findByKey', () => {
    it('should execute SELECT query with tenant and key', async () => {
      mockPool.query.mockResolvedValue({ rows: [makeEntry()], rowCount: 1 });

      const result = await repo.findByKey('tenant-1', 'database.url');

      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM config_entries WHERE tenant_id = $1 AND key = $2',
        ['tenant-1', 'database.url'],
      );
      expect(result).not.toBeNull();
    });

    it('should return null when not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await repo.findByKey('tenant-1', 'missing');
      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should execute SELECT query with tenant ordering by key', async () => {
      mockPool.query.mockResolvedValue({
        rows: [makeEntry({ key: 'a.key' }), makeEntry({ id: 'e2', key: 'b.key' })],
        rowCount: 2,
      });

      const result = await repo.findAll('tenant-1');

      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM config_entries WHERE tenant_id = $1 ORDER BY key',
        ['tenant-1'],
      );
      expect(result.length).toBe(2);
    });
  });

  describe('set', () => {
    it('should execute INSERT/UPSERT query', async () => {
      const entry = makeEntry();
      mockPool.query.mockResolvedValue({ rows: [entry], rowCount: 1 });

      const result = await repo.set('tenant-1', 'database.url', { value: 'pg' }, 'admin');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO config_entries'),
        ['tenant-1', 'database.url', { value: 'pg' }],
      );
      expect(result.key).toBe('database.url');
    });
  });

  describe('updateByKey', () => {
    it('should execute UPDATE query', async () => {
      const entry = makeEntry({ version: 2 });
      mockPool.query.mockResolvedValue({ rows: [entry], rowCount: 1 });

      const result = await repo.updateByKey('database.url', { value: 'new' });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE config_entries'),
        [{ value: 'new' }, 'database.url'],
      );
      expect(result!.version).toBe(2);
    });

    it('should return null when no rows updated', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await repo.updateByKey('missing', { value: 'v' });
      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should execute DELETE query', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 1 });

      const result = await repo.delete('tenant-1', 'database.url');

      expect(mockPool.query).toHaveBeenCalledWith(
        'DELETE FROM config_entries WHERE tenant_id = $1 AND key = $2',
        ['tenant-1', 'database.url'],
      );
      expect(result).toBe(true);
    });

    it('should return false when no rows deleted', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await repo.delete('tenant-1', 'missing');
      expect(result).toBe(false);
    });
  });

  describe('getHistory', () => {
    it('should execute JOIN query for history', async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          {
            id: 'hist-1',
            config_id: 'entry-1',
            old_value: { host: 'old' },
            new_value: { host: 'new' },
            changed_by: 'admin',
            version: 2,
            created_at: new Date(),
          },
        ],
        rowCount: 1,
      });

      const result = await repo.getHistory('tenant-1', 'database.url', 5);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('config_history'),
        ['tenant-1', 'database.url', 5],
      );
      expect(result.length).toBe(1);
    });

    it('should use default limit of 10', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });

      await repo.getHistory('tenant-1', 'key');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.anything(),
        ['tenant-1', 'key', 10],
      );
    });
  });

  describe('getHistoryByConfigId', () => {
    it('should execute SELECT on config_history by config_id', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });

      await repo.getHistoryByConfigId('entry-1', 5);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('config_history'),
        ['entry-1', 5],
      );
    });

    it('should use default limit of 10', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });

      await repo.getHistoryByConfigId('entry-1');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.anything(),
        ['entry-1', 10],
      );
    });
  });
});

// =========================================================================
// entityToEntry mapping tests
// =========================================================================

describe('ConfigRepository.entityToEntry', () => {
  it('should map all camelCase and snake_case fields', () => {
    const repo = new ConfigRepository();
    // Access private method via bracket notation
    const entity = makeEntity({
      description: 'Test config',
      encrypted: true,
      tags: ['tag1'],
      created_by: 'creator',
      updated_by: 'updater',
      created_at: new Date('2026-03-01'),
      updated_at: new Date('2026-03-02'),
    });

    const entry = (repo as any).entityToEntry(entity);

    expect(entry.id).toBe('entry-1');
    expect(entry.tenant_id).toBe('tenant-1');
    expect(entry.key).toBe('database.url');
    expect(entry.value).toEqual({ host: 'localhost' });
    expect(entry.version).toBe(1);
    expect(entry.environment).toBe('default');
    expect(entry.status).toBe('active');
    expect(entry.description).toBe('Test config');
    expect(entry.encrypted).toBe(true);
    expect(entry.tags).toEqual(['tag1']);
    expect(entry.created_by).toBe('creator');
    expect(entry.updated_by).toBe('updater');
    expect(entry.createdBy).toBe('creator');
    expect(entry.updatedBy).toBe('updater');
    expect(entry.createdAt).toEqual(new Date('2026-03-01'));
    expect(entry.updatedAt).toEqual(new Date('2026-03-02'));
    expect(entry.created_at).toEqual(new Date('2026-03-01'));
    expect(entry.updated_at).toEqual(new Date('2026-03-02'));
  });
});
