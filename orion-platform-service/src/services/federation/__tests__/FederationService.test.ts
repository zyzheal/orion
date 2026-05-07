/**
 * FederationService Executor 测试
 *
 * 测试执行器注册、心跳、健康检查、负载均衡等功能
 */

import { FederationService, ExecutorInfo, ExecutorHealth } from '../FederationService';
import { ExecutorRepository, ExecutorHealthRepository } from '../../../repositories/FederationRepository';

// Mock DatabasePool
const mockPool = {
  query: jest.fn(),
};

describe('FederationService - Executor Management', () => {
  let service: FederationService;
  let mockExecRepo: jest.Mocked<ExecutorRepository>;
  let mockHealthRepo: jest.Mocked<ExecutorHealthRepository>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock repositories
    mockExecRepo = {
      create: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      findAllActive: jest.fn(),
      updateHeartbeat: jest.fn(),
      delete: jest.fn(),
    } as jest.Mocked<ExecutorRepository>;

    mockHealthRepo = {
      findByExecutor: jest.fn(),
      findAllLatest: jest.fn(),
      upsert: jest.fn(),
    } as jest.Mocked<ExecutorHealthRepository>;

    // Create service with injected mock repositories
    service = new FederationService(mockPool as any, {
      execRepo: mockExecRepo as any,
      healthRepo: mockHealthRepo as any,
    });
  });

  describe('registerExecutor', () => {
    it('应该成功注册执行器', async () => {
      const executorEntity = {
        id: 'exec-001',
        cluster_id: 'cluster-east',
        name: 'executor-east-1',
        region: 'east',
        status: 'online',
        cpu_capacity: 16,
        memory_capacity_mb: 32768,
        cpu_used: 0,
        memory_used_mb: 0,
        running_jobs: 0,
        max_concurrent_jobs: 10,
        last_heartbeat: new Date(),
        registered_at: new Date(),
        labels: {},
      };

      mockExecRepo.create.mockResolvedValue(executorEntity);
      mockHealthRepo.upsert.mockResolvedValue({
        id: 'health-001',
        executor_id: 'exec-001',
        status: 'healthy',
        cpu_usage_pct: 0,
        memory_usage_pct: 0,
        running_jobs: 0,
        queue_depth: 0,
        last_heartbeat: new Date(),
        response_time_ms: 0,
        errors_last_hour: 0,
      });

      const result = await service.registerExecutor({
        cluster_id: 'cluster-east',
        name: 'executor-east-1',
        region: 'east',
      });

      expect(result.id).toBeDefined();
      expect(result.cluster_id).toBe('cluster-east');
      expect(result.name).toBe('executor-east-1');
      expect(result.status).toBe('online');
      expect(result.cpu_capacity).toBe(16);
      expect(result.max_concurrent_jobs).toBe(10);
    });

    it('应该使用自定义配置注册执行器', async () => {
      const executorEntity = {
        id: 'exec-002',
        cluster_id: 'cluster-west',
        name: 'executor-west-1',
        region: 'west',
        status: 'online',
        cpu_capacity: 32,
        memory_capacity_mb: 65536,
        cpu_used: 0,
        memory_used_mb: 0,
        running_jobs: 0,
        max_concurrent_jobs: 20,
        last_heartbeat: new Date(),
        registered_at: new Date(),
        labels: { tier: 'premium' },
      };

      mockExecRepo.create.mockResolvedValue(executorEntity);
      mockHealthRepo.upsert.mockResolvedValue({
        id: 'health-002',
        executor_id: 'exec-002',
        status: 'healthy',
        cpu_usage_pct: 0,
        memory_usage_pct: 0,
        running_jobs: 0,
        queue_depth: 0,
        last_heartbeat: new Date(),
        response_time_ms: 0,
        errors_last_hour: 0,
      });

      const result = await service.registerExecutor({
        cluster_id: 'cluster-west',
        name: 'executor-west-1',
        region: 'west',
        cpu_capacity: 32,
        memory_capacity_mb: 65536,
        max_concurrent_jobs: 20,
        labels: { tier: 'premium' },
      });

      expect(result.cpu_capacity).toBe(32);
      expect(result.memory_capacity_mb).toBe(65536);
      expect(result.max_concurrent_jobs).toBe(20);
      expect(result.labels).toEqual({ tier: 'premium' });
    });

    it('应该使用提供的 ID 注册执行器', async () => {
      const customId = 'custom-exec-123';
      const executorEntity = {
        id: customId,
        cluster_id: 'cluster-north',
        name: 'executor-north-1',
        region: 'north',
        status: 'online',
        cpu_capacity: 16,
        memory_capacity_mb: 32768,
        cpu_used: 0,
        memory_used_mb: 0,
        running_jobs: 0,
        max_concurrent_jobs: 10,
        last_heartbeat: new Date(),
        registered_at: new Date(),
        labels: {},
      };

      mockExecRepo.create.mockResolvedValue(executorEntity);
      mockHealthRepo.upsert.mockResolvedValue({
        id: 'health-123',
        executor_id: customId,
        status: 'healthy',
        cpu_usage_pct: 0,
        memory_usage_pct: 0,
        running_jobs: 0,
        queue_depth: 0,
        last_heartbeat: new Date(),
        response_time_ms: 0,
        errors_last_hour: 0,
      });

      const result = await service.registerExecutor({
        id: customId,
        cluster_id: 'cluster-north',
        name: 'executor-north-1',
        region: 'north',
      });

      expect(result.id).toBe(customId);
    });
  });

  describe('executorHeartbeat', () => {
    it('应该更新执行器心跳和健康状态', async () => {
      const executorId = 'exec-001';
      const executorEntity = {
        id: executorId,
        cluster_id: 'cluster-east',
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

      mockExecRepo.findById.mockResolvedValueOnce(executorEntity);
      mockExecRepo.updateHeartbeat.mockResolvedValue(executorEntity);
      mockExecRepo.findById.mockResolvedValueOnce(executorEntity);
      mockHealthRepo.upsert.mockResolvedValue({
        id: 'health-001',
        executor_id: executorId,
        status: 'healthy',
        cpu_usage_pct: 25,
        memory_usage_pct: 25,
        running_jobs: 3,
        queue_depth: 0,
        last_heartbeat: new Date(),
        response_time_ms: 15,
        errors_last_hour: 0,
      });

      const result = await service.executorHeartbeat(executorId, {
        cpu_used: 4,
        memory_used_mb: 8192,
        running_jobs: 3,
        response_time_ms: 15,
      });

      expect(result.executor_id).toBe(executorId);
      expect(result.status).toBe('healthy');
      expect(result.cpu_usage_pct).toBe(25);
      expect(result.memory_usage_pct).toBe(25);
      expect(result.running_jobs).toBe(3);
    });

    it('应该在资源使用率高时标记为 degraded', async () => {
      const executorId = 'exec-002';
      const executorEntity = {
        id: executorId,
        cluster_id: 'cluster-west',
        name: 'executor-west-1',
        region: 'west',
        status: 'online',
        cpu_capacity: 16,
        memory_capacity_mb: 32768,
        cpu_used: 15, // 93.75%
        memory_used_mb: 30720, // 93.75%
        running_jobs: 9,
        max_concurrent_jobs: 10,
        last_heartbeat: new Date(),
        registered_at: new Date(),
        labels: {},
      };

      mockExecRepo.findById.mockResolvedValueOnce(executorEntity);
      mockExecRepo.updateHeartbeat.mockResolvedValue(executorEntity);
      mockExecRepo.findById.mockResolvedValueOnce(executorEntity);
      mockHealthRepo.upsert.mockResolvedValue({
        id: 'health-002',
        executor_id: executorId,
        status: 'degraded',
        cpu_usage_pct: 93.8,
        memory_usage_pct: 93.8,
        running_jobs: 9,
        queue_depth: 2,
        last_heartbeat: new Date(),
        response_time_ms: 50,
        errors_last_hour: 1,
      });

      const result = await service.executorHeartbeat(executorId, {
        cpu_used: 15,
        memory_used_mb: 30720,
        running_jobs: 9,
        response_time_ms: 50,
      });

      expect(result.status).toBe('degraded');
      expect(result.cpu_usage_pct).toBeGreaterThan(90);
      expect(result.memory_usage_pct).toBeGreaterThan(90);
    });

    it('应该在执行器不存在时抛出错误', async () => {
      const executorId = 'nonexistent-exec';

      mockExecRepo.findById.mockResolvedValue(undefined);

      await expect(
        service.executorHeartbeat(executorId, { cpu_used: 4 })
      ).rejects.toThrow(`Executor '${executorId}' not found`);
    });
  });

  describe('getExecutorHealth', () => {
    it('应该返回执行器健康状态', async () => {
      const executorId = 'exec-001';
      const healthEntity = {
        id: 'health-001',
        executor_id: executorId,
        status: 'healthy',
        cpu_usage_pct: 25.5,
        memory_usage_pct: 30.2,
        running_jobs: 3,
        queue_depth: 0,
        last_heartbeat: new Date(),
        response_time_ms: 12.5,
        errors_last_hour: 0,
      };

      mockHealthRepo.findByExecutor.mockResolvedValue(healthEntity);

      const result = await service.getExecutorHealth(executorId);

      expect(result).not.toBeNull();
      expect(result!.executor_id).toBe(executorId);
      expect(result!.status).toBe('healthy');
      expect(result!.cpu_usage_pct).toBe(25.5);
      expect(result!.memory_usage_pct).toBe(30.2);
    });

    it('应该返回 null 如果健康记录不存在', async () => {
      const executorId = 'exec-no-health';

      mockHealthRepo.findByExecutor.mockResolvedValue(undefined);

      const result = await service.getExecutorHealth(executorId);

      expect(result).toBeNull();
    });
  });

  describe('getAllExecutorHealth', () => {
    it('应该返回所有执行器的健康状态', async () => {
      const healthEntities = [
        {
          id: 'health-001',
          executor_id: 'exec-001',
          status: 'healthy',
          cpu_usage_pct: 25,
          memory_usage_pct: 30,
          running_jobs: 3,
          queue_depth: 0,
          last_heartbeat: new Date(),
          response_time_ms: 12,
          errors_last_hour: 0,
        },
        {
          id: 'health-002',
          executor_id: 'exec-002',
          status: 'degraded',
          cpu_usage_pct: 95,
          memory_usage_pct: 85,
          running_jobs: 8,
          queue_depth: 3,
          last_heartbeat: new Date(),
          response_time_ms: 45,
          errors_last_hour: 2,
        },
      ];

      mockHealthRepo.findAllLatest.mockResolvedValue(healthEntities);

      const result = await service.getAllExecutorHealth();

      expect(result.length).toBe(2);
      expect(result[0].executor_id).toBe('exec-001');
      expect(result[1].executor_id).toBe('exec-002');
    });
  });

  describe('deregisterExecutor', () => {
    it('应该注销执行器', async () => {
      const executorId = 'exec-001';

      mockExecRepo.delete.mockResolvedValue(true);

      const result = await service.deregisterExecutor(executorId);

      expect(result).toBe(true);
      expect(mockExecRepo.delete).toHaveBeenCalledWith(executorId);
    });

    it('应该清理心跳定时器', async () => {
      const executorId = 'exec-001';
      const timer = setInterval(() => {}, 1000);

      // Setup timer in service
      (service as any).heartbeatTimers.set(executorId, timer);

      mockExecRepo.delete.mockResolvedValue(true);

      const result = await service.deregisterExecutor(executorId);

      expect(result).toBe(true);
      expect((service as any).heartbeatTimers.has(executorId)).toBe(false);
    });
  });

  describe('selectBestExecutor', () => {
    it('应该选择负载最低的执行器', async () => {
      const executors = [
        {
          id: 'exec-001',
          cluster_id: 'cluster-1',
          name: 'exec-1',
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
          cluster_id: 'cluster-1',
          name: 'exec-2',
          region: 'east',
          status: 'online',
          cpu_capacity: 16,
          memory_capacity_mb: 32768,
          cpu_used: 12,
          memory_used_mb: 24576,
          running_jobs: 7,
          max_concurrent_jobs: 10,
          last_heartbeat: new Date(),
          registered_at: new Date(),
          labels: {},
        },
      ];

      mockExecRepo.findAllActive.mockResolvedValue(executors);

      const result = await service.selectBestExecutor();

      expect(result).not.toBeNull();
      expect(result!.id).toBe('exec-001'); // Lower load
    });

    it('应该考虑资源要求选择执行器', async () => {
      const executors = [
        {
          id: 'exec-001',
          cluster_id: 'cluster-1',
          name: 'exec-1',
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
      ];

      mockExecRepo.findAllActive.mockResolvedValue(executors);

      const result = await service.selectBestExecutor({ cpu: 4, memory_mb: 4096 });

      expect(result).not.toBeNull();
      expect(result!.id).toBe('exec-001');
    });

    it('应该返回 null 如果没有可用执行器', async () => {
      mockExecRepo.findAllActive.mockResolvedValue([]);

      const result = await service.selectBestExecutor();

      expect(result).toBeNull();
    });

    it('应该返回 null 如果所有执行器已满', async () => {
      const executors = [
        {
          id: 'exec-001',
          cluster_id: 'cluster-1',
          name: 'exec-1',
          region: 'east',
          status: 'online',
          cpu_capacity: 16,
          memory_capacity_mb: 32768,
          cpu_used: 15,
          memory_used_mb: 30720,
          running_jobs: 10,
          max_concurrent_jobs: 10,
          last_heartbeat: new Date(),
          registered_at: new Date(),
          labels: {},
        },
      ];

      mockExecRepo.findAllActive.mockResolvedValue(executors);

      const result = await service.selectBestExecutor();

      expect(result).toBeNull();
    });
  });

  describe('getExecutorDashboard', () => {
    it('应该返回完整的执行器仪表盘数据', async () => {
      const executorEntities = [
        {
          id: 'exec-001',
          cluster_id: 'cluster-1',
          name: 'exec-1',
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
          name: 'exec-2',
          region: 'west',
          status: 'degraded',
          cpu_capacity: 16,
          memory_capacity_mb: 32768,
          cpu_used: 15,
          memory_used_mb: 30720,
          running_jobs: 5,
          max_concurrent_jobs: 10,
          last_heartbeat: new Date(),
          registered_at: new Date(),
          labels: {},
        },
      ];

      const healthEntities = [
        {
          id: 'health-001',
          executor_id: 'exec-001',
          status: 'healthy',
          cpu_usage_pct: 25,
          memory_usage_pct: 25,
          running_jobs: 3,
          queue_depth: 0,
          last_heartbeat: new Date(),
          response_time_ms: 12,
          errors_last_hour: 0,
        },
        {
          id: 'health-002',
          executor_id: 'exec-002',
          status: 'degraded',
          cpu_usage_pct: 93.8,
          memory_usage_pct: 93.8,
          running_jobs: 5,
          queue_depth: 2,
          last_heartbeat: new Date(),
          response_time_ms: 45,
          errors_last_hour: 1,
        },
      ];

      mockExecRepo.findAll.mockResolvedValue({ entities: executorEntities, total: 2 });
      mockHealthRepo.findAllLatest.mockResolvedValue(healthEntities);

      const result = await service.getExecutorDashboard('tenant-1');

      expect(result.total_executors).toBe(2);
      expect(result.online_executors).toBe(1);
      expect(result.degraded_executors).toBe(1);
      expect(result.offline_executors).toBe(0);
      expect(result.total_running_jobs).toBe(8);
      expect(result.avg_cpu_usage).toBeCloseTo(59.4, 1);
      expect(result.avg_memory_usage).toBeCloseTo(59.4, 1);
      expect(result.executors.length).toBe(2);
      expect(result.health.length).toBe(2);
    });

    it('应该正确处理没有执行器的情况', async () => {
      mockExecRepo.findAll.mockResolvedValue({ entities: [], total: 0 });
      mockHealthRepo.findAllLatest.mockResolvedValue([]);

      const result = await service.getExecutorDashboard('tenant-1');

      expect(result.total_executors).toBe(0);
      expect(result.online_executors).toBe(0);
      expect(result.total_running_jobs).toBe(0);
      expect(result.avg_cpu_usage).toBe(0);
      expect(result.avg_memory_usage).toBe(0);
    });
  });

  describe('listExecutors', () => {
    it('应该返回执行器列表', async () => {
      const executorEntities = [
        {
          id: 'exec-001',
          cluster_id: 'cluster-1',
          name: 'exec-1',
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
      ];

      mockExecRepo.findAll.mockResolvedValue({ entities: executorEntities, total: 1 });

      const result = await service.listExecutors('tenant-1');

      expect(result.length).toBe(1);
      expect(result[0].id).toBe('exec-001');
    });
  });

  describe('getExecutor', () => {
    it('应该返回指定执行器', async () => {
      const executorEntity = {
        id: 'exec-001',
        cluster_id: 'cluster-1',
        name: 'exec-1',
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

      mockExecRepo.findById.mockResolvedValue(executorEntity);

      const result = await service.getExecutor('exec-001');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('exec-001');
    });

    it('应该返回 null 如果执行器不存在', async () => {
      mockExecRepo.findById.mockResolvedValue(undefined);

      const result = await service.getExecutor('nonexistent');

      expect(result).toBeNull();
    });
  });
});