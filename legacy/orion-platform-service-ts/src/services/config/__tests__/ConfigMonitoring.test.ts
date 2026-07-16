/**
 * ConfigMonitoring 测试
 *
 * 测试配置中心可观测性模块：Prometheus 指标、健康检查、指标工具函数。
 * Mock prom-client 模拟指标注册。
 */

import {
  checkConfigHealth,
  getMetrics,
  getMetricsJSON,
  recordConfigLoad,
  recordConfigUpdate,
  recordConfigError,
  recordConfigChangeLatency,
  addConfigHealthRoutes,
  configLoadTotal,
  configLoadDuration,
  configUpdateTotal,
  configCacheHits,
  configCacheMisses,
  configActiveCount,
  configVersionCount,
  configHealthStatus,
  configChangeLatency,
  configErrors,
} from '../ConfigMonitoring';

// ==================== Tests ====================

describe('ConfigMonitoring', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ---- Metric instances ----

  describe('metric instances', () => {
    it('should export configLoadTotal counter', () => {
      expect(configLoadTotal).toBeDefined();
      expect(typeof configLoadTotal.inc).toBe('function');
    });

    it('should export configLoadDuration histogram', () => {
      expect(configLoadDuration).toBeDefined();
      expect(typeof configLoadDuration.observe).toBe('function');
    });

    it('should export configUpdateTotal counter', () => {
      expect(configUpdateTotal).toBeDefined();
      expect(typeof configUpdateTotal.inc).toBe('function');
    });

    it('should export configCacheHits counter', () => {
      expect(configCacheHits).toBeDefined();
    });

    it('should export configCacheMisses counter', () => {
      expect(configCacheMisses).toBeDefined();
    });

    it('should export configActiveCount gauge', () => {
      expect(configActiveCount).toBeDefined();
    });

    it('should export configVersionCount gauge', () => {
      expect(configVersionCount).toBeDefined();
    });

    it('should export configHealthStatus gauge', () => {
      expect(configHealthStatus).toBeDefined();
    });

    it('should export configChangeLatency histogram', () => {
      expect(configChangeLatency).toBeDefined();
    });

    it('should export configErrors counter', () => {
      expect(configErrors).toBeDefined();
    });
  });

  // ---- checkConfigHealth ----

  describe('checkConfigHealth', () => {
    it('should return healthy status', async () => {
      const health = await checkConfigHealth();

      expect(health.status).toBe('healthy');
      expect(health.checks.database).toBe(true);
      expect(health.checks.cache).toBe(true);
      expect(health.checks.eventBus).toBe(true);
      expect(health.timestamp).toBeDefined();
      expect(health.details.uptime).toBeDefined();
      expect(health.details.memory).toBeDefined();
    });

    it('should return consistent structure', async () => {
      const health = await checkConfigHealth();

      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('checks');
      expect(health).toHaveProperty('timestamp');
      expect(health).toHaveProperty('details');
    });
  });

  // ---- getMetrics ----

  describe('getMetrics', () => {
    it('should return metrics string', async () => {
      const metrics = await getMetrics();

      expect(typeof metrics).toBe('string');
    });
  });

  // ---- getMetricsJSON ----

  describe('getMetricsJSON', () => {
    it('should return metrics as JSON array', async () => {
      const metrics = await getMetricsJSON();

      expect(Array.isArray(metrics)).toBe(true);
    });
  });

  // ---- recordConfigLoad ----

  describe('recordConfigLoad', () => {
    it('should record config load with cache hit', () => {
      expect(() => {
        recordConfigLoad('pipeline', 100, true);
      }).not.toThrow();
    });

    it('should record config load with cache miss', () => {
      expect(() => {
        recordConfigLoad('deploy', 200, false);
      }).not.toThrow();
    });

    it('should handle zero duration', () => {
      expect(() => {
        recordConfigLoad('test', 0, true);
      }).not.toThrow();
    });
  });

  // ---- recordConfigUpdate ----

  describe('recordConfigUpdate', () => {
    it('should record successful update', () => {
      expect(() => {
        recordConfigUpdate('pipeline', 'max-retries', true);
      }).not.toThrow();
    });

    it('should record failed update', () => {
      expect(() => {
        recordConfigUpdate('deploy', 'timeout', false);
      }).not.toThrow();
    });
  });

  // ---- recordConfigError ----

  describe('recordConfigError', () => {
    it('should record config error', () => {
      expect(() => {
        recordConfigError('pipeline', 'connection_timeout');
      }).not.toThrow();
    });

    it('should record different error types', () => {
      expect(() => {
        recordConfigError('deploy', 'parse_error');
        recordConfigError('deploy', 'validation_error');
      }).not.toThrow();
    });
  });

  // ---- recordConfigChangeLatency ----

  describe('recordConfigChangeLatency', () => {
    it('should record change latency', () => {
      expect(() => {
        recordConfigChangeLatency('pipeline', 1500);
      }).not.toThrow();
    });

    it('should handle zero latency', () => {
      expect(() => {
        recordConfigChangeLatency('test', 0);
      }).not.toThrow();
    });
  });

  // ---- addConfigHealthRoutes ----

  describe('addConfigHealthRoutes', () => {
    it('should register routes on app', () => {
      const mockApp = {
        get: jest.fn(),
      };

      addConfigHealthRoutes(mockApp);

      expect(mockApp.get).toHaveBeenCalledTimes(3);
      expect(mockApp.get).toHaveBeenCalledWith('/health/config', expect.any(Function));
      expect(mockApp.get).toHaveBeenCalledWith('/metrics/config', expect.any(Function));
      expect(mockApp.get).toHaveBeenCalledWith('/metrics/config/json', expect.any(Function));
    });

    it('should handle health endpoint', async () => {
      const mockApp = {
        get: jest.fn(),
      };

      addConfigHealthRoutes(mockApp);

      // Get the health handler
      const healthHandler = mockApp.get.mock.calls[0][1];
      const mockReq = {};
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await healthHandler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'healthy',
          checks: expect.objectContaining({
            database: true,
            cache: true,
            eventBus: true,
          }),
        })
      );
    });

    it('should handle metrics endpoint', async () => {
      const mockApp = {
        get: jest.fn(),
      };

      addConfigHealthRoutes(mockApp);

      // Get the metrics handler
      const metricsHandler = mockApp.get.mock.calls[1][1];
      const mockReq = {};
      const mockRes = {
        set: jest.fn(),
        send: jest.fn(),
      };

      await metricsHandler(mockReq, mockRes);

      expect(mockRes.set).toHaveBeenCalledWith('Content-Type', expect.any(String));
      expect(mockRes.send).toHaveBeenCalled();
    });

    it('should handle JSON metrics endpoint', async () => {
      const mockApp = {
        get: jest.fn(),
      };

      addConfigHealthRoutes(mockApp);

      // Get the JSON metrics handler
      const jsonHandler = mockApp.get.mock.calls[2][1];
      const mockReq = {};
      const mockRes = {
        json: jest.fn(),
      };

      await jsonHandler(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(expect.any(Array));
    });
  });

  // ---- default export ----

  describe('default export', () => {
    it('should export all functions', async () => {
      const mod = await import('../ConfigMonitoring');

      expect(mod.default).toBeDefined();
      expect(mod.default.register).toBeDefined();
      expect(mod.default.checkConfigHealth).toBe(checkConfigHealth);
      expect(mod.default.getMetrics).toBe(getMetrics);
      expect(mod.default.getMetricsJSON).toBe(getMetricsJSON);
      expect(mod.default.recordConfigLoad).toBe(recordConfigLoad);
      expect(mod.default.recordConfigUpdate).toBe(recordConfigUpdate);
      expect(mod.default.recordConfigError).toBe(recordConfigError);
      expect(mod.default.recordConfigChangeLatency).toBe(recordConfigChangeLatency);
      expect(mod.default.addConfigHealthRoutes).toBe(addConfigHealthRoutes);
    });
  });
});
