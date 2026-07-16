/**
 * RateLimitService 单元测试
 *
 * 测试速率限制配置的 CRUD 操作和限制检查逻辑。
 */

import { RateLimitService, CreateRateLimitInput, UpdateRateLimitInput } from '../RateLimitService';

// Mock uuid to return predictable values
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-1234'),
}));

describe('RateLimitService', () => {
  let service: RateLimitService;
  let mockPool: any;

  const sampleLimit = {
    id: 'limit-1',
    target_type: 'user' as const,
    target_id: 'user-1',
    command_name: null,
    limit_type: 'minute' as const,
    limit_count: 10,
    window_seconds: 60,
    description: 'User rate limit',
    enabled: true,
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(() => {
    mockPool = {
      query: jest.fn(),
    };
    service = new RateLimitService(mockPool);
  });

  describe('constructor', () => {
    it('should create service with pool', () => {
      expect(service).toBeDefined();
    });
  });

  describe('getAll', () => {
    it('should return all rate limits', async () => {
      mockPool.query.mockResolvedValue({ rows: [sampleLimit], rowCount: 1 });

      const result = await service.getAll();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('limit-1');
      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM chatops_rate_limits ORDER BY target_type, command_name'
      );
    });

    it('should return empty array when no limits exist', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await service.getAll();

      expect(result).toHaveLength(0);
    });
  });

  describe('getById', () => {
    it('should return a rate limit by id', async () => {
      mockPool.query.mockResolvedValue({ rows: [sampleLimit], rowCount: 1 });

      const result = await service.getById('limit-1');

      expect(result).toEqual(sampleLimit);
      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM chatops_rate_limits WHERE id = $1',
        ['limit-1']
      );
    });

    it('should return null when limit not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await service.getById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create a new rate limit', async () => {
      const input: CreateRateLimitInput = {
        target_type: 'user',
        target_id: 'user-1',
        limit_type: 'minute',
        limit_count: 10,
        window_seconds: 60,
        description: 'Test limit',
      };

      // First call: INSERT (no return value needed)
      // Second call: SELECT from getById
      mockPool.query
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [sampleLimit], rowCount: 1 });

      const result = await service.create(input);

      expect(result.id).toBe('limit-1');
      expect(mockPool.query).toHaveBeenCalledTimes(2);
      // Verify INSERT was called
      const insertCall = mockPool.query.mock.calls[0];
      expect(insertCall[0]).toContain('INSERT INTO chatops_rate_limits');
      expect(insertCall[1][0]).toBe('mock-uuid-1234'); // id from uuid mock
      expect(insertCall[1][1]).toBe('user'); // target_type
    });

    it('should default enabled to true when not specified', async () => {
      const input: CreateRateLimitInput = {
        target_type: 'command',
        command_name: 'deploy',
        limit_type: 'hour',
        limit_count: 100,
        window_seconds: 3600,
      };

      mockPool.query
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [sampleLimit], rowCount: 1 });

      await service.create(input);

      const insertParams = mockPool.query.mock.calls[0][1];
      expect(insertParams[8]).toBe(true); // enabled defaults to true
    });

    it('should default description to empty string', async () => {
      const input: CreateRateLimitInput = {
        target_type: 'command',
        command_name: 'deploy',
        limit_type: 'hour',
        limit_count: 100,
        window_seconds: 3600,
      };

      mockPool.query
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [sampleLimit], rowCount: 1 });

      await service.create(input);

      const insertParams = mockPool.query.mock.calls[0][1];
      expect(insertParams[7]).toBe(''); // description defaults to ''
    });
  });

  describe('update', () => {
    it('should update an existing rate limit', async () => {
      const input: UpdateRateLimitInput = {
        limit_count: 20,
        description: 'Updated limit',
      };

      // getById (existing check) -> UPDATE -> getById (return)
      mockPool.query
        .mockResolvedValueOnce({ rows: [sampleLimit], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [{ ...sampleLimit, limit_count: 20 }], rowCount: 1 });

      const result = await service.update('limit-1', input);

      expect(result).not.toBeNull();
      expect(mockPool.query).toHaveBeenCalledTimes(3);
    });

    it('should return null when updating non-existent limit', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await service.update('nonexistent', { limit_count: 20 });

      expect(result).toBeNull();
    });

    it('should skip UPDATE when no fields provided', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [sampleLimit], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [sampleLimit], rowCount: 1 });

      const result = await service.update('limit-1', {});

      expect(result).not.toBeNull();
      // Only 2 calls: getById + getById (no UPDATE)
      expect(mockPool.query).toHaveBeenCalledTimes(2);
    });

    it('should update target_type when provided', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [sampleLimit], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [sampleLimit], rowCount: 1 });

      await service.update('limit-1', { target_type: 'group' });

      const updateCall = mockPool.query.mock.calls[1];
      expect(updateCall[0]).toContain('UPDATE chatops_rate_limits');
      expect(updateCall[1]).toContain('group');
    });

    it('should update enabled when provided', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [sampleLimit], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [sampleLimit], rowCount: 1 });

      await service.update('limit-1', { enabled: false });

      const updateCall = mockPool.query.mock.calls[1];
      expect(updateCall[1]).toContain(false);
    });
  });

  describe('delete', () => {
    it('should delete an existing rate limit', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 1 });

      const result = await service.delete('limit-1');

      expect(result).toBe(true);
      expect(mockPool.query).toHaveBeenCalledWith(
        'DELETE FROM chatops_rate_limits WHERE id = $1',
        ['limit-1']
      );
    });

    it('should return false when limit not found', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 0 });

      const result = await service.delete('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('checkLimit', () => {
    it('should return allowed=true when no limits configured', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await service.checkLimit('user-1', 'deploy');

      expect(result.allowed).toBe(true);
    });

    it('should query with command_name and userId', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });

      await service.checkLimit('user-1', 'deploy');

      const queryCall = mockPool.query.mock.calls[0];
      expect(queryCall[0]).toContain('chatops_rate_limits');
      expect(queryCall[0]).toContain('enabled = true');
      expect(queryCall[1]).toEqual(['deploy', 'user-1']);
    });

    it('should return allowed=true when limits exist (no Redis integration)', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ ...sampleLimit, enabled: true }],
        rowCount: 1,
      });

      const result = await service.checkLimit('user-1', 'deploy');

      // Currently always returns allowed since Redis integration is not implemented
      expect(result.allowed).toBe(true);
    });
  });
});
