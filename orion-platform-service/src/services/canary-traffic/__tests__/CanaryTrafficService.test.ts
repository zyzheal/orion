/**
 * CanaryTrafficService 单元测试
 *
 * 覆盖：构造函数、内存模式 CRUD、流量规则设置、
 * 金丝雀部署创建/列表/获取、提升/回滚、错误处理
 */

import { CanaryTrafficService, CreateCanaryInput, TrafficRules } from '../CanaryTrafficService';
import { OrionError, ErrorCode } from '../../../errors';

// ==================== Mocks ====================

const mockConfigRepo = {
  findByCanaryId: jest.fn(),
  findAll: jest.fn(),
  upsertConfig: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

const mockHistoryRepo = {
  findByCanaryId: jest.fn(),
};

jest.mock('../../../repositories/TrafficManagerRepository', () => ({
  TrafficConfigRepository: jest.fn().mockImplementation(() => mockConfigRepo),
  TrafficHistoryRepository: jest.fn().mockImplementation(() => mockHistoryRepo),
}));

jest.mock('pino', () => {
  return jest.fn().mockReturnValue({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  });
});

// ==================== Tests ====================

// We need to clear the module-level canaryDeployments Map between tests.
// Import the module to access internal state via service methods.
let canaryCounter = 0;

describe('CanaryTrafficService', () => {
  let service: CanaryTrafficService;

  beforeEach(async () => {
    jest.clearAllMocks();
    canaryCounter++;
    // Use in-memory mode (no DB)
    service = new CanaryTrafficService();
    // Clear module-level Map to ensure test isolation
    await service.clearAllDeployments();
  });

  // ==================== Constructor ====================

  describe('constructor', () => {
    it('should create service in in-memory mode when no db provided', () => {
      const svc = new CanaryTrafficService();
      expect(svc).toBeDefined();
    });

    it('should create service with DB pool when provided', () => {
      const mockDb = { query: jest.fn() };
      // When db is provided, repositories are initialized
      const svc = new CanaryTrafficService(mockDb as any);
      expect(svc).toBeDefined();
    });
  });

  // ==================== setRepositories ====================

  describe('setRepositories', () => {
    it('should set repositories for lazy initialization', () => {
      const svc = new CanaryTrafficService();
      svc.setRepositories(mockConfigRepo as any, mockHistoryRepo as any);
      // After setting repos, service should use DB mode
      // We verify by checking that getTrafficConfig calls repo
      svc.getTrafficConfig('test-id');
      expect(mockConfigRepo.findByCanaryId).toHaveBeenCalledWith('test-id');
    });
  });

  // ==================== setTrafficRules (in-memory mode) ====================

  describe('setTrafficRules (in-memory mode)', () => {
    it('should create traffic config with default values', async () => {
      const rules: TrafficRules = {
        canary_id: 'canary-1',
        strategy: 'weighted',
      };

      const result = await service.setTrafficRules(rules);

      expect(result.canary_id).toBe('canary-1');
      expect(result.strategy).toBe('weighted');
      expect(result.baseline_weight).toBe(90);
      expect(result.canary_weight).toBe(10);
      expect(result.namespace).toBe('default');
      expect(result.phase).toBe('initial');
    });

    it('should use custom weights when provided', async () => {
      const rules: TrafficRules = {
        canary_id: 'canary-2',
        strategy: 'weighted',
        baseline_weight: 80,
        canary_weight: 20,
      };

      const result = await service.setTrafficRules(rules);

      expect(result.baseline_weight).toBe(80);
      expect(result.canary_weight).toBe(20);
    });

    it('should use custom host and namespace', async () => {
      const rules: TrafficRules = {
        canary_id: 'canary-3',
        strategy: 'istio',
        host: 'my-service.example.com',
        namespace: 'production',
      };

      const result = await service.setTrafficRules(rules);

      expect(result.host).toBe('my-service.example.com');
      expect(result.namespace).toBe('production');
    });

    it('should set canary_destination and baseline_destination', async () => {
      const rules: TrafficRules = {
        canary_id: 'canary-4',
        strategy: 'weighted',
        baseline_destination: 'http://baseline.svc',
        canary_destination: 'http://canary.svc',
      };

      const result = await service.setTrafficRules(rules);

      expect(result.baseline_destination).toBe('http://baseline.svc');
      expect(result.canary_destination).toBe('http://canary.svc');
    });
  });

  // ==================== setTrafficRules (DB mode) ====================

  describe('setTrafficRules (DB mode)', () => {
    beforeEach(() => {
      service.setRepositories(mockConfigRepo as any, mockHistoryRepo as any);
    });

    it('should update existing config when found', async () => {
      const existingConfig = { id: 'c1', canary_id: 'canary-1', strategy: 'weighted' };
      mockConfigRepo.findByCanaryId.mockResolvedValue(existingConfig);
      mockConfigRepo.update.mockResolvedValue({ ...existingConfig, canary_weight: 30 });

      const result = await service.setTrafficRules({
        canary_id: 'canary-1',
        strategy: 'weighted',
        canary_weight: 30,
      });

      expect(mockConfigRepo.findByCanaryId).toHaveBeenCalledWith('canary-1');
      expect(mockConfigRepo.update).toHaveBeenCalledWith('canary-1', expect.objectContaining({
        canary_weight: 30,
      }));
    });

    it('should upsert config when not found', async () => {
      mockConfigRepo.findByCanaryId.mockResolvedValue(undefined);
      mockConfigRepo.upsertConfig.mockResolvedValue({
        id: 'new-config',
        canary_id: 'canary-new',
        strategy: 'weighted',
      });

      const result = await service.setTrafficRules({
        canary_id: 'canary-new',
        strategy: 'weighted',
      });

      expect(mockConfigRepo.upsertConfig).toHaveBeenCalledWith(expect.objectContaining({
        canary_id: 'canary-new',
        strategy: 'weighted',
      }));
    });
  });

  // ==================== getTrafficConfig ====================

  describe('getTrafficConfig', () => {
    it('should return config from in-memory store', async () => {
      await service.setTrafficRules({ canary_id: 'c1', strategy: 'weighted' });

      const result = await service.getTrafficConfig('c1');

      expect(result).not.toBeNull();
      expect(result!.canary_id).toBe('c1');
    });

    it('should return null for non-existent config (in-memory)', async () => {
      const result = await service.getTrafficConfig('nonexistent');
      expect(result).toBeNull();
    });

    it('should return config from DB when repos set', async () => {
      service.setRepositories(mockConfigRepo as any, mockHistoryRepo as any);
      mockConfigRepo.findByCanaryId.mockResolvedValue({ id: 'c1', canary_id: 'c1' });

      const result = await service.getTrafficConfig('c1');

      expect(result).toEqual({ id: 'c1', canary_id: 'c1' });
    });

    it('should return null when DB returns undefined', async () => {
      service.setRepositories(mockConfigRepo as any, mockHistoryRepo as any);
      mockConfigRepo.findByCanaryId.mockResolvedValue(undefined);

      const result = await service.getTrafficConfig('nonexistent');

      expect(result).toBeNull();
    });
  });

  // ==================== getTrafficConfigByCanaryId (alias) ====================

  describe('getTrafficConfigByCanaryId', () => {
    it('should be an alias for getTrafficConfig', async () => {
      await service.setTrafficRules({ canary_id: 'c1', strategy: 'weighted' });

      const result = await service.getTrafficConfigByCanaryId('c1');

      expect(result).not.toBeNull();
      expect(result!.canary_id).toBe('c1');
    });
  });

  // ==================== updateTraffic ====================

  describe('updateTraffic', () => {
    it('should update existing traffic config', async () => {
      await service.setTrafficRules({ canary_id: 'c1', strategy: 'weighted', canary_weight: 10 });

      const result = await service.updateTraffic('c1', { canary_weight: 30 });

      expect(result).not.toBeNull();
      expect(result!.canary_weight).toBe(30);
    });

    it('should return null for non-existent config', async () => {
      const result = await service.updateTraffic('nonexistent', { canary_weight: 50 });
      expect(result).toBeNull();
    });

    it('should preserve existing values when partial update', async () => {
      await service.setTrafficRules({
        canary_id: 'c1',
        strategy: 'weighted',
        host: 'my-host.com',
        canary_weight: 10,
      });

      const result = await service.updateTraffic('c1', { canary_weight: 20 });

      expect(result!.canary_weight).toBe(20);
      expect(result!.host).toBe('my-host.com');
    });
  });

  // ==================== deleteTraffic ====================

  describe('deleteTraffic', () => {
    it('should delete traffic config from in-memory store', async () => {
      await service.setTrafficRules({ canary_id: 'c1', strategy: 'weighted' });

      const deleted = await service.deleteTraffic('c1');

      expect(deleted).toBe(true);

      const config = await service.getTrafficConfig('c1');
      expect(config).toBeNull();
    });

    it('should return true even for non-existent config (in-memory)', async () => {
      const deleted = await service.deleteTraffic('nonexistent');
      expect(deleted).toBe(true);
    });

    it('should delete from DB when repos set', async () => {
      service.setRepositories(mockConfigRepo as any, mockHistoryRepo as any);
      mockConfigRepo.delete.mockResolvedValue(true);

      const deleted = await service.deleteTraffic('c1');

      expect(deleted).toBe(true);
      expect(mockConfigRepo.delete).toHaveBeenCalledWith('c1');
    });

    it('should return false when DB delete fails', async () => {
      service.setRepositories(mockConfigRepo as any, mockHistoryRepo as any);
      mockConfigRepo.delete.mockResolvedValue(false);

      const deleted = await service.deleteTraffic('c1');

      expect(deleted).toBe(false);
    });
  });

  // ==================== createCanaryDeployment ====================

  describe('createCanaryDeployment', () => {
    it('should create a canary deployment', async () => {
      const input: CreateCanaryInput = {
        tenant_id: 't1',
        deployment_id: 'd1',
        service_name: 'my-service',
        canary_version: 'v2',
        baseline_version: 'v1',
      };

      const result = await service.createCanaryDeployment('t1', input);

      expect(result.tenantId).toBe('t1');
      expect(result.deploymentId).toBe('d1');
      expect(result.serviceName).toBe('my-service');
      expect(result.canaryVersion).toBe('v2');
      expect(result.baselineVersion).toBe('v1');
      expect(result.status).toBe('deploying');
      expect(result.initialPercent).toBe(10); // default
      expect(result.currentPercent).toBe(10);
    });

    it('should use custom initial_percent', async () => {
      const input: CreateCanaryInput = {
        tenant_id: 't1',
        deployment_id: 'd2',
        service_name: 'svc',
        canary_version: 'v2',
        baseline_version: 'v1',
        initial_percent: 20,
        max_percent: 50,
      };

      const result = await service.createCanaryDeployment('t1', input);

      expect(result.initialPercent).toBe(20);
      expect(result.maxPercent).toBe(50);
      expect(result.currentPercent).toBe(20);
    });

    it('should generate deployment_id when not provided', async () => {
      const input: CreateCanaryInput = {
        tenant_id: 't1',
        deployment_id: '',
        service_name: 'svc',
        canary_version: 'v2',
        baseline_version: 'v1',
      };

      const result = await service.createCanaryDeployment('t1', input);

      expect(result.deploymentId).toBeTruthy();
      expect(result.id).toMatch(/^canary-/);
    });
  });

  // ==================== listCanaryDeployments ====================

  describe('listCanaryDeployments', () => {
    it('should list deployments for a tenant', async () => {
      const uid = `list-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      await service.createCanaryDeployment('t1', {
        tenant_id: 't1',
        deployment_id: `${uid}-d1`,
        service_name: 'svc1',
        canary_version: 'v2',
        baseline_version: 'v1',
      });
      await service.createCanaryDeployment('t1', {
        tenant_id: 't1',
        deployment_id: `${uid}-d2`,
        service_name: 'svc2',
        canary_version: 'v2',
        baseline_version: 'v1',
      });

      const result = await service.listCanaryDeployments('t1');

      // Filter to only our deployments (module-level map may have others from other tests)
      const ourDeployments = result.filter((d: any) => d.id?.includes(uid));
      expect(ourDeployments.length).toBe(2);
      expect(ourDeployments.map((d: any) => d.serviceName)).toContain('svc1');
      expect(ourDeployments.map((d: any) => d.serviceName)).toContain('svc2');
    });

    it('should filter by status', async () => {
      const uid = `filter-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      await service.createCanaryDeployment('t1', {
        tenant_id: 't1',
        deployment_id: `${uid}-d1`,
        service_name: 'svc1',
        canary_version: 'v2',
        baseline_version: 'v1',
      });

      const all = await service.listCanaryDeployments('t1');
      const ourDeploying = all.filter((d: any) => d.id?.includes(uid) && d.status === 'deploying');

      expect(ourDeploying.length).toBe(1);
      expect(ourDeploying[0].status).toBe('deploying');
    });

    it('should return empty for non-matching status', async () => {
      const uid = `nomatch-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      await service.createCanaryDeployment('t1', {
        tenant_id: 't1',
        deployment_id: `${uid}-d1`,
        service_name: 'svc1',
        canary_version: 'v2',
        baseline_version: 'v1',
      });

      const all = await service.listCanaryDeployments('t1');
      const ourPromoted = all.filter((d: any) => d.id?.includes(uid) && d.status === 'promoted');

      expect(ourPromoted.length).toBe(0);
    });

    it('should return empty for different tenant', async () => {
      const uid = `diff-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      await service.createCanaryDeployment('t1', {
        tenant_id: 't1',
        deployment_id: `${uid}-d1`,
        service_name: 'svc1',
        canary_version: 'v2',
        baseline_version: 'v1',
      });

      const result = await service.listCanaryDeployments('other-tenant');

      // Other tenant should not see t1's deployments
      const found = result.filter((d: any) => d.id?.includes(uid));
      expect(found.length).toBe(0);
    });

    it('should use DB mode when repos set', async () => {
      service.setRepositories(mockConfigRepo as any, mockHistoryRepo as any);
      mockConfigRepo.findAll.mockResolvedValue({
        entities: [
          { canary_id: 'c1', strategy: 'weighted', baseline_weight: 90, canary_weight: 10, phase: 'initial' },
        ],
        total: 1,
      });

      const result = await service.listCanaryDeployments('t1');

      expect(result.length).toBe(1);
      expect(result[0].id).toBe('c1');
    });
  });

  // ==================== getCanaryDeployment ====================

  describe('getCanaryDeployment', () => {
    it('should get deployment by canary ID', async () => {
      await service.createCanaryDeployment('t1', {
        tenant_id: 't1',
        deployment_id: 'd1',
        service_name: 'svc1',
        canary_version: 'v2',
        baseline_version: 'v1',
      });

      const result = await service.getCanaryDeployment('canary-d1');

      expect(result).not.toBeNull();
      expect(result!.serviceName).toBe('svc1');
    });

    it('should return null for non-existent deployment', async () => {
      const result = await service.getCanaryDeployment('nonexistent');
      expect(result).toBeNull();
    });

    it('should get deployment from DB mode', async () => {
      service.setRepositories(mockConfigRepo as any, mockHistoryRepo as any);
      mockConfigRepo.findByCanaryId.mockResolvedValue({
        canary_id: 'c1',
        strategy: 'weighted',
        baseline_weight: 90,
        canary_weight: 10,
        phase: 'initial',
        created_at: new Date(),
      });

      const result = await service.getCanaryDeployment('c1');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('c1');
      expect(result!.status).toBe('initial');
    });

    it('should return null from DB when not found', async () => {
      service.setRepositories(mockConfigRepo as any, mockHistoryRepo as any);
      mockConfigRepo.findByCanaryId.mockResolvedValue(undefined);

      const result = await service.getCanaryDeployment('nonexistent');

      expect(result).toBeNull();
    });
  });

  // ==================== promoteCanary ====================

  describe('promoteCanary', () => {
    it('should promote canary to production', async () => {
      await service.createCanaryDeployment('t1', {
        tenant_id: 't1',
        deployment_id: 'd1',
        service_name: 'svc1',
        canary_version: 'v2',
        baseline_version: 'v1',
      });

      const result = await service.promoteCanary('canary-d1');

      expect(result.status).toBe('promoted');
      expect(result.promotedAt).toBeDefined();
    });

    it('should throw OrionError for non-existent canary', async () => {
      await expect(service.promoteCanary('nonexistent')).rejects.toThrow(OrionError);
      await expect(service.promoteCanary('nonexistent')).rejects.toThrow('not found');
    });

    it('should set traffic to 100% canary on promotion', async () => {
      await service.createCanaryDeployment('t1', {
        tenant_id: 't1',
        deployment_id: 'd1',
        service_name: 'svc1',
        canary_version: 'v2',
        baseline_version: 'v1',
      });

      await service.promoteCanary('canary-d1');

      const config = await service.getTrafficConfig('canary-d1');
      expect(config).not.toBeNull();
      expect(config!.canary_weight).toBe(100);
      expect(config!.baseline_weight).toBe(0);
    });
  });

  // ==================== rollbackCanary ====================

  describe('rollbackCanary', () => {
    it('should rollback canary deployment', async () => {
      await service.createCanaryDeployment('t1', {
        tenant_id: 't1',
        deployment_id: 'd1',
        service_name: 'svc1',
        canary_version: 'v2',
        baseline_version: 'v1',
      });

      const result = await service.rollbackCanary('canary-d1');

      expect(result.status).toBe('rolled_back');
      expect(result.rolledBackAt).toBeDefined();
    });

    it('should throw OrionError for non-existent canary', async () => {
      await expect(service.rollbackCanary('nonexistent')).rejects.toThrow(OrionError);
      await expect(service.rollbackCanary('nonexistent')).rejects.toThrow('not found');
    });

    it('should set traffic to 100% baseline on rollback', async () => {
      await service.createCanaryDeployment('t1', {
        tenant_id: 't1',
        deployment_id: 'd1',
        service_name: 'svc1',
        canary_version: 'v2',
        baseline_version: 'v1',
      });

      await service.rollbackCanary('canary-d1');

      const config = await service.getTrafficConfig('canary-d1');
      expect(config).not.toBeNull();
      expect(config!.canary_weight).toBe(0);
      expect(config!.baseline_weight).toBe(100);
    });
  });

  // ==================== getTrafficHistory ====================

  describe('getTrafficHistory', () => {
    it('should return empty array in in-memory mode', async () => {
      const result = await service.getTrafficHistory('canary-1');
      expect(result).toEqual([]);
    });

    it('should return history from DB when repos set', async () => {
      service.setRepositories(mockConfigRepo as any, mockHistoryRepo as any);
      mockHistoryRepo.findByCanaryId.mockResolvedValue([
        { id: 'h1', canary_id: 'c1', success: true, result: 'applied', error: null, executed_at: new Date() },
      ]);

      const result = await service.getTrafficHistory('c1');

      expect(result.length).toBe(1);
      expect(result[0].canary_id).toBe('c1');
    });
  });
});
