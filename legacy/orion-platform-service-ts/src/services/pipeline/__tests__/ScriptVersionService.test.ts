/**
 * ScriptVersionService Tests
 */

import { ScriptVersionService, type ScriptVersionServiceOptions } from '../ScriptVersionService';

describe('ScriptVersionService', () => {
  let mockDb: any;
  let service: ScriptVersionService;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    const options: ScriptVersionServiceOptions = { db: mockDb };
    service = new ScriptVersionService(options);
  });

  // ==================== createVersion ====================

  describe('createVersion', () => {
    test('should create a script version', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // no duplicate check
        .mockResolvedValueOnce({ rows: [{
          id: 'sv-1', tenant_id: 't-1', script_id: 'script-1', version: '1.0.0',
          content: 'echo hello', content_hash: 'sha-abc123',
          parameters: {}, change_description: 'Initial version',
          created_by: 'user-1', created_at: new Date(),
        }], rowCount: 1 });

      const version = await service.createVersion({
        tenantId: 't-1',
        scriptId: 'script-1',
        version: '1.0.0',
        content: 'echo hello',
        changeDescription: 'Initial version',
        createdBy: 'user-1',
      });

      expect(version.version).toBe('1.0.0');
      expect(version.content).toBe('echo hello');
      expect(version.changeDescription).toBe('Initial version');
      expect(version.createdBy).toBe('user-1');
    });

    test('should compute content hash', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [{
          id: 'sv-2', tenant_id: 't-1', script_id: 'script-1', version: '1.0.0',
          content: 'echo hello', content_hash: 'sha-abc123',
          parameters: {}, change_description: null,
          created_by: 'user-1', created_at: new Date(),
        }], rowCount: 1 });

      const version = await service.createVersion({
        tenantId: 't-1',
        scriptId: 'script-1',
        version: '1.0.0',
        content: 'echo hello',
        createdBy: 'user-1',
      });

      expect(version.contentHash).toBeDefined();
      expect(version.contentHash).toMatch(/^sha-/);
    });

    test('should throw without repository', async () => {
      const noDbService = new ScriptVersionService();
      await expect(
        noDbService.createVersion({
          tenantId: 't-1', scriptId: 's', version: '1', content: 'x', createdBy: 'u',
        })
      ).rejects.toThrow('NO_REPOSITORY');
    });
  });

  // ==================== getVersions ====================

  describe('getVersions', () => {
    test('should list versions for a script', async () => {
      mockDb.query.mockResolvedValue({ rows: [{
        id: 'sv-1', tenant_id: 't-1', script_id: 'script-1', version: '1.0.0',
        content: 'v1', content_hash: 'sha-1',
        parameters: {}, change_description: null, created_by: 'user-1', created_at: new Date(),
      }, {
        id: 'sv-2', tenant_id: 't-1', script_id: 'script-1', version: '2.0.0',
        content: 'v2', content_hash: 'sha-2',
        parameters: {}, change_description: 'v2', created_by: 'user-1', created_at: new Date(),
      }], rowCount: 2 });

      const versions = await service.getVersions('t-1', 'script-1');
      expect(versions).toHaveLength(2);
      expect(versions[0].version).toBe('1.0.0');
    });
  });

  // ==================== getLatestVersion ====================

  describe('getLatestVersion', () => {
    test('should return the latest version', async () => {
      mockDb.query.mockResolvedValue({ rows: [{
        id: 'sv-latest', tenant_id: 't-1', script_id: 'script-1', version: '2.0.0',
        content: 'latest', content_hash: 'sha-latest',
        parameters: {}, change_description: null, created_by: 'user-1', created_at: new Date(),
      }], rowCount: 1 });

      const latest = await service.getLatestVersion('t-1', 'script-1');
      expect(latest).not.toBeNull();
      expect(latest!.version).toBe('2.0.0');
    });

    test('should return null when no versions', async () => {
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const latest = await service.getLatestVersion('t-1', 'nonexistent');
      expect(latest).toBeNull();
    });
  });

  // ==================== getVersion ====================

  describe('getVersion', () => {
    test('should get a specific version', async () => {
      mockDb.query.mockResolvedValue({ rows: [{
        id: 'sv-1', tenant_id: 't-1', script_id: 'script-1', version: '1.0.0',
        content: 'v1', content_hash: 'sha-1',
        parameters: {}, change_description: null, created_by: 'user-1', created_at: new Date(),
      }], rowCount: 1 });

      const v = await service.getVersion('t-1', 'script-1', '1.0.0');
      expect(v).not.toBeNull();
      expect(v!.version).toBe('1.0.0');
    });
  });

  // ==================== diff ====================

  describe('diff', () => {
    test('should detect added lines', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{
          id: 'sv-a', tenant_id: 't-1', script_id: 's', version: '1.0',
          content: 'line1\nline2', content_hash: 'sha-a',
          parameters: {}, change_description: null, created_by: 'u', created_at: new Date(),
        }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{
          id: 'sv-b', tenant_id: 't-1', script_id: 's', version: '2.0',
          content: 'line1\nline2\nline3', content_hash: 'sha-b',
          parameters: {}, change_description: null, created_by: 'u', created_at: new Date(),
        }], rowCount: 1 });

      const result = await service.diff('t-1', 's', '1.0', '2.0');
      expect(result.added.length).toBeGreaterThan(0);
      expect(result.summary).toContain('added');
    });

    test('should detect removed lines', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{
          id: 'sv-a', tenant_id: 't-1', script_id: 's', version: '1.0',
          content: 'line1\nline2\nline3', content_hash: 'sha-a',
          parameters: {}, change_description: null, created_by: 'u', created_at: new Date(),
        }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{
          id: 'sv-b', tenant_id: 't-1', script_id: 's', version: '2.0',
          content: 'line1', content_hash: 'sha-b',
          parameters: {}, change_description: null, created_by: 'u', created_at: new Date(),
        }], rowCount: 1 });

      const result = await service.diff('t-1', 's', '1.0', '2.0');
      expect(result.removed.length).toBeGreaterThan(0);
      expect(result.summary).toContain('removed');
    });

    test('should report no changes when content is identical', async () => {
      const content = 'line1\nline2';
      mockDb.query
        .mockResolvedValueOnce({ rows: [{
          id: 'sv-a', tenant_id: 't-1', script_id: 's', version: '1.0',
          content, content_hash: 'sha-a',
          parameters: {}, change_description: null, created_by: 'u', created_at: new Date(),
        }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{
          id: 'sv-b', tenant_id: 't-1', script_id: 's', version: '2.0',
          content, content_hash: 'sha-b',
          parameters: {}, change_description: null, created_by: 'u', created_at: new Date(),
        }], rowCount: 1 });

      const result = await service.diff('t-1', 's', '1.0', '2.0');
      expect(result.added).toHaveLength(0);
      expect(result.removed).toHaveLength(0);
      expect(result.modified).toHaveLength(0);
      expect(result.summary).toContain('No changes');
    });

    test('should throw when version A not found', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // version A not found
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // version B (not reached)

      await expect(
        service.diff('t-1', 's', 'nonexistent', '2.0')
      ).rejects.toThrow('VERSION_NOT_FOUND');
    });
  });

  // ==================== deleteVersion ====================

  describe('deleteVersion', () => {
    test('should delete a version', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ id: 'sv-1', tenant_id: 't-1', script_id: 's', version: '1.0', content: '', content_hash: '', parameters: {}, created_at: '', updated_at: '' }], rowCount: 1 }) // findByVersion
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }); // delete

      await expect(service.deleteVersion('t-1', 's', '1.0')).resolves.toBeUndefined();
      expect(mockDb.query).toHaveBeenCalledWith(
        'DELETE FROM script_versions WHERE id = $1',
        ['sv-1'],
      );
    });
  });
});
