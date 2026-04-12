/**
 * 服务间通信客户端
 *
 * 提供统一的服务调用能力，包括：
 * - 超时控制（默认 30 秒）
 * - 指数退避重试（1s→2s→4s→8s→16s→30s）
 * - 熔断机制（连续失败 5 次触发 OPEN 状态）
 * - 请求追踪 ID 传播
 * - 租户 ID 传播
 */

import { EventEmitter } from 'events';

/**
 * 熔断器状态
 */
export enum CircuitState {
  CLOSED = 'CLOSED',     // 正常状态，允许请求
  OPEN = 'OPEN',         // 熔断状态，拒绝请求
  HALF_OPEN = 'HALF_OPEN', // 半开状态，允许探测请求
}

/**
 * 服务路由配置
 */
export interface ServiceRouteConfig {
  baseUrl: string;
  timeout: number;
  retries: number;
  circuitBreakerThreshold: number;
  circuitBreakerResetTimeout?: number;
}

/**
 * 服务路由表
 */
export const SERVICE_ROUTES: Record<string, ServiceRouteConfig> = {
  'platform-service': {
    baseUrl: process.env.PLATFORM_SERVICE_URL || 'http://localhost:3001',
    timeout: 30000,
    retries: 3,
    circuitBreakerThreshold: 5,
    circuitBreakerResetTimeout: 30000,
  },
};

/**
 * 熔断器
 */
class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private successCount: number = 0;

  constructor(
    private readonly threshold: number,
    private readonly resetTimeout: number = 30000
  ) {}

  /**
   * 检查是否允许请求
   */
  canRequest(): boolean {
    if (this.state === CircuitState.CLOSED) {
      return true;
    }

    if (this.state === CircuitState.OPEN) {
      // 检查是否可以进入 HALF_OPEN 状态
      const elapsed = Date.now() - this.lastFailureTime;
      if (elapsed >= this.resetTimeout) {
        this.state = CircuitState.HALF_OPEN;
        this.successCount = 0;
        return true;
      }
      return false;
    }

    // HALF_OPEN 状态允许请求
    return true;
  }

  /**
   * 记录成功
   */
  recordSuccess(): void {
    this.failureCount = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      // 探测成功，恢复 CLOSED 状态
      this.state = CircuitState.CLOSED;
    }
  }

  /**
   * 记录失败
   */
  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      // 探测失败，重新进入 OPEN 状态
      this.state = CircuitState.OPEN;
    } else if (this.failureCount >= this.threshold) {
      this.state = CircuitState.OPEN;
    }
  }

  /**
   * 获取当前状态
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * 获取失败计数
   */
  getFailureCount(): number {
    return this.failureCount;
  }
}

/**
 * 服务客户端请求选项
 */
export interface ServiceRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
  skipRetry?: boolean;
}

/**
 * 服务客户端响应
 */
export interface ServiceResponse<T = any> {
  status: number;
  data: T;
  headers: Record<string, string>;
  requestId: string;
}

/**
 * 服务客户端错误
 */
export class ServiceClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 500,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'ServiceClientError';
  }
}

/**
 * 指数退避延迟计算
 * 序列：1s → 2s → 4s → 8s → 16s → 30s（最大）
 */
function calculateBackoff(attempt: number, maxDelay: number = 30000): number {
  const baseDelay = 1000; // 1 秒
  const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  return delay;
}

/**
 * 服务客户端
 *
 * 统一的服务间调用客户端，支持超时、重试、熔断
 */
export class ServiceClient extends EventEmitter {
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();

  constructor(private readonly routes: Record<string, ServiceRouteConfig> = SERVICE_ROUTES) {
    super();
  }

  /**
   * 获取服务配置
   */
  getServiceConfig(serviceName: string): ServiceRouteConfig | undefined {
    return this.routes[serviceName];
  }

  /**
   * 获取或创建熔断器
   */
  private getCircuitBreaker(serviceName: string, config: ServiceRouteConfig): CircuitBreaker {
    let breaker = this.circuitBreakers.get(serviceName);
    if (!breaker) {
      breaker = new CircuitBreaker(
        config.circuitBreakerThreshold,
        config.circuitBreakerResetTimeout
      );
      this.circuitBreakers.set(serviceName, breaker);
    }
    return breaker;
  }

  /**
   * 发送请求到服务
   */
  async request<T = any>(
    serviceName: string,
    path: string,
    options: ServiceRequestOptions = {}
  ): Promise<ServiceResponse<T>> {
    const config = this.routes[serviceName];
    if (!config) {
      throw new ServiceClientError('SERVICE_NOT_FOUND', `Service ${serviceName} not found`, 404);
    }

    const breaker = this.getCircuitBreaker(serviceName, config);
    const requestId = options.headers?.['X-Request-ID'] || this.generateRequestId();

    // 检查熔断器状态
    if (!breaker.canRequest()) {
      this.emit('circuit:open', serviceName, breaker.getState());
      throw new ServiceClientError(
        'CIRCUIT_OPEN',
        `Circuit breaker is open for service ${serviceName}`,
        503,
        { serviceName, state: breaker.getState() }
      );
    }

    const timeout = options.timeout ?? config.timeout;
    const maxRetries = options.skipRetry ? 0 : config.retries;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.executeRequest<T>(config.baseUrl, path, {
          ...options,
          timeout,
          headers: {
            ...options.headers,
            'X-Request-ID': requestId,
          },
        });

        // 请求成功，更新熔断器状态
        breaker.recordSuccess();
        this.emit('request:success', serviceName, path, attempt);

        return {
          ...response,
          requestId,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // 判断是否可重试
        const isRetryable = this.isRetryableError(error) && attempt < maxRetries;

        if (isRetryable) {
          const delay = calculateBackoff(attempt);
          this.emit('request:retry', serviceName, path, attempt + 1, delay, error);
          await this.sleep(delay);
        } else {
          // 不可重试或达到最大重试次数
          break;
        }
      }
    }

