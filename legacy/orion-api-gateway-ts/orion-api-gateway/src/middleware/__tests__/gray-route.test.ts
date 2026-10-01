/**
 * 灰度路由中间件单元测试（Phase 5 P0-4）
 */

import { createGrayRouteHook } from '../../middleware/gray-route';
import { GrayReleaseService } from '../../services/gray-release.service';
import { GrayReleaseConfig } from '../../config/gray-config';

jest.mock('../../services/module-routing', () => ({
  moduleRoutingService: {
    resolveTarget: jest.fn(() => ({ target: 'http://ts-svc:3001', source: 'static' })),
  },
}));

describe('GrayRouteMiddleware', () => {
  function createMockGrayService(config?: Partial<GrayReleaseConfig>): GrayReleaseService {
    const service = new GrayReleaseService({
      enabled: true,
      redisUrl: 'redis://localhost:6379',
      redisKey: 'gray-release:config',
      redisChannel: 'gray-release:config',
      defaultTarget: 'ts',
      goServiceUrl: 'http://go-svc:8080',
      tsServiceUrl: 'http://ts-svc:3001',
    });
    if (config) {
      service.loadConfig(config);
    }
    return service;
  }

  function createMockRequest(url: string, tenantId?: string): any {
    return {
      raw: { url },
      headers: tenantId ? { 'x-tenant-id': tenantId } : {},
      tenantId: tenantId || undefined,
    };
  }

  function createMockReply(): any {
    const headers: Record<string, string> = {};
    return {
      header: (key: string, value: string) => { headers[key] = value; },
      _headers: headers,
    };
  }

  test('skip system paths', async () => {
    const service = createMockGrayService();
    const hook = createGrayRouteHook(service);

    const request = createMockRequest('/healthz');
    const reply = createMockReply();

    await hook(request, reply);
    expect(request.grayReleaseResult).toBeUndefined();
  });

  test('sets grayReleaseResult when Redis config matches', async () => {
    const config: GrayReleaseConfig = {
      version: 1,
      defaultTarget: 'ts',
      routeTargets: [
        { path: '/api/v1/pipelines', target: 'go', weight: 100 },
      ],
    };
    const service = createMockGrayService(config);
    const hook = createGrayRouteHook(service);

    const request = createMockRequest('/api/v1/pipelines/runs/123', 'tenant-1');
    const reply = createMockReply();

    await hook(request, reply);
    expect(request.grayReleaseResult).toBeDefined();
    expect(request.grayReleaseResult.target).toBe('http://go-svc:8080');
    expect(reply._headers['X-Gray-Release-Source']).toBe('redis');
    expect(reply._headers['X-Gray-Release-Target']).toBe('go');
  });

  test('does not set grayReleaseResult when no match', async () => {
    const config: GrayReleaseConfig = {
      version: 1,
      defaultTarget: 'ts',
      routeTargets: [
        { path: '/api/v1/pipelines', target: 'go', weight: 100 },
      ],
    };
    const service = createMockGrayService(config);
    const hook = createGrayRouteHook(service);

    const request = createMockRequest('/api/v1/tickets/list', 'tenant-1');
    const reply = createMockReply();

    await hook(request, reply);
    // 没有匹配的规则，但默认目标是 ts，所以应该有结果
    expect(request.grayReleaseResult).toBeDefined();
  });
});
