/**
 * SubAppRepository - Sub-Application Configuration Repository Unit Tests
 *
 * Coverage: findAll, findEnabled, findByKey, create, update, toggleStatus,
 *           delete, addHistory, getHistory, mapRowToEntity
 */

import { SubAppRepository } from '../SubAppRepository';

describe('SubAppRepository', () => {
  let repo: SubAppRepository;
  let mockDb: { query: jest.Mock };

  const sampleRow = {
    id: 'sa-1',
    name: 'Dashboard',
    key: 'dashboard',
    version: '2.0.0',
    entry_dev: 'http://localhost:3001',
    entry_prod: 'https://dashboard.example.com',
    routes: '["/dashboard","/dashboard/*"]',
    permissions: '["dashboard:view"]',
    keep_alive: true,
    preload: false,
    description: 'Main dashboard',
    icon: 'DashboardOutlined',
    api_domain: 'https://api.example.com',
    status: 'enabled',
    sort_order: 1,
    created_by: 'admin',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repo = new SubAppRepository(mockDb as any);
  });

  // ==================== findAll ====================

  describe('findAll', () => {
    it('should return all sub-app configs', async () => {
      mockDb.query.mockResolvedValue({ rows: [sampleRow, { ...sampleRow, id: 'sa-2', key: 'settings' }] });

      const result = await repo.findAll();

      expect(result).toHaveLength(2);
      expect(result[0].key).toBe('dashboard');
    });

    it('should return empty array when no configs', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });
      expect(await repo.findAll()).toEqual([]);
    });
  });

  // ==================== findEnabled ====================

  describe('findEnabled', () => {
    it('should return only enabled sub-apps', async () => {
      mockDb.query.mockResolvedValue({ rows: [sampleRow] });

      const result = await repo.findEnabled();

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('enabled');
    });
  });

  // ==================== findByKey ====================

  describe('findByKey', () => {
    it('should return sub-app by key', async () => {
      mockDb.query.mockResolvedValue({ rows: [sampleRow] });

      const result = await repo.findByKey('dashboard');

      expect(result).toBeDefined();
      expect(result!.key).toBe('dashboard');
      expect(result!.name).toBe('Dashboard');
    });

    it('should return null when not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });
      expect(await repo.findByKey('non-existent')).toBeNull();
    });
  });

  // ==================== create ====================

  describe('create', () => {
    it('should create sub-app config', async () => {
      mockDb.query.mockResolvedValue({ rows: [sampleRow] });

      const result = await repo.create({
        name: 'Dashboard',
        key: 'dashboard',
        entry_dev: 'http://localhost:3001',
        entry_prod: 'https://dashboard.example.com',
        routes: ['/dashboard'],
      });

      expect(result.name).toBe('Dashboard');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO subapp_configs'),
        expect.arrayContaining(['Dashboard', 'dashboard'])
      );
    });

    it('should use defaults for optional fields', async () => {
      mockDb.query.mockResolvedValue({ rows: [sampleRow] });

      await repo.create({
        name: 'App',
        key: 'app',
        entry_dev: 'http://localhost:3001',
        entry_prod: 'https://app.example.com',
        routes: ['/'],
      });

      const [, params] = mockDb.query.mock.calls[0];
      expect(params).toContain('1.0.0');
      expect(params).toContain(false);
      expect(params).toContain('enabled');
      expect(params).toContain(0);
    });
  });

  // ==================== update ====================

  describe('update', () => {
    it('should update sub-app fields', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ ...sampleRow, name: 'Updated' }] });

      const result = await repo.update('dashboard', { name: 'Updated' });

      expect(result!.name).toBe('Updated');
    });

    it('should update multiple fields', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ ...sampleRow, name: 'New', version: '3.0.0' }] });

      const result = await repo.update('dashboard', { name: 'New', version: '3.0.0' });

      expect(result).toBeDefined();
    });

    it('should return existing when no updates', async () => {
      mockDb.query.mockResolvedValue({ rows: [sampleRow] });

      const result = await repo.update('dashboard', {});

      expect(result!.key).toBe('dashboard');
    });

    it('should return null when not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      expect(await repo.update('non-existent', { name: 'New' })).toBeNull();
    });

    it('should update routes and permissions as JSON', async () => {
      mockDb.query.mockResolvedValue({ rows: [sampleRow] });

      await repo.update('dashboard', {
        routes: ['/new-route'],
        permissions: ['new:perm'],
      });

      const [, params] = mockDb.query.mock.calls[0];
      expect(params).toContain(JSON.stringify(['/new-route']));
      expect(params).toContain(JSON.stringify(['new:perm']));
    });

    it('should update boolean fields', async () => {
      mockDb.query.mockResolvedValue({ rows: [sampleRow] });

      await repo.update('dashboard', { keep_alive: false, preload: true });

      const [, params] = mockDb.query.mock.calls[0];
      expect(params).toContain(false);
      expect(params).toContain(true);
    });
  });

  // ==================== toggleStatus ====================

  describe('toggleStatus', () => {
    it('should toggle from enabled to disabled', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [sampleRow] })
        .mockResolvedValueOnce({ rows: [{ ...sampleRow, status: 'disabled' }] });

      const result = await repo.toggleStatus('dashboard');

      expect(result!.status).toBe('disabled');
    });

    it('should toggle from disabled to enabled', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ ...sampleRow, status: 'disabled' }] })
        .mockResolvedValueOnce({ rows: [{ ...sampleRow, status: 'enabled' }] });

      const result = await repo.toggleStatus('dashboard');

      expect(result!.status).toBe('enabled');
    });

    it('should return null when not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });
      expect(await repo.toggleStatus('non-existent')).toBeNull();
    });
  });

  // ==================== delete ====================

  describe('delete', () => {
    it('should delete sub-app config', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 1 });
      expect(await repo.delete('dashboard')).toBe(true);
    });

    it('should return false when not found', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 0 });
      expect(await repo.delete('non-existent')).toBe(false);
    });
  });

  // ==================== History ====================

  describe('addHistory', () => {
    it('should add history record', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repo.addHistory('dashboard', 'updated', { name: 'Old' }, { name: 'New' }, 'admin', 'Name changed');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO subapp_config_history'),
        expect.arrayContaining(['dashboard', 'updated'])
      );
    });

    it('should handle null old/new values', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repo.addHistory('dashboard', 'created', null, { name: 'New' }, null, null);

      const [, params] = mockDb.query.mock.calls[0];
      expect(params).toContain(null);
    });
  });

  describe('getHistory', () => {
    it('should return config history', async () => {
      mockDb.query.mockResolvedValue({
        rows: [
          { id: 'h-1', subapp_key: 'dashboard', action: 'updated', old_value: '{"name":"Old"}', new_value: '{"name":"New"}', changed_by: 'admin', change_summary: 'Updated', created_at: '2026-01-01T00:00:00Z' },
          { id: 'h-2', subapp_key: 'dashboard', action: 'created', old_value: null, new_value: '{"name":"Old"}', changed_by: 'admin', change_summary: null, created_at: '2026-01-01T00:00:00Z' },
        ],
      });

      const result = await repo.getHistory('dashboard');

      expect(result).toHaveLength(2);
      expect(result[0].action).toBe('updated');
      expect(result[0].old_value).toEqual({ name: 'Old' });
    });

    it('should return empty for no history', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });
      expect(await repo.getHistory('unknown')).toEqual([]);
    });
  });

  // ==================== mapRowToEntity ====================

  describe('mapRowToEntity', () => {
    it('should parse JSON routes and permissions', async () => {
      mockDb.query.mockResolvedValue({ rows: [sampleRow] });

      const result = await repo.findByKey('dashboard');

      expect(result!.routes).toEqual(['/dashboard', '/dashboard/*']);
      expect(result!.permissions).toEqual(['dashboard:view']);
    });

    it('should handle array routes directly', async () => {
      mockDb.query.mockResolvedValue({
        rows: [{ ...sampleRow, routes: ['/direct'], permissions: ['perm'] }],
      });

      const result = await repo.findByKey('dashboard');

      expect(result!.routes).toEqual(['/direct']);
      expect(result!.permissions).toEqual(['perm']);
    });

    it('should handle missing optional fields', async () => {
      mockDb.query.mockResolvedValue({
        rows: [{
          ...sampleRow,
          description: null,
          icon: null,
          api_domain: null,
          created_by: null,
          routes: null,
          permissions: null,
        }],
      });

      const result = await repo.findByKey('dashboard');

      expect(result!.description).toBeNull();
      expect(result!.routes).toEqual([]);
      expect(result!.permissions).toEqual([]);
    });

    it('should handle missing version', async () => {
      mockDb.query.mockResolvedValue({
        rows: [{ ...sampleRow, version: null }],
      });

      const result = await repo.findByKey('dashboard');

      expect(result!.version).toBe('1.0.0');
    });
  });

  // ==================== Error Propagation ====================

  describe('error propagation', () => {
    it('should propagate database errors', async () => {
      mockDb.query.mockRejectedValue(new Error('Connection refused'));
      await expect(repo.findAll()).rejects.toThrow('Connection refused');
    });
  });
});
