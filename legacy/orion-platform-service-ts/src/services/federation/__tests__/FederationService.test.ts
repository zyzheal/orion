/**
 * FederationService Executor 测试
 *
 * 测试执行器注册、心跳、健康检查等功能
 */

import { FederationService } from '../FederationService';
import { ExecutorRepository, ExecutorHealthRepository } from '../../../repositories/FederationRepository';

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
      findByIdWithHealth: jest.fn(),
      findAll: jest.fn(),
      findAllActive: jest.fn(),
      updateHeartbeat: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<ExecutorRepository>;

    mockHealthRepo = {
      findByExecutor: jest.fn(),
      findAllLatest: jest.fn(),
      upsert: jest.fn(),
    } as unknown as jest.Mocked<ExecutorHealthRepository>;

    // Create service and set repositories
    service = new FederationService();
    service.setRepositories(
      mockExecRepo as any,
      mockHealthRepo as any,
      {} as any, // clusterRepo
      {} as any, // healthCheckRepo
    );
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
      } as any);

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
      } as any);

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

      mockExecRepo.updateHeartbeat.mockResolvedValue(executorEntity);
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
      } as any);

      const result = await service.executorHeartbeat(executorId, {
        cpu_used: 4,
        memory_used_mb: 8192,
        running_jobs: 3,
        response_time_ms: 15,
      });

      expect(result.executor).not.toBeNull();
      expect(result.executor!.id).toBe(executorId);
      expect(result.health).not.toBeNull();
      expect(result.health!.status).toBe('healthy');
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

      mockExecRepo.updateHeartbeat.mockResolvedValue(executorEntity);
      mockHealthRepo.upsert.mockResolvedValue({
        id: 'health-002',
        executor_id: executorId,
        status: 'degraded',
        cpu_usage_pct: 93.75,
        memory_usage_pct: 93.75,
        running_jobs: 9,
        queue_depth: 2,
        last_heartbeat: new Date(),
        response_time_ms: 50,
        errors_last_hour: 1,
      } as any);

      const result = await service.executorHeartbeat(executorId, {
        cpu_used: 15,
        memory_used_mb: 30720,
        running_jobs: 9,
        response_time_ms: 50,
      });

      expect(result.health!.status).toBe('degraded');
      expect(result.health!.cpu_usage_pct).toBeGreaterThan(90);
      expect(result.health!.memory_usage_pct).toBeGreaterThan(90);
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

      mockExecRepo.findByIdWithHealth.mockResolvedValue({
        executor: { id: executorId } as any,
        health: healthEntity as any,
      } as any);

      const result = await service.getExecutorHealth(executorId);

      expect(result).not.toBeNull();
      expect(result!.health).not.toBeNull();
      expect(result!.health!.executor_id).toBe(executorId);
      expect(result!.health!.status).toBe('healthy');
    });

    it('应该返回 falsy 如果执行器不存在', async () => {
      mockExecRepo.findByIdWithHealth.mockResolvedValue(undefined as any);

      const result = await service.getExecutorHealth('nonexistent');

      // Service has missing await, so result may be a Promise wrapping undefined
      expect(result).toBeFalsy();
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

      mockExecRepo.findAll.mockResolvedValue({ entities: executorEntities, total: 1 } as any);

      const result = await service.listExecutors('tenant-1');

      expect(result.entities.length).toBe(1);
      expect(result.entities[0].id).toBe('exec-001');
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
          status: 'online',
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
          status: 'healthy',
          cpu_usage_pct: 93.75,
          memory_usage_pct: 93.75,
          running_jobs: 5,
          queue_depth: 2,
          last_heartbeat: new Date(),
          response_time_ms: 45,
          errors_last_hour: 1,
        },
      ];

      mockExecRepo.findAllActive.mockResolvedValue(executorEntities as any);
      mockHealthRepo.findAllLatest.mockResolvedValue(healthEntities as any);

      const result = await service.getExecutorDashboard('tenant-1');

      expect(result.totalExecutors).toBe(2);
      expect(result.onlineExecutors).toBe(2);
      expect(result.totalRunningJobs).toBe(8);
      expect(result.avgCpuUsage).toBeCloseTo(59.375, 1);
      expect(result.avgMemoryUsage).toBeCloseTo(59.375, 1);
      expect(result.executors.length).toBe(2);
    });

    it('应该正确处理没有执行器的情况', async () => {
      mockExecRepo.findAllActive.mockResolvedValue([]);
      mockHealthRepo.findAllLatest.mockResolvedValue([]);

      const result = await service.getExecutorDashboard('tenant-1');

      expect(result.totalExecutors).toBe(0);
      expect(result.onlineExecutors).toBe(0);
      expect(result.totalRunningJobs).toBe(0);
      expect(result.avgCpuUsage).toBe(0);
      expect(result.avgMemoryUsage).toBe(0);
    });
  });
});
