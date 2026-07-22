/**
 * FederationRepository 测试
 *
 * 测试 ExecutorRepository 和 ExecutorHealthRepository 的数据访问层
 */

import {
  ExecutorRepository,
  ExecutorHealthRepository,
  ExecutorEntity,
  ExecutorHealthEntity,
} from '../FederationRepository';

describe('ExecutorRepository', () => {
  let repo: ExecutorRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repo = new ExecutorRepository(mockDb);
  });

  describe('findAllActive', () => {
    it('应该返回所有在线的执行器', async () => {
      const mockRows = [
        {
          id: 'exec-001',
          cluster_id: 'cluster-1',
          name: 'executor-east-1',
          region: 'east',
          status: 'online',
          cpu_capacity: 16,
          memory_capacity_mb: 32768,
          cpu_used: 4,
          memory_used_mb: 8192,
          running_jobs: 3,
          max_concurrent_jobs: 10,
          last_heartbeat: new Date(),
          registered_at: new Date(),
          labels: {},
        },
        {
          id: 'exec-002',
          cluster_id: 'cluster-2',
          name: 'executor-west-1',
          region: 'west',
          status: 'online',
          cpu_capacity: 32,
          memory_capacity_mb: 65536,
          cpu_used: 8,
          memory_used_mb: 16384,
          running_jobs: 5,
          max_concurrent_jobs: 20,
          last_heartbeat: new Date(),
          registered_at: new Date(),
          labels: {},
        },
      ];

      mockDb.query.mockResolvedValue({ rows: mockRows });

      const result = await repo.findAllActive();

      expect(result.length).toBe(2);
      expect(result[0].id).toBe('exec-001');
      expect(result[0].status).toBe('online');
      expect(result[1].id).toBe('exec-002');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE status = \'online\'')
      );
    });

    it('应该返回空数组如果没有在线执行器', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repo.findAllActive();

      expect(result.length).toBe(0);
    });
  });

  describe('findByIdWithHealth', () => {
    it('应该返回执行器及其健康状态', async () => {
      const executorRow = {
        id: 'exec-001',
        cluster_id: 'cluster-1',
        name: 'executor-east-1',
        region: 'east',
        status: 'online',
        cpu_capacity: 16,
        memory_capacity_mb: 32768,
        cpu_used: 4,
        memory_used_mb: 8192,
        running_jobs: 3,
        max_concurrent_jobs: 10,
        last_heartbeat: new Date(),
        registered_at: new Date(),
        labels: {},
      };

      const healthRow = {
        id: 'health-001',
        executor_id: 'exec-001',
        status: 'healthy',
        cpu_usage_pct: 25.0,
        memory_usage_pct: 25.0,
        running_jobs: 3,
        queue_depth: 0,
        last_heartbeat: new Date(),
        response_time_ms: 12.5,
        errors_last_hour: 0,
      };

      mockDb.query
        .mockResolvedValueOnce({ rows: [executorRow] })
        .mockResolvedValueOnce({ rows: [healthRow] });

      const result = await repo.findByIdWithHealth('exec-001');

      expect(result).toBeDefined();
      expect(result!.executor.id).toBe('exec-001');
      expect(result!.executor.name).toBe('executor-east-1');
      expect(result!.health).not.toBeNull();
      expect(result!.health!.executor_id).toBe('exec-001');
      expect(result!.health!.status).toBe('healthy');
    });

    it('应该返回 undefined 如果执行器不存在', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repo.findByIdWithHealth('nonexistent');

      expect(result).toBeUndefined();
    });

    it('应该返回 null health 如果健康记录不存在', async () => {
      const executorRow = {
        id: 'exec-001',
        cluster_id: 'cluster-1',
        name: 'executor-east-1',
        region: 'east',
        status: 'online',
        cpu_capacity: 16,
        memory_capacity_mb: 32768,
        cpu_used: 4,
        memory_used_mb: 8192,
        running_jobs: 3,
        max_concurrent_jobs: 10,
        last_heartbeat: new Date(),
        registered_at: new Date(),
        labels: {},
      };

      mockDb.query
        .mockResolvedValueOnce({ rows: [executorRow] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await repo.findByIdWithHealth('exec-001');

      expect(result).toBeDefined();
      expect(result!.executor.id).toBe('exec-001');
      expect(result!.health).toBeNull();
    });
  });

  describe('updateHeartbeat', () => {
    it('应该更新执行器心跳和资源使用情况', async () => {
      const updatedRow = {
        id: 'exec-001',
        cluster_id: 'cluster-1',
        name: 'executor-east-1',
        region: 'east',
        status: 'online',
        cpu_capacity: 16,
        memory_capacity_mb: 32768,
        cpu_used: 8,
        memory_used_mb: 16384,
        running_jobs: 5,
        max_concurrent_jobs: 10,
        last_heartbeat: new Date(),
        registered_at: new Date(),
        labels: {},
      };

      mockDb.query.mockResolvedValue({ rows: [updatedRow] });

      const result = await repo.updateHeartbeat('exec-001', {
        cpu_used: 8,
        memory_used_mb: 16384,
        running_jobs: 5,
      });

      expect(result).toBeDefined();
      expect(result!.cpu_used).toBe(8);
      expect(result!.memory_used_mb).toBe(16384);
      expect(result!.running_jobs).toBe(5);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE federation_executors'),
        expect.arrayContaining([8, 16384, 5, 'exec-001'])
      );
    });

    it('应该部分更新（只更新提供的字段）', async () => {
      const updatedRow = {
        id: 'exec-001',
        cluster_id: 'cluster-1',
        name: 'executor-east-1',
        region: 'east',
        status: 'online',
        cpu_capacity: 16,
        memory_capacity_mb: 32768,
        cpu_used: 12,
        memory_used_mb: 8192,
        running_jobs: 3,
        max_concurrent_jobs: 10,
        last_heartbeat: new Date(),
        registered_at: new Date(),
        labels: {},
      };

      mockDb.query.mockResolvedValue({ rows: [updatedRow] });

      const result = await repo.updateHeartbeat('exec-001', {
        cpu_used: 12,
      });

      expect(result).toBeDefined();
      expect(result!.cpu_used).toBe(12);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE federation_executors'),
        expect.arrayContaining([12, null, null, 'exec-001'])
      );
    });

    it('应该返回 undefined 如果执行器不存在', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repo.updateHeartbeat('nonexistent', { cpu_used: 8 });

      expect(result).toBeUndefined();
    });
  });

  describe('delete', () => {
    it('应该删除执行器', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 1 });

      const result = await repo.delete('exec-001');

      expect(result).toBe(true);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM federation_executors'),
        ['exec-001']
      );
    });

    it('应该返回 false 如果执行器不存在', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 0 });

      const result = await repo.delete('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('mapRowToEntity', () => {
    it('应该正确映射数据库行到实体', () => {
      const row = {
        id: 'exec-001',
        cluster_id: 'cluster-1',
        name: 'executor-east-1',
        region: 'east',
        status: 'online',
        cpu_capacity: 16,
        memory_capacity_mb: 32768,
        cpu_used: 4,
        memory_used_mb: 8192,
        running_jobs: 3,
        max_concurrent_jobs: 10,
        last_heartbeat: new Date(),
        registered_at: new Date(),
        labels: { tier: 'premium' },
      };

      const entity = repo.mapRowToEntity(row);

      expect(entity.id).toBe('exec-001');
      expect(entity.cluster_id).toBe('cluster-1');
      expect(entity.name).toBe('executor-east-1');
      expect(entity.region).toBe('east');
      expect(entity.status).toBe('online');
      expect(entity.cpu_capacity).toBe(16);
      expect(entity.memory_capacity_mb).toBe(32768);
      expect(entity.cpu_used).toBe(4);
      expect(entity.memory_used_mb).toBe(8192);
      expect(entity.running_jobs).toBe(3);
      expect(entity.max_concurrent_jobs).toBe(10);
      expect(entity.labels).toEqual({ tier: 'premium' });
    });

    it('应该使用默认值处理空字段', () => {
      const row = {
        id: 'exec-002',
        cluster_id: 'cluster-2',
        name: 'executor-west-1',
        region: 'west',
        status: null,
        cpu_capacity: null,
        memory_capacity_mb: null,
        cpu_used: null,
        memory_used_mb: null,
        running_jobs: null,
        max_concurrent_jobs: null,
        last_heartbeat: new Date(),
        registered_at: new Date(),
        labels: null,
      };

      const entity = repo.mapRowToEntity(row);

      expect(entity.status).toBe('online');
      expect(entity.cpu_capacity).toBe(16);
      expect(entity.memory_capacity_mb).toBe(32768);
      expect(entity.cpu_used).toBe(0);
      expect(entity.memory_used_mb).toBe(0);
      expect(entity.running_jobs).toBe(0);
      expect(entity.max_concurrent_jobs).toBe(10);
      expect(entity.labels).toEqual({});
    });
  });
});

