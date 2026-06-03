/**
 * CommandVersionService 单元测试
 *
 * 测试命令版本管理：CRUD、版本回滚、标签管理。
 */

// Mock uuid to return predictable values
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-1234'),
}));

// Mock pino logger
jest.mock('pino', () => {
  return jest.fn().mockReturnValue({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  });
});

import { CommandVersionService } from '../CommandVersionService';

describe('CommandVersionService', () => {
  let service: CommandVersionService;
  let mockPool: any;

  const sampleVersion = {
    id: 'ver-1',
    command_id: 'cmd-1',
    version: 1,
    command_text: '/deploy service=api',
    parameters: { service: { type: 'string', required: true } },
    description: 'Initial version',
    changelog: 'First release',
    created_by: 'admin',
    created_at: new Date('2024-01-01'),
    is_current: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockPool = {
      query: jest.fn(),
    };
    service = new CommandVersionService(mockPool);
  });

  describe('constructor', () => {
    it('should create service with pool', () => {
      expect(service).toBeDefined();
    });
  });

  describe('getVersionsByCommand', () => {
    it('should return versions with tags', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [sampleVersion] }) // versions query
        .mockResolvedValueOnce({ rows: [{ tag_name: 'v1.0' }, { tag_name: 'stable' }] }); // tags query

      const result = await service.getVersionsByCommand('cmd-1');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('ver-1');
      expect(result[0].tags).toEqual(['v1.0', 'stable']);
    });

    it('should return empty array when no versions exist', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await service.getVersionsByCommand('cmd-1');

      expect(result).toHaveLength(0);
    });

    it('should handle versions with no tags', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [sampleVersion] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await service.getVersionsByCommand('cmd-1');

      expect(result[0].tags).toEqual([]);
    });

    it('should query with correct parameters', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await service.getVersionsByCommand('cmd-123');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE command_id = $1'),
        ['cmd-123'],
      );
    });
  });

  describe('getAllVersions', () => {
    it('should return paginated versions', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '5' }] }) // count query
        .mockResolvedValueOnce({ rows: [sampleVersion] }); // versions query

      const result = await service.getAllVersions(1, 20);

      expect(result.total).toBe(5);
      expect(result.versions).toHaveLength(1);
    });

    it('should handle custom pagination', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '10' }] })
        .mockResolvedValueOnce({ rows: [] });

      await service.getAllVersions(2, 5);

      // Check the LIMIT/OFFSET query was called with correct params
      const limitQuery = mockPool.query.mock.calls[1][1];
      expect(limitQuery).toEqual([5, 5]); // perPage=5, offset=5
    });

    it('should return zero total when no versions exist', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await service.getAllVersions();

      expect(result.total).toBe(0);
      expect(result.versions).toHaveLength(0);
    });
  });

  describe('createVersion', () => {
    it('should create a new version', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ max_ver: 0 }] }) // max version query
        .mockResolvedValueOnce({ rows: [] }) // update previous current
        .mockResolvedValueOnce({ rows: [] }); // insert

      const result = await service.createVersion({
        command_id: 'cmd-1',
        command_text: '/deploy service=api',
        description: 'New version',
      });

      expect(result.id).toBe('mock-uuid-1234');
      expect(result.command_id).toBe('cmd-1');
      expect(result.version).toBe(1);
      expect(result.command_text).toBe('/deploy service=api');
      expect(result.description).toBe('New version');
      expect(result.is_current).toBe(true);
    });

    it('should increment version number', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ max_ver: 3 }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await service.createVersion({
        command_id: 'cmd-1',
        command_text: '/deploy v4',
      });

      expect(result.version).toBe(4);
    });

    it('should mark previous current as not current', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ max_ver: 1 }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await service.createVersion({ command_id: 'cmd-1', command_text: 'test' });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SET is_current = false'),
        ['cmd-1'],
      );
    });

    it('should use defaults for optional fields', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ max_ver: 0 }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await service.createVersion({
        command_id: 'cmd-1',
        command_text: 'test',
      });

      expect(result.parameters).toEqual({});
      expect(result.description).toBe('');
      expect(result.changelog).toBe('');
      expect(result.created_by).toBe('system');
      expect(result.tags).toEqual([]);
    });

    it('should pass custom parameters', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ max_ver: 0 }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const params = { service: { type: 'string' } };
      const result = await service.createVersion({
        command_id: 'cmd-1',
        command_text: 'test',
        parameters: params,
        changelog: 'Added param',
        created_by: 'user-1',
      });

      expect(result.parameters).toEqual(params);
      expect(result.changelog).toBe('Added param');
      expect(result.created_by).toBe('user-1');
    });
  });

  describe('rollbackToVersion', () => {
    it('should create new version from old version', async () => {
      // Mock finding the target version
      mockPool.query
        .mockResolvedValueOnce({ rows: [sampleVersion] }) // find target
        .mockResolvedValueOnce({ rows: [{ max_ver: 5 }] }) // max version
        .mockResolvedValueOnce({ rows: [] }) // update current
        .mockResolvedValueOnce({ rows: [] }); // insert

      const result = await service.rollbackToVersion('cmd-1', 1);

      expect(result).toBeDefined();
      expect(result!.command_text).toBe('/deploy service=api');
      expect(result!.description).toBe('Rollback to v1');
    });

    it('should return null when version not found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.rollbackToVersion('cmd-1', 999);

      expect(result).toBeNull();
    });
  });

  describe('addTag', () => {
    it('should add tag to version', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await service.addTag('ver-1', 'v1.0', 'admin');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO chatops_command_tags'),
        ['mock-uuid-1234', 'ver-1', 'v1.0', 'admin'],
      );
    });

    it('should use default creator', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await service.addTag('ver-1', 'stable');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO chatops_command_tags'),
        ['mock-uuid-1234', 'ver-1', 'stable', 'system'],
      );
    });
  });

  describe('removeTag', () => {
    it('should remove tag from version', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await service.removeTag('ver-1', 'v1.0');

      expect(mockPool.query).toHaveBeenCalledWith(
        'DELETE FROM chatops_command_tags WHERE command_version_id = $1 AND tag_name = $2',
        ['ver-1', 'v1.0'],
      );
    });
  });

  describe('deleteVersion', () => {
    it('should return true when version deleted', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 1 });

      const result = await service.deleteVersion('ver-1');

      expect(result).toBe(true);
      expect(mockPool.query).toHaveBeenCalledWith(
        'DELETE FROM chatops_command_versions WHERE id = $1',
        ['ver-1'],
      );
    });

    it('should return false when version not found', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 0 });

      const result = await service.deleteVersion('nonexistent');

      expect(result).toBe(false);
    });
  });
});
