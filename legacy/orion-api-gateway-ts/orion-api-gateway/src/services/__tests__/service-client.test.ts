/**
 * ServiceClient 单元测试
 *
 * 测试覆盖：
 * - 正常调用场景
 * - 超时场景
 * - 重试场景
 * - 熔断触发场景
 */

import { ServiceClient, ServiceClientError, CircuitState, SERVICE_ROUTES } from '../service-client';

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock setTimeout for retry tests
const mockSleep = jest.fn().mockResolvedValue(undefined);

describe('ServiceClient', () => {
  let client: ServiceClient;

  const testRoutes = {
    'test-service': {
      baseUrl: 'http://localhost:3001',
      timeout: 1000,
      retries: 3,
      circuitBreakerThreshold: 3,
      circuitBreakerResetTimeout: 1000,
    },
  };

  beforeEach(() => {
    // Create client with mocked sleep
    client = new ServiceClient(testRoutes);
    // Override sleep method for faster tests
    (client as any).sleep = mockSleep;

    mockFetch.mockReset();
    mockSleep.mockReset();
    mockSleep.mockResolvedValue(undefined);
  });

  describe('正常调用场景', () => {
    it('应该成功发送 GET 请求并返回响应', async () => {
      const mockResponse = { data: 'test' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockResponse,
      });

      const result = await client.get('test-service', '/api/test');

      expect(result.status).toBe(200);
      expect(result.data).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('应该正确传播请求头（Request ID, Tenant ID）', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({}),
      });

      await client.get('test-service', '/api/test', {
        headers: {
          'X-Request-ID': 'custom-request-id',
          'X-Tenant-ID': 'tenant-123',
        },
      });

      const [url, options] = mockFetch.mock.calls[0];
      expect(options.headers['X-Request-ID']).toBe('custom-request-id');
      expect(options.headers['X-Tenant-ID']).toBe('tenant-123');
    });

    it('应该正确发送 POST 请求带 body', async () => {
      const requestBody = { name: 'test' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ id: 1 }),
      });

      const result = await client.post('test-service', '/api/test', requestBody);

      expect(result.status).toBe(201);
      const [, options] = mockFetch.mock.calls[0];
      expect(options.method).toBe('POST');
      expect(JSON.parse(options.body)).toEqual(requestBody);
    });

    it('应该为每个请求生成唯一的 request ID', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({}),
      });

      const result1 = await client.get('test-service', '/api/test1');
      const result2 = await client.get('test-service', '/api/test2');

      expect(result1.requestId).toBeDefined();
      expect(result2.requestId).toBeDefined();
      expect(result1.requestId).not.toBe(result2.requestId);
    });
  });

  describe('超时场景', () => {
    it('应该在超时后抛出 TIMEOUT 错误', async () => {
      // 模拟 AbortError（fetch 被中止）- 使用标准错误名称
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';

      // 所有请求都返回 AbortError
      mockFetch.mockRejectedValue(abortError);

      await expect(client.get('test-service', '/api/test', { skipRetry: true })).rejects.toMatchObject({
        code: 'TIMEOUT',
        statusCode: 504,
      });
    });

    it('应该使用自定义超时时间', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({}),
      });

      await client.get('test-service', '/api/test', { timeout: 5000 });

      const [, options] = mockFetch.mock.calls[0];
      expect(options.signal).toBeDefined();
    });
  });

  describe('重试场景', () => {
    it('应该在可重试错误后自动重试', async () => {
      // 第一次请求失败（503）
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ error: 'Service Unavailable' }),
      });

      // 第二次请求成功
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ data: 'success' }),
      });

      const result = await client.get('test-service', '/api/test');

      expect(result.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockSleep).toHaveBeenCalledTimes(1); // 一次重试延迟
    });

    it('应该在达到最大重试次数后抛出错误', async () => {
      // 所有请求都失败
      mockFetch.mockResolvedValue({
        ok: false,
        status: 503,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ error: 'Service Unavailable' }),
      });

      await expect(client.get('test-service', '/api/test')).rejects.toThrow(ServiceClientError);

      // 初始请求 + 3 次重试 = 4 次调用
      expect(mockFetch).toHaveBeenCalledTimes(4);
      expect(mockSleep).toHaveBeenCalledTimes(3); // 3 次重试延迟
    });

    it('应该支持跳过重试', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ error: 'Service Unavailable' }),
      });

      await expect(
        client.get('test-service', '/api/test', { skipRetry: true })
      ).rejects.toThrow(ServiceClientError);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockSleep).not.toHaveBeenCalled(); // 不应该有重试延迟
    });

    it('应该使用指数退避延迟', async () => {
      const delays: number[] = [];
      mockSleep.mockImplementation((ms: number) => {
        delays.push(ms);
        return Promise.resolve();
      });

      mockFetch.mockResolvedValue({
        ok: false,
        status: 503,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ error: 'Service Unavailable' }),
      });

      await client.get('test-service', '/api/test').catch(() => {});

      // 验证指数退避：1s → 2s → 4s（转换为毫秒）
      expect(delays.length).toBe(3);
      expect(delays[0]).toBe(1000);  // 1s (2^0 * 1s)
      expect(delays[1]).toBe(2000);  // 2s (2^1 * 1s)
      expect(delays[2]).toBe(4000);  // 4s (2^2 * 1s)
    });
  });

  describe('熔断触发场景', () => {
    it('应该在连续失败达到阈值后触发熔断', async () => {
      // 所有请求都失败
      mockFetch.mockResolvedValue({
        ok: false,
        status: 503,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ error: 'Service Unavailable' }),
      });

      // 连续发起请求，直到熔断触发（阈值 3）
      for (let i = 0; i < 4; i++) {
        try {
          await client.get('test-service', '/api/test', { skipRetry: true });
        } catch (e) {
          // 忽略错误
        }
      }

      // 检查熔断状态
      const state = client.getCircuitState('test-service');
      expect(state).toBe(CircuitState.OPEN);
    });

    it('熔断打开时应该直接拒绝请求', async () => {
      // 让熔断器进入 OPEN 状态
      mockFetch.mockResolvedValue({
        ok: false,
        status: 503,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ error: 'Service Unavailable' }),
      });

      // 触发熔断（阈值 3，需要 4 次失败）
      for (let i = 0; i < 4; i++) {
        try {
          await client.get('test-service', '/api/test', { skipRetry: true });
        } catch (e) {
          // 忽略错误
        }
      }

      // 清空 mock 调用计数
      mockFetch.mockClear();

      // 再次请求应该被熔断
      await expect(client.get('test-service', '/api/test')).rejects.toMatchObject({
        code: 'CIRCUIT_OPEN',
        statusCode: 503,
      });

      // 不应该调用 fetch
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('应该能够手动重置熔断器', async () => {
      // 触发熔断
      mockFetch.mockResolvedValue({
        ok: false,
        status: 503,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ error: 'Service Unavailable' }),
      });

      for (let i = 0; i < 4; i++) {
        try {
          await client.get('test-service', '/api/test', { skipRetry: true });
        } catch (e) {
          // 忽略错误
        }
      }

      expect(client.getCircuitState('test-service')).toBe(CircuitState.OPEN);

      // 重置熔断器
      client.resetCircuit('test-service');

      expect(client.getCircuitState('test-service')).toBe(CircuitState.CLOSED);
    });
  });

  describe('服务不存在场景', () => {
    it('应该在服务不存在时抛出错误', async () => {
      await expect(client.get('unknown-service', '/api/test')).rejects.toMatchObject({
        code: 'SERVICE_NOT_FOUND',
        statusCode: 404,
      });
    });
  });

  describe('便捷方法', () => {
    it('应该支持 PUT 请求', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ updated: true }),
      });

      const result = await client.put('test-service', '/api/test/1', { name: 'updated' });

      expect(result.status).toBe(200);
      const [, options] = mockFetch.mock.calls[0];
      expect(options.method).toBe('PUT');
    });

    it('应该支持 DELETE 请求', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        headers: new Headers(),
        text: async () => '',
      });

      const result = await client.delete('test-service', '/api/test/1');

      expect(result.status).toBe(204);
      const [, options] = mockFetch.mock.calls[0];
      expect(options.method).toBe('DELETE');
    });
  });

  describe('事件发射', () => {
    it('应该在成功时发射 request:success 事件', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({}),
      });

      const successHandler = jest.fn();
      client.on('request:success', successHandler);

      await client.get('test-service', '/api/test');

      expect(successHandler).toHaveBeenCalledWith('test-service', '/api/test', 0);
    });

    it('应该在失败时发射 request:failed 事件', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ error: 'Internal Server Error' }),
      });

      const failedHandler = jest.fn();
      client.on('request:failed', failedHandler);

      await client.get('test-service', '/api/test', { skipRetry: true }).catch(() => {});

      expect(failedHandler).toHaveBeenCalled();
    });

    it('应该在熔断打开时发射 circuit:open 事件', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 503,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ error: 'Service Unavailable' }),
      });

      const openHandler = jest.fn();
      client.on('circuit:open', openHandler);

      // 触发熔断
      for (let i = 0; i < 5; i++) {
        try {
          await client.get('test-service', '/api/test', { skipRetry: true });
        } catch (e) {
          // 忽略错误
        }
      }

      expect(openHandler).toHaveBeenCalledWith('test-service', CircuitState.OPEN);
    });
  });
});

describe('SERVICE_ROUTES', () => {
  it('应该包含 platform-service 配置', () => {
    expect(SERVICE_ROUTES['platform-service']).toBeDefined();
    expect(SERVICE_ROUTES['platform-service'].timeout).toBe(30000);
    expect(SERVICE_ROUTES['platform-service'].retries).toBe(3);
    expect(SERVICE_ROUTES['platform-service'].circuitBreakerThreshold).toBe(5);
  });
});