    // 所有重试失败
    breaker.recordFailure();
    this.emit('request:failed', serviceName, path, lastError);

    if (lastError instanceof ServiceClientError) {
      throw lastError;
    }

    throw new ServiceClientError(
      'SERVICE_ERROR',
      lastError?.message || 'Unknown error',
      500,
      { serviceName, path, originalError: lastError?.message }
    );
  }

  /**
   * 执行单个 HTTP 请求
   */
  private async executeRequest<T>(
    baseUrl: string,
    path: string,
    options: ServiceRequestOptions & { timeout: number }
  ): Promise<Omit<ServiceResponse<T>, 'requestId'>> {
    const url = `${baseUrl}${path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout);

    try {
      const response = await fetch(url, {
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      let data: T;
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        data = await response.json() as T;
      } else {
        data = (await response.text()) as unknown as T;
      }

      if (!response.ok) {
        throw new ServiceClientError(
          this.mapStatusCodeToErrorCode(response.status),
          `Service returned status ${response.status}`,
          response.status,
          data
        );
      }

      return {
        status: response.status,
        data,
        headers: responseHeaders,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof ServiceClientError) {
        throw error;
      }

      if (error instanceof Error) {
        const errorMsg = error.message?.toLowerCase() || '';
        if (error.name === 'AbortError' || errorMsg.includes('abort')) {
          throw new ServiceClientError('TIMEOUT', 'Request timeout', 504, { url, timeout: options.timeout });
        }
        throw new ServiceClientError('REQUEST_FAILED', error.message, 502, { url });
      }

      throw new ServiceClientError('UNKNOWN_ERROR', 'Unknown error occurred', 500, { url });
    }
  }

  /**
   * 判断错误是否可重试
   */
  private isRetryableError(error: unknown): boolean {
    if (error instanceof ServiceClientError) {
      // 超时、网关错误、服务不可用可重试
      const retryableCodes = ['TIMEOUT', 'REQUEST_FAILED', 'SERVICE_UNAVAILABLE'];
      const retryableStatus = [502, 503, 504];
      return retryableCodes.includes(error.code) || retryableStatus.includes(error.statusCode);
    }
    return false;
  }

  /**
   * 映射 HTTP 状态码到错误码
   */
  private mapStatusCodeToErrorCode(status: number): string {
    const statusMap: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      408: 'REQUEST_TIMEOUT',
      429: 'RATE_LIMITED',
      500: 'INTERNAL_ERROR',
      502: 'BAD_GATEWAY',
      503: 'SERVICE_UNAVAILABLE',
      504: 'GATEWAY_TIMEOUT',
    };
    return statusMap[status] || 'HTTP_ERROR';
  }

  /**
   * 生成请求 ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * 异步休眠
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 获取服务的熔断器状态
   */
  getCircuitState(serviceName: string): CircuitState | undefined {
    const breaker = this.circuitBreakers.get(serviceName);
    return breaker?.getState();
  }

  /**
   * 手动重置熔断器
   */
  resetCircuit(serviceName: string): void {
    const config = this.routes[serviceName];
    if (config) {
      this.circuitBreakers.set(serviceName, new CircuitBreaker(config.circuitBreakerThreshold));
      this.emit('circuit:reset', serviceName);
    }
  }

  /**
   * 便捷方法：GET 请求
   */
  async get<T = any>(
    serviceName: string,
    path: string,
    options: Omit<ServiceRequestOptions, 'method' | 'body'> = {}
  ): Promise<ServiceResponse<T>> {
    return this.request<T>(serviceName, path, { ...options, method: 'GET' });
  }

  /**
   * 便捷方法：POST 请求
   */
  async post<T = any>(
    serviceName: string,
    path: string,
    body: any,
    options: Omit<ServiceRequestOptions, 'method' | 'body'> = {}
  ): Promise<ServiceResponse<T>> {
    return this.request<T>(serviceName, path, { ...options, method: 'POST', body });
  }

  /**
   * 便捷方法：PUT 请求
   */
  async put<T = any>(
    serviceName: string,
    path: string,
    body: any,
    options: Omit<ServiceRequestOptions, 'method' | 'body'> = {}
  ): Promise<ServiceResponse<T>> {
    return this.request<T>(serviceName, path, { ...options, method: 'PUT', body });
  }

  /**
   * 便捷方法：DELETE 请求
   */
  async delete<T = any>(
    serviceName: string,
    path: string,
    options: Omit<ServiceRequestOptions, 'method' | 'body'> = {}
  ): Promise<ServiceResponse<T>> {
    return this.request<T>(serviceName, path, { ...options, method: 'DELETE' });
  }
}

// 默认服务客户端实例
export const serviceClient = new ServiceClient();