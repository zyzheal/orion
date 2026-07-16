/**
 * TrafficManager 单元测试
 *
 * 覆盖：构造函数、Istio VirtualService 配置、NGINX 权重配置、
 * 流量切换执行、配置验证、错误处理、辅助方法
 */

// ==================== Mocks ====================
// execFile mock must call callback for promisify(execFile) to resolve
const mockExecFile = jest.fn((_cmd: string, _args: string[], cb: Function) => {
  cb(null, { stdout: 'ok', stderr: '' });
});

jest.mock('child_process', () => ({
  execFile: mockExecFile,
}));

jest.mock('fs/promises', () => ({
  writeFile: jest.fn().mockResolvedValue(undefined),
  mkdtemp: jest.fn().mockResolvedValue('/tmp/orion-test-12345'),
  unlink: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('os', () => ({
  tmpdir: jest.fn().mockReturnValue('/tmp'),
}));

jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('test-uuid-1234'),
}));

jest.mock('pino', () => {
  return jest.fn().mockReturnValue({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  });
});

const mockConfigRepo = {
  findByCanaryId: jest.fn(),
  findAll: jest.fn(),
  upsertConfig: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

const mockHistoryRepo = {
  findByCanaryId: jest.fn(),
  findAll: jest.fn(),
  createEntry: jest.fn(),
};

jest.mock('../../../repositories/TrafficManagerRepository', () => ({
  TrafficConfigRepository: jest.fn().mockImplementation(() => mockConfigRepo),
  TrafficHistoryRepository: jest.fn().mockImplementation(() => mockHistoryRepo),
}));

// Now import after all mocks are set up
import { TrafficManager, TrafficManagerError } from '../TrafficManager';

// ==================== Tests ====================

describe('TrafficManager', () => {
  let manager: TrafficManager;
  const mockDb = { query: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    manager = new TrafficManager(mockDb as any);

    // Reset execFile mock to call callback by default
    mockExecFile.mockImplementation((_cmd: string, _args: string[], cb: Function) => {
      cb(null, { stdout: 'ok', stderr: '' });
    });

    // Default mock for history creation
    mockHistoryRepo.createEntry.mockResolvedValue({
      id: 'h1',
      canary_id: 'c1',
      success: true,
      result: 'ok',
      error: null,
    });

    // Default mock for config upsert
    mockConfigRepo.upsertConfig.mockResolvedValue({
      id: 'c1-config',
      canary_id: 'c1',
      strategy: 'istio',
    });
  });

  // ==================== Constructor ====================

  describe('constructor', () => {
    it('should create TrafficManager with db', () => {
      const m = new TrafficManager(mockDb as any);
      expect(m).toBeDefined();
    });
  });

  // ==================== configureIstioVirtualService ====================

  describe('configureIstioVirtualService', () => {
    it('should configure Istio VirtualService successfully', async () => {
      const result = await manager.configureIstioVirtualService('canary-1', 'my-service.com', 20);

      expect(result.success).toBe(true);
      expect(result.canaryId).toBe('canary-1');
      expect(result.result).toContain('baseline=80%');
      expect(result.result).toContain('canary=20%');
    });

    it('should persist config to DB', async () => {
      await manager.configureIstioVirtualService('canary-1', 'my-service.com', 30);

      expect(mockConfigRepo.upsertConfig).toHaveBeenCalledWith(expect.objectContaining({
        canary_id: 'canary-1',
        strategy: 'istio',
      }));
    });

    it('should save history to DB', async () => {
      await manager.configureIstioVirtualService('canary-1', 'my-service.com', 10);

      expect(mockHistoryRepo.createEntry).toHaveBeenCalledWith(expect.objectContaining({
        canary_id: 'canary-1',
        success: true,
      }));
    });

    it('should return error for empty canaryId', async () => {
      const result = await manager.configureIstioVirtualService('', 'my-service.com', 20);

      expect(result.success).toBe(false);
      expect(result.error).toContain('canaryId and host are required');
    });

    it('should return error for empty host', async () => {
      const result = await manager.configureIstioVirtualService('canary-1', '', 20);

      expect(result.success).toBe(false);
      expect(result.error).toContain('canaryId and host are required');
    });

    it('should return error for negative canaryPercent', async () => {
      const result = await manager.configureIstioVirtualService('canary-1', 'host.com', -10);

      expect(result.success).toBe(false);
      expect(result.error).toContain('canaryPercent must be between 0 and 100');
    });

    it('should return error for canaryPercent > 100', async () => {
      const result = await manager.configureIstioVirtualService('canary-1', 'host.com', 150);

      expect(result.success).toBe(false);
      expect(result.error).toContain('canaryPercent must be between 0 and 100');
    });

    it('should handle 0% canary traffic', async () => {
      const result = await manager.configureIstioVirtualService('canary-1', 'host.com', 0);

      expect(result.success).toBe(true);
      expect(result.result).toContain('baseline=100%');
      expect(result.result).toContain('canary=0%');
    });

    it('should handle 100% canary traffic', async () => {
      const result = await manager.configureIstioVirtualService('canary-1', 'host.com', 100);

      expect(result.success).toBe(true);
      expect(result.result).toContain('baseline=0%');
      expect(result.result).toContain('canary=100%');
    });

    it('should use SIMULATED result when kubectl fails', async () => {
      // Make kubectl call fail, so it falls through to SIMULATED path
      mockExecFile.mockImplementation((_cmd: string, _args: string[], cb: Function) => {
        cb(new Error('kubectl not found'), null);
      });

      const result = await manager.configureIstioVirtualService('canary-k', 'host.com', 30);

      expect(result.success).toBe(true);
      expect(result.result).toContain('SIMULATED');
    });
  });

  // ==================== configureNGINXWeight ====================

  describe('configureNGINXWeight', () => {
    it('should configure NGINX weight successfully', async () => {
      const result = await manager.configureNGINXWeight('canary-1', 'my-upstream', 30);

      expect(result.success).toBe(true);
      expect(result.canaryId).toBe('canary-1');
      expect(result.result).toContain('baseline=70');
      expect(result.result).toContain('canary=30');
    });

    it('should persist config to DB', async () => {
      await manager.configureNGINXWeight('canary-1', 'upstream-1', 20);

      expect(mockConfigRepo.upsertConfig).toHaveBeenCalledWith(expect.objectContaining({
        canary_id: 'canary-1',
        strategy: 'nginx',
      }));
    });

    it('should save history to DB', async () => {
      await manager.configureNGINXWeight('canary-1', 'upstream-1', 20);

      expect(mockHistoryRepo.createEntry).toHaveBeenCalled();
    });

    it('should return error for empty canaryId', async () => {
      const result = await manager.configureNGINXWeight('', 'upstream', 20);

      expect(result.success).toBe(false);
      expect(result.error).toContain('canaryId and upstream are required');
    });

    it('should return error for empty upstream', async () => {
      const result = await manager.configureNGINXWeight('canary-1', '', 20);

      expect(result.success).toBe(false);
      expect(result.error).toContain('canaryId and upstream are required');
    });

    it('should return error for negative weight', async () => {
      const result = await manager.configureNGINXWeight('canary-1', 'upstream', -5);

      expect(result.success).toBe(false);
      expect(result.error).toContain('weight must be between 0 and 100');
    });

    it('should return error for weight > 100', async () => {
      const result = await manager.configureNGINXWeight('canary-1', 'upstream', 200);

      expect(result.success).toBe(false);
      expect(result.error).toContain('weight must be between 0 and 100');
    });

    it('should use SIMULATED result when nginx reload fails', async () => {
      mockExecFile.mockImplementation((_cmd: string, _args: string[], cb: Function) => {
        cb(new Error('nginx not found'), null);
      });

      const result = await manager.configureNGINXWeight('canary-n', 'upstream', 30);

      expect(result.success).toBe(true);
      expect(result.result).toContain('SIMULATED');
    });
  });

  // ==================== executeTrafficSplit ====================

  describe('executeTrafficSplit', () => {
    it('should execute istio strategy', async () => {
      const config = {
        canaryId: 'canary-1',
        strategy: 'istio' as const,
        istioConfig: {
          host: 'my-service.com',
          routes: [
            { destination: 'my-service-baseline', subset: 'baseline', weight: 80 },
            { destination: 'my-service-canary', subset: 'canary', weight: 20 },
          ],
        },
      };

      const result = await manager.executeTrafficSplit('canary-1', config);

      expect(result.success).toBe(true);
    });

    it('should execute nginx strategy', async () => {
      const config = {
        canaryId: 'canary-1',
        strategy: 'nginx' as const,
        nginxConfig: {
          upstream: 'my-upstream',
          servers: [
            { server: 'baseline:80', weight: 80 },
            { server: 'canary:80', weight: 20 },
          ],
        },
      };

      const result = await manager.executeTrafficSplit('canary-1', config);

      expect(result.success).toBe(true);
    });

    it('should return error for empty canaryId', async () => {
      const config = {
        canaryId: '',
        strategy: 'istio' as const,
        istioConfig: {
          host: 'host.com',
          routes: [
            { destination: 'baseline', subset: 'baseline', weight: 80 },
            { destination: 'canary', subset: 'canary', weight: 20 },
          ],
        },
      };

      const result = await manager.executeTrafficSplit('', config);

      expect(result.success).toBe(false);
      expect(result.error).toContain('canaryId is required');
    });

    it('should return error for invalid istio config (missing istioConfig)', async () => {
      const config = {
        canaryId: 'canary-1',
        strategy: 'istio' as const,
        // Missing istioConfig
      };

      const result = await manager.executeTrafficSplit('canary-1', config);

      expect(result.success).toBe(false);
      expect(result.error).toContain('istioConfig is required');
    });

    it('should return error for invalid nginx config (missing nginxConfig)', async () => {
      const config = {
        canaryId: 'canary-1',
        strategy: 'nginx' as const,
        // no nginxConfig
      };

      const result = await manager.executeTrafficSplit('canary-1', config);

      expect(result.success).toBe(false);
      expect(result.error).toContain('nginxConfig is required');
    });

    it('should return error for unknown strategy', async () => {
      const config = {
        canaryId: 'canary-1',
        strategy: 'unknown' as any,
      };

      const result = await manager.executeTrafficSplit('canary-1', config);

      expect(result.success).toBe(false);
    });

    it('should return error when validation fails (weights not 100)', async () => {
      const config = {
        canaryId: 'canary-1',
        strategy: 'istio' as const,
        istioConfig: {
          host: 'host.com',
          routes: [
            { destination: 'baseline', weight: 60 },
            { destination: 'canary', weight: 20 },
          ],
        },
      };

      const result = await manager.executeTrafficSplit('canary-1', config);

      expect(result.success).toBe(false);
      expect(result.error).toContain('must sum to 100');
    });
  });

  // ==================== validateTraffic ====================

  describe('validateTraffic', () => {
    it('should validate valid istio config', () => {
      const config = {
        canaryId: 'canary-1',
        strategy: 'istio' as const,
        istioConfig: {
          host: 'my-service.com',
          routes: [
            { destination: 'baseline', subset: 'baseline', weight: 80 },
            { destination: 'canary', subset: 'canary', weight: 20 },
          ],
        },
      };

      const result = manager.validateTraffic(config);

      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should validate valid nginx config', () => {
      const config = {
        canaryId: 'canary-1',
        strategy: 'nginx' as const,
        nginxConfig: {
          upstream: 'my-upstream',
          servers: [
            { server: 'baseline:80', weight: 80 },
            { server: 'canary:80', weight: 20 },
          ],
        },
      };

      const result = manager.validateTraffic(config);

      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should fail when canaryId is missing', () => {
      const config = {
        canaryId: '',
        strategy: 'istio' as const,
        istioConfig: {
          host: 'host.com',
          routes: [
            { destination: 'baseline', weight: 80 },
            { destination: 'canary', weight: 20 },
          ],
        },
      };

      const result = manager.validateTraffic(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('canaryId is required');
    });

    it('should fail when strategy is invalid', () => {
      const config = {
        canaryId: 'canary-1',
        strategy: 'invalid' as any,
      };

      const result = manager.validateTraffic(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('strategy must be "istio" or "nginx"');
    });

    it('should fail when istio config is missing for istio strategy', () => {
      const config = {
        canaryId: 'canary-1',
        strategy: 'istio' as const,
      };

      const result = manager.validateTraffic(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('istioConfig is required for istio strategy');
    });

    it('should fail when istio host is missing', () => {
      const config = {
        canaryId: 'canary-1',
        strategy: 'istio' as const,
        istioConfig: {
          host: '',
          routes: [
            { destination: 'baseline', weight: 80 },
            { destination: 'canary', weight: 20 },
          ],
        },
      };

      const result = manager.validateTraffic(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('host is required in istioConfig');
    });

    it('should fail when istio routes are empty', () => {
      const config = {
        canaryId: 'canary-1',
        strategy: 'istio' as const,
        istioConfig: {
          host: 'host.com',
          routes: [],
        },
      };

      const result = manager.validateTraffic(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('at least one route is required in istioConfig');
    });

    it('should fail when istio route weights do not sum to 100', () => {
      const config = {
        canaryId: 'canary-1',
        strategy: 'istio' as const,
        istioConfig: {
          host: 'host.com',
          routes: [
            { destination: 'baseline', weight: 60 },
            { destination: 'canary', weight: 20 },
          ],
        },
      };

      const result = manager.validateTraffic(config);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('must sum to 100'))).toBe(true);
    });

    it('should fail when istio route weight is out of range', () => {
      const config = {
        canaryId: 'canary-1',
        strategy: 'istio' as const,
        istioConfig: {
          host: 'host.com',
          routes: [
            { destination: 'baseline', weight: 150 },
            { destination: 'canary', weight: -50 },
          ],
        },
      };

      const result = manager.validateTraffic(config);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('between 0 and 100'))).toBe(true);
    });

    it('should fail when nginx config is missing for nginx strategy', () => {
      const config = {
        canaryId: 'canary-1',
        strategy: 'nginx' as const,
      };

      const result = manager.validateTraffic(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('nginxConfig is required for nginx strategy');
    });

    it('should fail when nginx upstream is missing', () => {
      const config = {
        canaryId: 'canary-1',
        strategy: 'nginx' as const,
        nginxConfig: {
          upstream: '',
          servers: [{ server: 's1:80', weight: 50 }],
        },
      };

      const result = manager.validateTraffic(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('upstream is required in nginxConfig');
    });

    it('should fail when nginx servers are empty', () => {
      const config = {
        canaryId: 'canary-1',
        strategy: 'nginx' as const,
        nginxConfig: {
          upstream: 'my-upstream',
          servers: [],
        },
      };

      const result = manager.validateTraffic(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('at least one server is required in nginxConfig');
    });

    it('should fail when nginx server weight is negative', () => {
      const config = {
        canaryId: 'canary-1',
        strategy: 'nginx' as const,
        nginxConfig: {
          upstream: 'my-upstream',
          servers: [
            { server: 's1:80', weight: -10 },
          ],
        },
      };

      const result = manager.validateTraffic(config);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('non-negative'))).toBe(true);
    });

    it('should fail when nginx server address is empty', () => {
      const config = {
        canaryId: 'canary-1',
        strategy: 'nginx' as const,
        nginxConfig: {
          upstream: 'my-upstream',
          servers: [
            { server: '', weight: 50 },
          ],
        },
      };

      const result = manager.validateTraffic(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('server address is required');
    });

    it('should fail for invalid phase', () => {
      const config = {
        canaryId: 'canary-1',
        strategy: 'istio' as const,
        phase: 'invalid-phase' as any,
        istioConfig: {
          host: 'host.com',
          routes: [
            { destination: 'baseline', weight: 80 },
            { destination: 'canary', weight: 20 },
          ],
        },
      };

      const result = manager.validateTraffic(config);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('phase'))).toBe(true);
    });

    it('should pass for valid phases', () => {
      const phases = ['initial', 'gradual', 'full', 'rollback'];

      for (const phase of phases) {
        const config = {
          canaryId: 'canary-1',
          strategy: 'istio' as const,
          phase: phase as any,
          istioConfig: {
            host: 'host.com',
            routes: [
              { destination: 'baseline', weight: 80 },
              { destination: 'canary', weight: 20 },
            ],
          },
        };

        const result = manager.validateTraffic(config);
        expect(result.valid).toBe(true);
      }
    });

    it('should include messages for valid configs', () => {
      const config = {
        canaryId: 'canary-1',
        strategy: 'istio' as const,
        phase: 'initial' as const,
        istioConfig: {
          host: 'host.com',
          routes: [
            { destination: 'baseline', weight: 80 },
            { destination: 'canary', weight: 20 },
          ],
        },
      };

      const result = manager.validateTraffic(config);

      expect(result.messages.length).toBeGreaterThan(0);
      expect(result.messages.some(m => m.includes('host.com'))).toBe(true);
    });

    it('should include nginx messages for valid nginx config', () => {
      const config = {
        canaryId: 'canary-1',
        strategy: 'nginx' as const,
        nginxConfig: {
          upstream: 'my-upstream',
          servers: [
            { server: 's1:80', weight: 80 },
            { server: 's2:80', weight: 20 },
          ],
        },
      };

      const result = manager.validateTraffic(config);

      expect(result.messages.some(m => m.includes('my-upstream'))).toBe(true);
    });
  });

  // ==================== getConfig ====================

  describe('getConfig', () => {
    it('should return config when found', async () => {
      mockConfigRepo.findByCanaryId.mockResolvedValue({
        canary_id: 'canary-1',
        strategy: 'istio',
        host: 'host.com',
        namespace: 'default',
        baseline_destination: 'baseline',
        baseline_subset: 'baseline',
        canary_destination: 'canary',
        canary_subset: 'canary',
        baseline_weight: 80,
        canary_weight: 20,
        phase: 'initial',
        upstream_name: null,
        servers: [],
      });

      const result = await manager.getConfig('canary-1');

      expect(result).toBeDefined();
      expect(result!.canaryId).toBe('canary-1');
      expect(result!.strategy).toBe('istio');
    });

    it('should return undefined when not found', async () => {
      mockConfigRepo.findByCanaryId.mockResolvedValue(undefined);

      const result = await manager.getConfig('nonexistent');

      expect(result).toBeUndefined();
    });

    it('should return nginx config correctly', async () => {
      mockConfigRepo.findByCanaryId.mockResolvedValue({
        canary_id: 'canary-1',
        strategy: 'nginx',
        host: null,
        namespace: null,
        baseline_destination: null,
        baseline_subset: null,
        canary_destination: null,
        canary_subset: null,
        baseline_weight: 70,
        canary_weight: 30,
        phase: 'gradual',
        upstream_name: 'my-upstream',
        servers: [{ server: 's1:80', weight: 70 }, { server: 's2:80', weight: 30 }],
      });

      const result = await manager.getConfig('canary-1');

      expect(result).toBeDefined();
      expect(result!.strategy).toBe('nginx');
      expect(result!.nginxConfig).toBeDefined();
      expect(result!.nginxConfig!.upstream).toBe('my-upstream');
    });
  });

  // ==================== getAllConfigs ====================

  describe('getAllConfigs', () => {
    it('should return all configs', async () => {
      mockConfigRepo.findAll.mockResolvedValue({
        entities: [
          {
            canary_id: 'c1', strategy: 'istio', host: 'h1.com',
            namespace: 'default', baseline_destination: 'b1', baseline_subset: 'baseline',
            canary_destination: 'c1', canary_subset: 'canary',
            baseline_weight: 80, canary_weight: 20, phase: 'initial',
            upstream_name: null, servers: [],
          },
          {
            canary_id: 'c2', strategy: 'nginx', host: null,
            namespace: null, baseline_destination: null, baseline_subset: null,
            canary_destination: null, canary_subset: null,
            baseline_weight: 70, canary_weight: 30, phase: 'gradual',
            upstream_name: 'upstream-1', servers: [{ server: 's:80', weight: 100 }],
          },
        ],
        total: 2,
      });

      const result = await manager.getAllConfigs();

      expect(result.length).toBe(2);
      expect(result[0].canaryId).toBe('c1');
      expect(result[1].canaryId).toBe('c2');
    });
  });

  // ==================== getExecutionHistory ====================

  describe('getExecutionHistory', () => {
    it('should return history for specific canary', async () => {
      mockHistoryRepo.findByCanaryId.mockResolvedValue([
        { id: 'h1', canary_id: 'c1', success: true, result: 'applied', error: null, executed_at: new Date() },
      ]);

      const result = await manager.getExecutionHistory('c1');

      expect(result.length).toBe(1);
      expect(result[0].canaryId).toBe('c1');
      expect(result[0].success).toBe(true);
    });

    it('should return all history when no canaryId', async () => {
      mockHistoryRepo.findAll.mockResolvedValue({
        entities: [
          { id: 'h1', canary_id: 'c1', success: true, result: 'ok', error: null },
          { id: 'h2', canary_id: 'c2', success: false, result: 'failed', error: 'timeout' },
        ],
        total: 2,
      });

      const result = await manager.getExecutionHistory();

      expect(result.length).toBe(2);
    });

    it('should include error in result when present', async () => {
      mockHistoryRepo.findByCanaryId.mockResolvedValue([
        { id: 'h1', canary_id: 'c1', success: false, result: 'failed', error: 'connection refused', executed_at: new Date() },
      ]);

      const result = await manager.getExecutionHistory('c1');

      expect(result[0].error).toBe('connection refused');
    });

    it('should handle undefined error', async () => {
      mockHistoryRepo.findByCanaryId.mockResolvedValue([
        { id: 'h1', canary_id: 'c1', success: true, result: 'ok', error: null, executed_at: new Date() },
      ]);

      const result = await manager.getExecutionHistory('c1');

      expect(result[0].error).toBeUndefined();
    });
  });

  // ==================== TrafficManagerError ====================

  describe('TrafficManagerError', () => {
    it('should create error with code', () => {
      const err = new TrafficManagerError('test error', 'TEST_CODE');

      expect(err.message).toBe('test error');
      expect(err.code).toBe('TEST_CODE');
      expect(err.name).toBe('TrafficManagerError');
    });

    it('should support cause', () => {
      const cause = new Error('original');
      const err = new TrafficManagerError('test error', 'CODE', cause);

      expect(err.cause).toBe(cause);
    });
  });
});
