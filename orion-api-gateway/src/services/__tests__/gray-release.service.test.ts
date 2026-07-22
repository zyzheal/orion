/**
 * 灰度发布服务单元测试（Phase 5 P0-4）
 *
 * 测试覆盖：
 * 1. 路由匹配（前缀匹配 + 最长前缀优先）
 * 2. Weight 计算（tenantId 一致哈希）
 * 3. Redis 配置解析
 * 4. Fallback 机制（Redis 不可用 → 降级到 moduleRouting）
 * 5. 手动配置加载
 * 6. 默认目标回退
 */

import { GrayReleaseService, GrayRoutingResult } from '../../services/gray-release.service';
import { GrayReleaseConfig, RouteTargetRef, GrayReleaseRuntimeConfig } from '../../config/gray-config';

// Mock moduleRoutingService
jest.mock('../../services/module-routing', () => ({
  moduleRoutingService: {
    resolveTarget: jest.fn((target: string) => ({
      target,
      source: 'static',
    })),
  },
}));

describe('GrayReleaseService', () => {
  const TEST_CONFIG: GrayReleaseRuntimeConfig = {
    enabled: true,
    redisUrl: 'redis://localhost:6379',
    redisKey: 'gray-release:config',
    redisChannel: 'gray-release:config',
    defaultTarget: 'ts',
    goServiceUrl: 'http://go-svc:8080',
    tsServiceUrl: 'http://ts-svc:3001',
  };

  function createMockRequest(tenantId?: string, override?: string): any {
    const headers: Record<string, string> = {};
    if (tenantId) headers['x-tenant-id'] = tenantId;
    if (override) headers['x-gray-release-override'] = override;
    return {
      raw: { url: '/api/v1/pipelines/runs' },
      headers,
      tenantId: tenantId || undefined,
    };
  }

  describe('Route matching', () => {
    test('exact match takes priority', () => {
      const service = new GrayReleaseService(TEST_CONFIG);
      const config: GrayReleaseConfig = {
        version: 1,
        defaultTarget: 'ts',
        routeTargets: [
          { path: '/api/v1/pipelines', target: 'ts', weight: 100 },
          { path: '/api/v1/pipelines/runs', target: 'go', weight: 100 },
        ],
      };
      service.loadConfig(config);

      const result = service.getTarget('/api/v1/pipelines/runs', createMockRequest('tenant-1'));
      expect(result.target).toBe(TEST_CONFIG.goServiceUrl);
      expect(result.source).toBe('redis');
    });

    test('prefix match with longest prefix', () => {
      const service = new GrayReleaseService(TEST_CONFIG);
      const config: GrayReleaseConfig = {
        version: 1,
        defaultTarget: 'ts',
        routeTargets: [
          { path: '/api/v1', target: 'go', weight: 100 },
          { path: '/api/v1/pipelines', target: 'ts', weight: 100 },
          { path: '/api/v1/pipelines/runs', target: 'go', weight: 100 },
        ],
      };
      service.loadConfig(config);

      const result = service.getTarget('/api/v1/pipelines/runs/123', createMockRequest('tenant-1'));
      expect(result.target).toBe(TEST_CONFIG.goServiceUrl);
    });

    test('no match falls back to default target', () => {
      const service = new GrayReleaseService(TEST_CONFIG);
      const config: GrayReleaseConfig = {
        version: 1,
        defaultTarget: 'ts',
        routeTargets: [
          { path: '/api/v1/pipelines', target: 'go', weight: 100 },
        ],
      };
      service.loadConfig(config);

      const result = service.getTarget('/api/v1/tickets/list', createMockRequest('tenant-1'));
      expect(result.target).toBe(TEST_CONFIG.tsServiceUrl);
      expect(result.source).toBe('redis');
    });

    test('prefix match requires complete path segment', () => {
      const service = new GrayReleaseService(TEST_CONFIG);
      const config: GrayReleaseConfig = {
        version: 1,
        defaultTarget: 'ts',
        routeTargets: [
          { path: '/api/v1/notif', target: 'go', weight: 100 }, // 不匹配完整路径段
        ],
      };
      service.loadConfig(config);

      const result = service.getTarget('/api/v1/notify/messages', createMockRequest('tenant-1'));
      expect(result.target).toBe(TEST_CONFIG.tsServiceUrl);
      expect(result.source).toBe('redis');
    });
  });

  describe('Weight calculation', () => {
    test('weight=100 routes all traffic to Go', () => {
      const service = new GrayReleaseService(TEST_CONFIG);
      const config: GrayReleaseConfig = {
        version: 1,
        defaultTarget: 'ts',
        routeTargets: [
          { path: '/api/v1/pipelines', target: 'go', weight: 100 },
        ],
      };
      service.loadConfig(config);

      const result = service.getTarget('/api/v1/pipelines', createMockRequest('tenant-1'));
      expect(result.target).toBe(TEST_CONFIG.goServiceUrl);
    });

    test('weight=0 routes all traffic to TS', () => {
      const service = new GrayReleaseService(TEST_CONFIG);
      const config: GrayReleaseConfig = {
        version: 1,
        defaultTarget: 'ts',
        routeTargets: [
          { path: '/api/v1/pipelines', target: 'go', weight: 0 },
        ],
      };
      service.loadConfig(config);

      const result = service.getTarget('/api/v1/pipelines', createMockRequest('tenant-1'));
      expect(result.target).toBe(TEST_CONFIG.tsServiceUrl);
    });

    test('weight splits traffic based on tenantId hash', () => {
      const service = new GrayReleaseService(TEST_CONFIG);
      const config: GrayReleaseConfig = {
        version: 1,
        defaultTarget: 'ts',
        routeTargets: [
          { path: '/api/v1/pipelines', target: 'go', weight: 50 },
        ],
      };
      service.loadConfig(config);

      // 使用不同 tenantId 测试分流
      const result1 = service.getTarget('/api/v1/pipelines', createMockRequest('tenant-1'));
      const result2 = service.getTarget('/api/v1/pipelines', createMockRequest('tenant-2'));
      const result3 = service.getTarget('/api/v1/pipelines', createMockRequest('tenant-3'));

      // 至少有一个命中 Go，至少有一个命中 TS
      const allResults = [result1, result2, result3];
      const goCount = allResults.filter(r => r.target === TEST_CONFIG.goServiceUrl).length;
      const tsCount = allResults.filter(r => r.target === TEST_CONFIG.tsServiceUrl).length;

      // 3 个 tenantId 应该产生不同的哈希值（大概率）
      expect(goCount + tsCount).toBe(3);
      // 至少有一个到 Go（weight=50，哈希值 0-49 命中）
      expect(goCount).toBeGreaterThan(0);
    });

    test('unknown tenantId routes to TS (hash > 100)', () => {
      const service = new GrayReleaseService(TEST_CONFIG);
      const config: GrayReleaseConfig = {
        version: 1,
        defaultTarget: 'ts',
        routeTargets: [
          { path: '/api/v1/pipelines', target: 'go', weight: 50 },
        ],
      };
      service.loadConfig(config);

      const result = service.getTarget('/api/v1/pipelines', createMockRequest(undefined));
      expect(result.target).toBe(TEST_CONFIG.tsServiceUrl);
    });
  });

  describe('Header override', () => {
    test('x-gray-release-override:go forces Go target', () => {
      const service = new GrayReleaseService(TEST_CONFIG);
      const config: GrayReleaseConfig = {
        version: 1,
        defaultTarget: 'ts',
        routeTargets: [
          { path: '/api/v1/pipelines', target: 'ts', weight: 50 },
        ],
      };
      service.loadConfig(config);

      const result = service.getTarget('/api/v1/pipelines', createMockRequest('tenant-1', 'go'));
      expect(result.target).toBe(TEST_CONFIG.goServiceUrl);
    });

    test('x-gray-release-override:ts forces TS target', () => {
      const service = new GrayReleaseService(TEST_CONFIG);
      const config: GrayReleaseConfig = {
        version: 1,
        defaultTarget: 'ts',
        routeTargets: [
          { path: '/api/v1/pipelines', target: 'go', weight: 100 },
        ],
      };
      service.loadConfig(config);

      const result = service.getTarget('/api/v1/pipelines', createMockRequest('tenant-1', 'ts'));
      expect(result.target).toBe(TEST_CONFIG.tsServiceUrl);
    });
  });

  describe('Fallback behavior', () => {
    test('disabled service falls back to moduleRouting', () => {
      const service = new GrayReleaseService({ ...TEST_CONFIG, enabled: false });
      const result = service.getTarget('/api/v1/pipelines', createMockRequest('tenant-1'));
      expect(result.source).toBe('fallback');
    });

    test('empty routeTargets falls back to moduleRouting', () => {
      const service = new GrayReleaseService(TEST_CONFIG);
      const config: GrayReleaseConfig = {
        version: 1,
        defaultTarget: 'ts',
        routeTargets: [],
      };
      service.loadConfig(config);

      const result = service.getTarget('/api/v1/pipelines', createMockRequest('tenant-1'));
      expect(result.source).toBe('fallback');
    });
  });

  describe('Config management', () => {
    test('loadConfig emits config:changed event', () => {
      const service = new GrayReleaseService(TEST_CONFIG);
      const emitter = GrayReleaseService.getEventEmitter();
      let eventTrigger: string | undefined;

      emitter.on('config:changed', (e: { trigger: string }) => {
        eventTrigger = e.trigger;
      });

      const config: GrayReleaseConfig = {
        version: 1,
        defaultTarget: 'ts',
        routeTargets: [
          { path: '/api/v1/pipelines', target: 'go', weight: 100 },
        ],
      };
      service.loadConfig(config);

      expect(eventTrigger).toBe('manual');
    });

    test('getConfig returns loaded config', () => {
      const service = new GrayReleaseService(TEST_CONFIG);
      const config: GrayReleaseConfig = {
        version: 42,
        defaultTarget: 'go',
        routeTargets: [
          { path: '/api/v1/tickets', target: 'go', weight: 50 },
        ],
      };
      service.loadConfig(config);

      const loaded = service.getConfig();
      expect(loaded).not.toBeNull();
      expect(loaded!.version).toBe(42);
      expect(loaded!.defaultTarget).toBe('go');
      expect(loaded!.routeTargets.length).toBe(1);
    });

    test('parseConfig validates and clips weight', () => {
      const service = new GrayReleaseService(TEST_CONFIG);
      const config: GrayReleaseConfig = {
        version: 1,
        defaultTarget: 'ts',
        routeTargets: [
          { path: '/api/v1/pipelines', target: 'go', weight: 150 }, // 超过 100
          { path: '/api/v1/tickets', target: 'go', weight: -10 },   // 负数
        ],
      };
      service.loadConfig(config);

      const loaded = service.getConfig();
      expect(loaded!.routeTargets[0].weight).toBe(100); // 裁剪到 100
      expect(loaded!.routeTargets[1].weight).toBe(0);   // 裁剪到 0
    });

    test('parseConfig filters invalid rules', () => {
      const service = new GrayReleaseService(TEST_CONFIG);
      const config: GrayReleaseConfig = {
        version: 1,
        defaultTarget: 'ts',
        routeTargets: [
          { path: '/api/v1/pipelines', target: 'go', weight: 100 },
          { path: '', target: 'go', weight: 100 }, // 无效 path
        ],
      };
      service.loadConfig(config);

      const loaded = service.getConfig();
      expect(loaded!.routeTargets.length).toBe(1); // 过滤掉无效规则
    });
  });

  describe('Enabled check', () => {
    test('isEnabled returns correct value', () => {
      const enabled = new GrayReleaseService(TEST_CONFIG);
      expect(enabled.isEnabled()).toBe(true);

      const disabled = new GrayReleaseService({ ...TEST_CONFIG, enabled: false });
      expect(disabled.isEnabled()).toBe(false);
    });
  });
});
