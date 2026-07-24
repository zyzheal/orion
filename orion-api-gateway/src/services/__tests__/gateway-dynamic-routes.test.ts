/**
 * GatewayDynamicRoutes 单元测试
 *
 * 测试覆盖：
 * - 动态路由注册/注销
 * - 从服务注册表发现路由
 * - 服务上下线时路由自动更新
 * - 健康检查集成
 * - 静态配置 fallback
 */

import { GatewayDynamicRoutes, DynamicRouteConfig } from '../gateway-dynamic-routes';
import { serviceRegistry, ServiceInfo } from '../service-registry';

// Mock Fastify
const mockApp = {
  all: jest.fn(),
  get: jest.fn(),
  printRoutes: jest.fn(),
} as any;

describe('GatewayDynamicRoutes', () => {
  let gateway: GatewayDynamicRoutes;

  beforeEach(() => {
    gateway = new GatewayDynamicRoutes();
    gateway.setApp(mockApp);
    serviceRegistry.unregister('test-service');
    serviceRegistry.unregister('platform');
    serviceRegistry.unregister('pipeline');
    mockApp.all.mockClear();
  });

  afterEach(() => {
    gateway.shutdown();
  });

  describe('动态路由注册', () => {
    it('应该成功注册新路由', () => {
      const config: Omit<DynamicRouteConfig, 'registeredAt' | 'updatedAt'> = {
        id: 'test-route',
        serviceName: 'test-service',
        prefix: '/api/v1/test',
        target: 'http://localhost:3001',
        timeout: 30000,
        stripPrefix: false,
        status: 'active',
      };

      const result = gateway.registerRoute(config);

      expect(result).toBe(true);
      expect(gateway.getRoute('test-route')).toBeDefined();
      expect(gateway.getRoute('test-route')?.status).toBe('active');
    });

    it('应该拒绝重复注册同一路由', () => {
      const config: Omit<DynamicRouteConfig, 'registeredAt' | 'updatedAt'> = {
        id: 'test-route',
        serviceName: 'test-service',
        prefix: '/api/v1/test',
        target: 'http://localhost:3001',
        status: 'active',
      };

      gateway.registerRoute(config);
      const result = gateway.registerRoute(config);

      expect(result).toBe(false);
    });

    it('应该允许重新注册已注销的路由', () => {
      const config: Omit<DynamicRouteConfig, 'registeredAt' | 'updatedAt'> = {
        id: 'test-route',
        serviceName: 'test-service',
        prefix: '/api/v1/test',
        target: 'http://localhost:3001',
        status: 'inactive',
      };

      gateway.registerRoute(config);
      const result = gateway.registerRoute({ ...config, status: 'active' });

      expect(result).toBe(true);
      expect(gateway.getRoute('test-route')?.status).toBe('active');
    });
  });

  describe('路由注销', () => {
    it('应该成功注销路由', () => {
      const config: Omit<DynamicRouteConfig, 'registeredAt' | 'updatedAt'> = {
        id: 'test-route',
        serviceName: 'test-service',
        prefix: '/api/v1/test',
        target: 'http://localhost:3001',
        status: 'active',
      };

      gateway.registerRoute(config);
      const result = gateway.unregisterRoute('test-route');

      expect(result).toBe(true);
      expect(gateway.getRoute('test-route')?.status).toBe('inactive');
    });

    it('应该返回 false 当注销不存在的路由', () => {
      const result = gateway.unregisterRoute('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('服务注册表同步', () => {
    it('应该从服务注册表发现路由', () => {
      // 注册一个带 api_paths 元数据的服务
      serviceRegistry.register({
        name: 'test-service',
        url: 'http://localhost:3001',
        healthUrl: 'http://localhost:3001/healthz',
        metadata: {
          api_paths: ['/api/v1/test', '/api/v1/test2'],
          timeout: 30000,
        },
      });

      const services = serviceRegistry.getAllServices();
      const serviceUrlMap: Record<string, string> = {};
      for (const s of services) {
        serviceUrlMap[s.name] = s.url;
      }

      const count = gateway.discoverFromServiceRegistry(services, serviceUrlMap);

      expect(count).toBe(2);
      expect(gateway.getRoute('test-service:/api/v1/test')).toBeDefined();
      expect(gateway.getRoute('test-service:/api/v1/test2')).toBeDefined();
    });

    it('应该跳过没有 api_paths 的服务', () => {
      serviceRegistry.register({
        name: 'no-api-service',
        url: 'http://localhost:3001',
        healthUrl: 'http://localhost:3001/healthz',
      });

      const services = serviceRegistry.getAllServices();
      const serviceUrlMap: Record<string, string> = {};
      for (const s of services) {
        serviceUrlMap[s.name] = s.url;
      }

      const count = gateway.discoverFromServiceRegistry(services, serviceUrlMap);

      expect(count).toBe(0);
    });

    it('syncWithServiceRegistry 应该使用默认映射', () => {
      // 注册 platform 服务（不带 api_paths）
      serviceRegistry.register({
        name: 'platform',
        url: 'http://localhost:3001',
        healthUrl: 'http://localhost:3001/healthz',
        status: 'healthy',
      });

      const count = gateway.syncWithServiceRegistry();

      // 应该有 /api/v1/platform 路由
      expect(count).toBeGreaterThan(0);
      expect(gateway.getRoute('platform:/api/v1/platform')).toBeDefined();
    });
  });

  describe('服务注册表事件监听', () => {
    it('应该监听服务注册事件并同步路由', async () => {
      gateway.setupRegistryListeners();

      // 注册一个新服务，应该触发路由同步
      serviceRegistry.register({
        name: 'new-service',
        url: 'http://localhost:3099',
        healthUrl: 'http://localhost:3099/healthz',
        metadata: {
          api_paths: ['/api/v1/new'],
        },
      });

      // 等待事件处理
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(gateway.getRoute('new-service:/api/v1/new')).toBeDefined();
    });

    it('应该监听服务注销事件并标记路由为 inactive', async () => {
      // 先注册服务
      serviceRegistry.register({
        name: 'to-unregister',
        url: 'http://localhost:3099',
        healthUrl: 'http://localhost:3099/healthz',
        metadata: {
          api_paths: ['/api/v1/to-unregister'],
        },
      });

      gateway.setupRegistryListeners();

      // 注销服务
      serviceRegistry.unregister('to-unregister');

      // 等待事件处理
      await new Promise(resolve => setTimeout(resolve, 100));

      const route = gateway.getRoute('to-unregister:/api/v1/to-unregister');
      expect(route?.status).toBe('inactive');
    });

    it('应该监听健康状态变化并更新路由', async () => {
      // 注册一个不健康服务
      const service: ServiceInfo = {
        name: 'health-test',
        url: 'http://localhost:3099',
        healthUrl: 'http://localhost:3099/healthz',
        registeredAt: new Date(),
        lastHeartbeat: new Date(),
        status: 'unhealthy',
        metadata: {
          api_paths: ['/api/v1/health-test'],
          _failureCount: 3,
        },
      };

      serviceRegistry.register({
        name: 'health-test',
        url: 'http://localhost:3099',
        healthUrl: 'http://localhost:3099/healthz',
        metadata: {
          api_paths: ['/api/v1/health-test'],
        },
      });

      gateway.setupRegistryListeners();

      // 模拟健康检查通过事件
      serviceRegistry.emit('service:healthcheck:passed', { ...service, status: 'healthy' });

      await new Promise(resolve => setTimeout(resolve, 100));

      // 路由应该变为 active
      const route = gateway.getRoute('health-test:/api/v1/health-test');
      expect(route?.status).toBe('active');
    });
  });

  describe('静态配置 Fallback', () => {
    it('应该在没有服务注册表时加载静态配置', () => {
      const staticConfigs: Array<Omit<DynamicRouteConfig, 'registeredAt' | 'updatedAt'>> = [
        {
          id: 'static-1',
          serviceName: 'platform',
          prefix: '/api/v1/platform',
          target: 'http://localhost:3001',
          status: 'active',
          description: 'Static route',
        },
      ];

      const count = gateway.loadFromStaticConfig(staticConfigs);

      expect(count).toBe(1);
      expect(gateway.getRoute('static-1')).toBeDefined();
    });
  });

  describe('路由查询', () => {
    it('应该列出所有路由', () => {
      gateway.registerRoute({
        id: 'route-1',
        serviceName: 'service-a',
        prefix: '/api/v1/a',
        target: 'http://localhost:3001',
        status: 'active',
      });
      gateway.registerRoute({
        id: 'route-2',
        serviceName: 'service-b',
        prefix: '/api/v1/b',
        target: 'http://localhost:3002',
        status: 'inactive',
      });

      const allRoutes = gateway.listRoutes();
      expect(allRoutes.length).toBe(2);

      const activeRoutes = gateway.listRoutes({ status: 'active' });
      expect(activeRoutes.length).toBe(1);
    });

    it('应该返回活跃路由数量', () => {
      gateway.registerRoute({
        id: 'route-1',
        serviceName: 'service-a',
        prefix: '/api/v1/a',
        target: 'http://localhost:3001',
        status: 'active',
      });
      gateway.registerRoute({
        id: 'route-2',
        serviceName: 'service-b',
        prefix: '/api/v1/b',
        target: 'http://localhost:3002',
        status: 'inactive',
      });

      expect(gateway.getActiveRouteCount()).toBe(1);
    });
  });

  describe('轮询发现', () => {
    it('应该启动和停止轮询', () => {
      const fetcher = jest.fn().mockResolvedValue([]);

      const cleanup = gateway.startPolling('test-source', fetcher, 60000);

      // 立即执行一次
      expect(fetcher).toHaveBeenCalledTimes(1);

      cleanup();

      // 清理后不再调用
      jest.advanceTimersByTime(60000);
      expect(fetcher).toHaveBeenCalledTimes(1);
    });
  });
});