describe('ExecutorHealthRepository', () => {
  let repo: ExecutorHealthRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repo = new ExecutorHealthRepository(mockDb);
  });

  describe('findByExecutor', () => {
    it('应该返回执行器的最新健康记录', async () => {
      const mockRow = {
        id: 'health-001',
        executor_id: 'exec-001',
        status: 'healthy',
        cpu_usage_pct: 25.0,
        memory_usage_pct: 30.0,
        running_jobs: 3,
        queue_depth: 0,
        last_heartbeat: new Date(),
        response_time_ms: 12.5,
        errors_last_hour: 0,
      };

      mockDb.query.mockResolvedValue({ rows: [mockRow] });

      const result = await repo.findByExecutor('exec-001');

      expect(result).toBeDefined();
      expect(result!.executor_id).toBe('exec-001');
      expect(result!.status).toBe('healthy');
      expect(result!.cpu_usage_pct).toBe(25.0);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY last_heartbeat DESC LIMIT 1'),
        ['exec-001']
      );
    });

    it('应该返回 undefined 如果健康记录不存在', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repo.findByExecutor('nonexistent');

      expect(result).toBeUndefined();
    });
  });

  describe('findAllLatest', () => {
    it('应该返回所有执行器的最新健康记录', async () => {
      const mockRows = [
        {
          id: 'health-001',
          executor_id: 'exec-001',
          status: 'healthy',
          cpu_usage_pct: 25.0,
          memory_usage_pct: 30.0,
          running_jobs: 3,
          queue_depth: 0,
          last_heartbeat: new Date(),
          response_time_ms: 12.5,
          errors_last_hour: 0,
        },
        {
          id: 'health-002',
          executor_id: 'exec-002',
          status: 'degraded',
          cpu_usage_pct: 95.0,
          memory_usage_pct: 85.0,
          running_jobs: 8,
          queue_depth: 3,
          last_heartbeat: new Date(),
          response_time_ms: 45.0,
          errors_last_hour: 2,
        },
      ];

      mockDb.query.mockResolvedValue({ rows: mockRows });

      const result = await repo.findAllLatest();

      expect(result.length).toBe(2);
      expect(result[0].executor_id).toBe('exec-001');
      expect(result[1].executor_id).toBe('exec-002');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('DISTINCT ON (executor_id)')
      );
    });

    it('应该返回空数组如果没有健康记录', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repo.findAllLatest();

      expect(result.length).toBe(0);
    });
  });

  describe('upsert', () => {
    it('应该插入新的健康记录', async () => {
      const mockRow = {
        id: 'health-001',
        executor_id: 'exec-001',
        status: 'healthy',
        cpu_usage_pct: 25.0,
        memory_usage_pct: 30.0,
        running_jobs: 3,
        queue_depth: 0,
        last_heartbeat: new Date(),
        response_time_ms: 12.5,
        errors_last_hour: 0,
      };

      mockDb.query.mockResolvedValue({ rows: [mockRow] });

      const result = await repo.upsert({
        executor_id: 'exec-001',
        status: 'healthy',
        cpu_usage_pct: 25.0,
        memory_usage_pct: 30.0,
        running_jobs: 3,
        queue_depth: 0,
        last_heartbeat: new Date(),
        response_time_ms: 12.5,
        errors_last_hour: 0,
      });

      expect(result.executor_id).toBe('exec-001');
      expect(result.status).toBe('healthy');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO federation_executor_health'),
        expect.arrayContaining(['exec-001', 'healthy', 25.0, 30.0, 3, 0])
      );
    });

    it('应该更新现有的健康记录', async () => {
      const mockRow = {
        id: 'health-001',
        executor_id: 'exec-001',
        status: 'degraded',
        cpu_usage_pct: 95.0,
        memory_usage_pct: 85.0,
        running_jobs: 8,
        queue_depth: 3,
        last_heartbeat: new Date(),
        response_time_ms: 45.0,
        errors_last_hour: 2,
      };

      mockDb.query.mockResolvedValue({ rows: [mockRow] });

      const result = await repo.upsert({
        executor_id: 'exec-001',
        status: 'degraded',
        cpu_usage_pct: 95.0,
        memory_usage_pct: 85.0,
        running_jobs: 8,
        queue_depth: 3,
        last_heartbeat: new Date(),
        response_time_ms: 45.0,
        errors_last_hour: 2,
      });

      expect(result.executor_id).toBe('exec-001');
      expect(result.status).toBe('degraded');
      expect(result.cpu_usage_pct).toBe(95.0);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT (executor_id) DO UPDATE'),
        expect.arrayContaining(['exec-001', 'degraded', 95.0, 85.0, 8, 3])
      );
    });
  });

  describe('mapRowToEntity', () => {
    it('应该正确映射数据库行到健康实体', () => {
      const row = {
        id: 'health-001',
        executor_id: 'exec-001',
        status: 'healthy',
        cpu_usage_pct: 25.5,
        memory_usage_pct: 30.2,
        running_jobs: 3,
        queue_depth: 0,
        last_heartbeat: new Date(),
        response_time_ms: 12.5,
        errors_last_hour: 0,
      };

      const entity = repo.mapRowToEntity(row);

      expect(entity.id).toBe('health-001');
      expect(entity.executor_id).toBe('exec-001');
      expect(entity.status).toBe('healthy');
      expect(entity.cpu_usage_pct).toBe(25.5);
      expect(entity.memory_usage_pct).toBe(30.2);
      expect(entity.running_jobs).toBe(3);
      expect(entity.queue_depth).toBe(0);
      expect(entity.response_time_ms).toBe(12.5);
      expect(entity.errors_last_hour).toBe(0);
    });
  });
});