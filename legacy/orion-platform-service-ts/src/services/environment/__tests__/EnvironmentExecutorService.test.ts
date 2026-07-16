/**
 * EnvironmentExecutorService Tests - Hibernation, wake-up, TTL management
 */

// Mock @kubernetes/client-node before importing the service (module-level require)
jest.mock('@kubernetes/client-node', () => {
  throw new Error('K8s not available in tests');
});

import {
  EnvironmentExecutorService,
  EnvironmentExecutorServiceError,
  EnvironmentStatus,
} from '../EnvironmentExecutorService';
import { EnvironmentExecutorRepository, EnvironmentExecutorStateEntity } from '../../../repositories/EnvironmentExecutorRepository';

// Mock the repository
jest.mock('../../../repositories/EnvironmentExecutorRepository');

describe('EnvironmentExecutorService', () => {
  let service: EnvironmentExecutorService;
  let mockRepo: jest.Mocked<EnvironmentExecutorRepository>;

  const mockDb = { query: jest.fn() };

  // Helper to create a default status entity
  function makeEntity(overrides: Partial<EnvironmentExecutorStateEntity> = {}): EnvironmentExecutorStateEntity {
    return {
      id: 'state-1',
      envId: 'env-1',
      tenantId: 'tenant-1',
      state: 'active',
      lastActiveAt: new Date(),
      lastCheckedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();

    service = new EnvironmentExecutorService(mockDb as any);
    mockRepo = (EnvironmentExecutorRepository as jest.MockedClass<typeof EnvironmentExecutorRepository>).mock
      .instances[0] as jest.Mocked<EnvironmentExecutorRepository>;

    // Inject the mock repo
    service.setRepository(mockRepo);
  });

  describe('isK8sAvailable', () => {
    it('should return false when K8s client is not initialized', () => {
      expect(service.isK8sAvailable()).toBe(false);
    });
  });

  describe('hibernateEnvironment', () => {
    it('should throw INVALID_INPUT when tenantId is empty', async () => {
      await expect(service.hibernateEnvironment('', 'env-1')).rejects.toThrow(EnvironmentExecutorServiceError);
      await expect(service.hibernateEnvironment('', 'env-1')).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    });

    it('should throw INVALID_INPUT when envId is empty', async () => {
      await expect(service.hibernateEnvironment('tenant-1', '')).rejects.toThrow(EnvironmentExecutorServiceError);
      await expect(service.hibernateEnvironment('tenant-1', '')).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    });

    it('should throw ALREADY_HIBERNATED when environment is already hibernated', async () => {
      mockRepo.findByTenantAndEnv.mockResolvedValue(makeEntity({ state: 'hibernated' }));

      await expect(service.hibernateEnvironment('tenant-1', 'env-1')).rejects.toThrow(EnvironmentExecutorServiceError);
      await expect(service.hibernateEnvironment('tenant-1', 'env-1')).rejects.toMatchObject({ code: 'ALREADY_HIBERNATED' });
    });

    it('should hibernate an active environment in simulation mode', async () => {
      const now = new Date();
      mockRepo.findByTenantAndEnv.mockResolvedValue(makeEntity({
        state: 'active',
        lastActiveAt: now,
        previousReplicas: 3,
      }));
      mockRepo.upsert.mockResolvedValue(makeEntity({ state: 'hibernated' }));

      const result = await service.hibernateEnvironment('tenant-1', 'env-1');

      expect(result.state).toBe('hibernated');
      expect(result.hibernatedAt).toBeDefined();
      expect(mockRepo.upsert).toHaveBeenCalled();
    });

    it('should set previousReplicas from originalReplicaCount for new hibernation', async () => {
      mockRepo.findByTenantAndEnv.mockResolvedValue(makeEntity({
        state: 'active',
        previousReplicas: undefined,
        originalReplicaCount: undefined,
      }));
      mockRepo.upsert.mockResolvedValue(makeEntity({ state: 'hibernated' }));

      const result = await service.hibernateEnvironment('tenant-1', 'env-1');

      expect(result.state).toBe('hibernated');
    });
  });

  describe('wakeEnvironment', () => {
    it('should throw INVALID_INPUT when tenantId is empty', async () => {
      await expect(service.wakeEnvironment('', 'env-1')).rejects.toThrow(EnvironmentExecutorServiceError);
      await expect(service.wakeEnvironment('', 'env-1')).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    });

    it('should throw INVALID_INPUT when envId is empty', async () => {
      await expect(service.wakeEnvironment('tenant-1', '')).rejects.toThrow(EnvironmentExecutorServiceError);
    });

    it('should throw NOT_HIBERNATED when environment is not hibernated', async () => {
      mockRepo.findByTenantAndEnv.mockResolvedValue(makeEntity({ state: 'active' }));

      await expect(service.wakeEnvironment('tenant-1', 'env-1')).rejects.toThrow(EnvironmentExecutorServiceError);
      await expect(service.wakeEnvironment('tenant-1', 'env-1')).rejects.toMatchObject({ code: 'NOT_HIBERNATED' });
    });

    it('should wake a hibernated environment in simulation mode', async () => {
      mockRepo.findByTenantAndEnv.mockResolvedValue(makeEntity({
        state: 'hibernated',
        previousReplicas: 3,
        hibernatedAt: new Date(),
      }));
      mockRepo.upsert.mockResolvedValue(makeEntity({ state: 'active' }));

      const result = await service.wakeEnvironment('tenant-1', 'env-1');

      expect(result.state).toBe('active');
      expect(result.hibernatedAt).toBeUndefined();
      expect(mockRepo.upsert).toHaveBeenCalled();
    });
  });

  describe('getEnvironmentStatus', () => {
    it('should throw INVALID_INPUT for missing tenantId', async () => {
      await expect(service.getEnvironmentStatus('', 'env-1')).rejects.toThrow(EnvironmentExecutorServiceError);
      await expect(service.getEnvironmentStatus('', 'env-1')).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    });

    it('should throw INVALID_INPUT for missing envId', async () => {
      await expect(service.getEnvironmentStatus('tenant-1', '')).rejects.toThrow(EnvironmentExecutorServiceError);
    });

    it('should return existing status when found', async () => {
      mockRepo.findByTenantAndEnv.mockResolvedValue(makeEntity({
        state: 'active',
        ttlSeconds: 3600,
      }));

      const result = await service.getEnvironmentStatus('tenant-1', 'env-1');

      expect(result.envId).toBe('env-1');
      expect(result.tenantId).toBe('tenant-1');
      expect(result.state).toBe('active');
      expect(result.ttlSeconds).toBe(3600);
    });

    it('should create default status when not found', async () => {
      mockRepo.findByTenantAndEnv.mockResolvedValue(undefined);
      mockRepo.upsert.mockResolvedValue(makeEntity({ state: 'active' }));

      const result = await service.getEnvironmentStatus('tenant-1', 'new-env');

      expect(result.state).toBe('active');
      expect(mockRepo.upsert).toHaveBeenCalled();
    });
  });

  describe('getAllEnvironmentStatuses', () => {
    it('should return all statuses for a tenant', async () => {
      mockRepo.findByTenant.mockResolvedValue([
        makeEntity({ id: 's1', envId: 'env-1', state: 'active' }),
        makeEntity({ id: 's2', envId: 'env-2', state: 'hibernated' }),
      ]);

      const result = await service.getAllEnvironmentStatuses('tenant-1');

      expect(result).toHaveLength(2);
      expect(result[0].envId).toBe('env-1');
      expect(result[1].envId).toBe('env-2');
    });

    it('should return empty array when no environments exist', async () => {
      mockRepo.findByTenant.mockResolvedValue([]);

      const result = await service.getAllEnvironmentStatuses('tenant-1');

      expect(result).toEqual([]);
    });
  });

  describe('setEnvironmentTTL', () => {
    it('should throw INVALID_INPUT for missing params', async () => {
      await expect(service.setEnvironmentTTL('', 'env-1', 3600)).rejects.toThrow(EnvironmentExecutorServiceError);
      await expect(service.setEnvironmentTTL('tenant-1', '', 3600)).rejects.toThrow(EnvironmentExecutorServiceError);
    });

    it('should throw INVALID_INPUT for negative TTL', async () => {
      mockRepo.findByTenantAndEnv.mockResolvedValue(makeEntity());
      await expect(service.setEnvironmentTTL('tenant-1', 'env-1', -1)).rejects.toThrow(EnvironmentExecutorServiceError);
      await expect(service.setEnvironmentTTL('tenant-1', 'env-1', -1)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    });

    it('should update TTL for an environment', async () => {
      mockRepo.findByTenantAndEnv.mockResolvedValue(makeEntity({ ttlSeconds: undefined }));
      mockRepo.upsert.mockResolvedValue(makeEntity({ ttlSeconds: 7200 }));

      const result = await service.setEnvironmentTTL('tenant-1', 'env-1', 7200);

      expect(result.ttlSeconds).toBe(7200);
      expect(mockRepo.upsert).toHaveBeenCalled();
    });

    it('should allow setting TTL to 0 (disable auto-hibernate)', async () => {
      mockRepo.findByTenantAndEnv.mockResolvedValue(makeEntity({ ttlSeconds: 3600 }));
      mockRepo.upsert.mockResolvedValue(makeEntity({ ttlSeconds: 0 }));

      const result = await service.setEnvironmentTTL('tenant-1', 'env-1', 0);

      expect(result.ttlSeconds).toBe(0);
    });
  });

  describe('configureK8s', () => {
    it('should throw INVALID_INPUT for missing params', async () => {
      await expect(service.configureK8s('', 'env-1', { deploymentName: 'app' })).rejects.toThrow(EnvironmentExecutorServiceError);
      await expect(service.configureK8s('tenant-1', '', { deploymentName: 'app' })).rejects.toThrow(EnvironmentExecutorServiceError);
    });

    it('should throw INVALID_INPUT for missing deploymentName', async () => {
      mockRepo.findByTenantAndEnv.mockResolvedValue(makeEntity());
      await expect(service.configureK8s('tenant-1', 'env-1', { deploymentName: '' })).rejects.toThrow(EnvironmentExecutorServiceError);
      await expect(service.configureK8s('tenant-1', 'env-1', { deploymentName: '' })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    });

    it('should store K8s config for an environment', async () => {
      mockRepo.findByTenantAndEnv.mockResolvedValue(makeEntity());
      mockRepo.upsert.mockResolvedValue(makeEntity({
        k8sDeploymentName: 'my-app',
        k8sNamespace: 'production',
        k8sLabelSelector: 'app=my-app',
      }));

      const result = await service.configureK8s('tenant-1', 'env-1', {
        deploymentName: 'my-app',
        namespace: 'production',
        labelSelector: 'app=my-app',
      });

      expect(result.k8sConfig).toBeDefined();
      expect(result.k8sConfig?.deploymentName).toBe('my-app');
      expect(result.k8sConfig?.namespace).toBe('production');
    });
  });

  describe('getK8sScaleInfo', () => {
    it('should throw INVALID_INPUT for missing params', async () => {
      await expect(service.getK8sScaleInfo('', 'env-1')).rejects.toThrow(EnvironmentExecutorServiceError);
      await expect(service.getK8sScaleInfo('tenant-1', '')).rejects.toThrow(EnvironmentExecutorServiceError);
    });

    it('should return scale info for active environment', async () => {
      mockRepo.findByTenantAndEnv.mockResolvedValue(makeEntity({
        state: 'active',
        previousReplicas: 3,
      }));

      const result = await service.getK8sScaleInfo('tenant-1', 'env-1');

      expect(result.currentReplicas).toBe(3);
      expect(result.k8sAvailable).toBe(false);
    });

    it('should return 0 replicas for hibernated environment', async () => {
      mockRepo.findByTenantAndEnv.mockResolvedValue(makeEntity({
        state: 'hibernated',
        previousReplicas: 3,
      }));

      const result = await service.getK8sScaleInfo('tenant-1', 'env-1');

      expect(result.currentReplicas).toBe(0);
    });
  });

  describe('recordActivity', () => {
    it('should throw INVALID_INPUT for missing params', async () => {
      await expect(service.recordActivity('', 'env-1')).rejects.toThrow(EnvironmentExecutorServiceError);
      await expect(service.recordActivity('tenant-1', '')).rejects.toThrow(EnvironmentExecutorServiceError);
    });

    it('should update lastActiveAt for active environment', async () => {
      mockRepo.findByTenantAndEnv.mockResolvedValue(makeEntity({ state: 'active' }));
      mockRepo.upsert.mockResolvedValue(makeEntity({ state: 'active' }));

      const result = await service.recordActivity('tenant-1', 'env-1');

      expect(result.state).toBe('active');
      expect(mockRepo.upsert).toHaveBeenCalled();
    });

    it('should transition hibernated environment to waking state', async () => {
      mockRepo.findByTenantAndEnv.mockResolvedValue(makeEntity({
        state: 'hibernated',
        hibernatedAt: new Date(),
      }));
      mockRepo.upsert.mockResolvedValue(makeEntity({ state: 'waking' }));

      const result = await service.recordActivity('tenant-1', 'env-1');

      expect(result.state).toBe('waking');
      expect(result.hibernatedAt).toBeUndefined();
    });
  });

  describe('checkTTLAndHibernate', () => {
    it('should throw INVALID_INPUT for missing tenantId', async () => {
      await expect(service.checkTTLAndHibernate('')).rejects.toThrow(EnvironmentExecutorServiceError);
    });

    it('should hibernate environments that exceeded TTL', async () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      mockRepo.findActiveByTenant.mockResolvedValue([
        makeEntity({
          envId: 'env-idle',
          state: 'active',
          ttlSeconds: 3600, // 1 hour TTL
          lastActiveAt: twoHoursAgo,
        }),
      ]);
      mockRepo.findByTenantAndEnv.mockResolvedValue(makeEntity({
        envId: 'env-idle',
        state: 'active',
        ttlSeconds: 3600,
        lastActiveAt: twoHoursAgo,
      }));
      mockRepo.upsert.mockResolvedValue(makeEntity({ state: 'hibernated' }));

      const result = await service.checkTTLAndHibernate('tenant-1');

      expect(result).toHaveLength(1);
      expect(result[0].state).toBe('hibernated');
    });

    it('should skip environments without TTL configured', async () => {
      mockRepo.findActiveByTenant.mockResolvedValue([
        makeEntity({ envId: 'env-1', state: 'active', ttlSeconds: undefined }),
      ]);

      const result = await service.checkTTLAndHibernate('tenant-1');

      expect(result).toHaveLength(0);
    });

    it('should skip environments that have not exceeded TTL', async () => {
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
      mockRepo.findActiveByTenant.mockResolvedValue([
        makeEntity({
          envId: 'env-active',
          state: 'active',
          ttlSeconds: 3600, // 1 hour TTL
          lastActiveAt: fiveMinAgo,
        }),
      ]);

      const result = await service.checkTTLAndHibernate('tenant-1');

      expect(result).toHaveLength(0);
    });

    it('should return empty array when no active environments', async () => {
      mockRepo.findActiveByTenant.mockResolvedValue([]);

      const result = await service.checkTTLAndHibernate('tenant-1');

      expect(result).toEqual([]);
    });
  });

  describe('k8sConfig entityToDomain mapping', () => {
    it('should map k8s fields from entity to k8sConfig', async () => {
      mockRepo.findByTenantAndEnv.mockResolvedValue(makeEntity({
        k8sDeploymentName: 'web-app',
        k8sNamespace: 'staging',
        k8sLabelSelector: 'app=web',
        k8sScaleStatefulSets: true,
        k8sHpaName: 'web-hpa',
      }));

      const result = await service.getEnvironmentStatus('tenant-1', 'env-1');

      expect(result.k8sConfig).toEqual({
        namespace: 'staging',
        deploymentName: 'web-app',
        labelSelector: 'app=web',
        scaleStatefulSets: true,
        hpaName: 'web-hpa',
      });
    });

    it('should not set k8sConfig when k8sDeploymentName is absent', async () => {
      mockRepo.findByTenantAndEnv.mockResolvedValue(makeEntity({
        k8sDeploymentName: undefined,
      }));

      const result = await service.getEnvironmentStatus('tenant-1', 'env-1');

      expect(result.k8sConfig).toBeUndefined();
    });
  });
});
