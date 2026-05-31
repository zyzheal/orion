/**
 * APIPlaygroundService - 开发者门户在线调试服务
 *
 * 提供在线 API 调试能力：发送请求、查看响应、保存请求历史。
 * 支持自定义 Headers、Body、Query 参数。
 */

import { randomUUID } from 'crypto';
import {
  DevPortalPlaygroundRequestRepository,
  DevPortalPlaygroundResponseRepository,
} from '../../repositories/DevPortalPlaygroundRepository';

// ==================== Type Definitions ====================

export interface PlaygroundRequest {
  id: string;
  tenantId: string;
  userId: string;
  name: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  queryParams: Record<string, string>;
  body: string;
  bodyType: 'json' | 'form' | 'raw' | 'none';
  createdAt: Date;
}

export interface PlaygroundResponse {
  id: string;
  requestId: string;
  statusCode: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  latencyMs: number;
  timestamp: Date;
}

export interface PlaygroundRequestInput {
  tenantId: string;
  userId: string;
  name?: string;
  method: string;
  url: string;
  headers?: Record<string, string>;
  queryParams?: Record<string, string>;
  body?: string;
  bodyType?: 'json' | 'form' | 'raw' | 'none';
}

export interface PlaygroundExecuteResult {
  request: PlaygroundRequest;
  response: PlaygroundResponse;
}

export class APIPlaygroundServiceError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'APIPlaygroundServiceError';
  }
}

// ==================== Service ====================

export class APIPlaygroundService {
  private requests: Map<string, PlaygroundRequest> = new Map();
  private responses: Map<string, PlaygroundResponse[]> = new Map();
  private requestRepo: DevPortalPlaygroundRequestRepository | null = null;
  private responseRepo: DevPortalPlaygroundResponseRepository | null = null;

  constructor(db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    if (db) {
      this.requestRepo = new DevPortalPlaygroundRequestRepository(db);
      this.responseRepo = new DevPortalPlaygroundResponseRepository(db);
    }
  }

  /**
   * 保存请求模板
   */
  async saveRequest(input: PlaygroundRequestInput): Promise<PlaygroundRequest> {
    if (!input.url || input.url.trim().length === 0) {
      throw new APIPlaygroundServiceError('URL is required', 'INVALID_INPUT');
    }
    if (!input.method || input.method.trim().length === 0) {
      throw new APIPlaygroundServiceError('HTTP method is required', 'INVALID_INPUT');
    }

    const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
    const method = input.method.toUpperCase();
    if (!validMethods.includes(method)) {
      throw new APIPlaygroundServiceError(`Invalid HTTP method: ${input.method}`, 'INVALID_INPUT');
    }

    const request: PlaygroundRequest = {
      id: randomUUID(),
      tenantId: input.tenantId,
      userId: input.userId,
      name: input.name?.trim() || `${method} ${input.url}`,
      method,
      url: input.url.trim(),
      headers: input.headers ?? {},
      queryParams: input.queryParams ?? {},
      body: input.body ?? '',
      bodyType: input.bodyType ?? 'none',
      createdAt: new Date(),
    };

    this.requests.set(request.id, request);

    // PostgreSQL 持久化（异步）
    if (this.requestRepo) {
      this.requestRepo.create({
        id: request.id,
        tenantId: request.tenantId,
        userId: request.userId,
        name: request.name,
        method: request.method,
        url: request.url,
        headers: request.headers,
        queryParams: request.queryParams,
        body: request.body,
        bodyType: request.bodyType,
      }).catch(() => { /* 持久化失败不阻塞 */ });
    }

    return request;
  }

  /**
   * 获取请求模板
   */
  async getRequestById(id: string): Promise<PlaygroundRequest> {
    const req = this.requests.get(id);
    if (!req) {
      throw new APIPlaygroundServiceError(`Request not found: ${id}`, 'REQUEST_NOT_FOUND');
    }
    return req;
  }

  /**
   * 列出请求历史
   */
  async listRequests(
    tenantId: string,
    userId: string,
    options?: { method?: string; page?: number; pageSize?: number }
  ): Promise<{ data: PlaygroundRequest[]; total: number; page: number; totalPages: number }> {
    let requests = Array.from(this.requests.values())
      .filter((r) => r.tenantId === tenantId && r.userId === userId);

    if (options?.method) {
      requests = requests.filter((r) => r.method === options.method.toUpperCase());
    }

    requests.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 20;
    const total = requests.length;
    const start = (page - 1) * pageSize;
    const data = requests.slice(start, start + pageSize);

    return { data, total, page, totalPages: Math.ceil(total / pageSize) };
  }

  /**
   * 更新请求模板
   */
  async updateRequest(id: string, input: Partial<PlaygroundRequestInput>): Promise<PlaygroundRequest> {
    const req = this.requests.get(id);
    if (!req) {
      throw new APIPlaygroundServiceError(`Request not found: ${id}`, 'REQUEST_NOT_FOUND');
    }

    if (input.method) {
      const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
      const method = input.method.toUpperCase();
      if (!validMethods.includes(method)) {
        throw new APIPlaygroundServiceError(`Invalid HTTP method: ${input.method}`, 'INVALID_INPUT');
      }
      req.method = method;
    }
    if (input.name !== undefined) req.name = input.name.trim();
    if (input.url !== undefined) req.url = input.url.trim();
    if (input.headers !== undefined) req.headers = input.headers;
    if (input.queryParams !== undefined) req.queryParams = input.queryParams;
    if (input.body !== undefined) req.body = input.body;
    if (input.bodyType !== undefined) req.bodyType = input.bodyType;

    return req;
  }

  /**
   * 删除请求模板
   */
  async deleteRequest(id: string): Promise<boolean> {
    if (!this.requests.has(id)) {
      throw new APIPlaygroundServiceError(`Request not found: ${id}`, 'REQUEST_NOT_FOUND');
    }
    this.responses.delete(id);
    this.requests.delete(id);
    // PostgreSQL 持久化（异步）
    if (this.requestRepo) {
      this.requestRepo.delete(id).catch(() => { /* 持久化失败不阻塞 */ });
    }
    if (this.responseRepo) {
      this.responseRepo.deleteByRequestId(id).catch(() => { /* 持久化失败不阻塞 */ });
    }
    return true;
  }

  /**
   * 执行 API 请求（模拟）
   */
  async executeRequest(requestId: string): Promise<PlaygroundExecuteResult> {
    const request = this.requests.get(requestId);
    if (!request) {
      throw new APIPlaygroundServiceError(`Request not found: ${requestId}`, 'REQUEST_NOT_FOUND');
    }

    // Simulate request execution
    const startTime = Date.now();

    // Build URL with query params
    let fullUrl = request.url;
    const queryEntries = Object.entries(request.queryParams).filter(([_, v]) => v);
    if (queryEntries.length > 0) {
      const queryString = queryEntries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
      fullUrl += (fullUrl.includes('?') ? '&' : '?') + queryString;
    }

    // Simulate response based on URL patterns
    const simulatedResponse = this.simulateResponse(request.method, fullUrl, request.body);
    const latencyMs = Date.now() - startTime + Math.floor(Math.random() * 200) + 50;

    const response: PlaygroundResponse = {
      id: randomUUID(),
      requestId: request.id,
      statusCode: simulatedResponse.statusCode,
      statusText: simulatedResponse.statusText,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-Id': randomUUID(),
        'X-Response-Time': `${latencyMs}ms`,
        ...simulatedResponse.headers,
      },
      body: JSON.stringify(simulatedResponse.body, null, 2),
      latencyMs,
      timestamp: new Date(),
    };

    // Store response history
    const history = this.responses.get(requestId) ?? [];
    history.push(response);
    // Keep only last 50 responses per request
    if (history.length > 50) history.shift();
    this.responses.set(requestId, history);

    // PostgreSQL 持久化（异步）
    if (this.responseRepo) {
      this.responseRepo.create({
        id: response.id,
        requestId: response.requestId,
        statusCode: response.statusCode,
        statusText: response.statusText,
        headers: response.headers,
        body: response.body,
        latencyMs: response.latencyMs,
        timestamp: response.timestamp,
      }).catch(() => { /* 持久化失败不阻塞 */ });
    }

    return { request, response };
  }

  /**
   * 快速执行（不保存请求模板）
   */
  async quickExecute(input: PlaygroundRequestInput): Promise<PlaygroundExecuteResult> {
    const request = await this.saveRequest(input);
    return this.executeRequest(request.id);
  }

  /**
   * 获取请求的响应历史
   */
  async getResponseHistory(
    requestId: string,
    options?: { page?: number; pageSize?: number }
  ): Promise<{ data: PlaygroundResponse[]; total: number; page: number; totalPages: number }> {
    const responses = (this.responses.get(requestId) ?? [])
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 20;
    const total = responses.length;
    const start = (page - 1) * pageSize;
    const data = responses.slice(start, start + pageSize);

    return { data, total, page, totalPages: Math.ceil(total / pageSize) };
  }

  /**
   * 删除请求模板及历史
   */
  async clearHistory(requestId: string): Promise<void> {
    this.responses.delete(requestId);
  }

  /**
   * 获取统计
   */
  async getStats(tenantId: string, userId: string): Promise<{
    totalRequests: number;
    totalExecutions: number;
    avgLatency: number;
  }> {
    const requests = Array.from(this.requests.values())
      .filter((r) => r.tenantId === tenantId && r.userId === userId);

    let totalExecutions = 0;
    let totalLatency = 0;

    for (const req of requests) {
      const responses = this.responses.get(req.id) ?? [];
      totalExecutions += responses.length;
      totalLatency += responses.reduce((sum, r) => sum + r.latencyMs, 0);
    }

    return {
      totalRequests: requests.length,
      totalExecutions,
      avgLatency: totalExecutions > 0 ? Math.round(totalLatency / totalExecutions) : 0,
    };
  }

  // ==================== Internal Simulation ====================

  /**
   * 模拟 API 响应
   */
  private simulateResponse(method: string, url: string, body: string): {
    statusCode: number;
    statusText: string;
    headers: Record<string, string>;
    body: unknown;
  } {
    // Health check
    if (url.includes('/healthz') || url.includes('/health')) {
      return { statusCode: 200, statusText: 'OK', headers: {}, body: { status: 'ok', uptime: '12d 3h 45m' } };
    }

    // Error simulation
    if (url.includes('/error')) {
      return {
        statusCode: 500,
        statusText: 'Internal Server Error',
        headers: {},
        body: { error: 'Internal Server Error', message: 'Simulated error response' },
      };
    }

    // Not found
    if (url.includes('/not-found') || url.includes('/404')) {
      return {
        statusCode: 404,
        statusText: 'Not Found',
        headers: {},
        body: { error: 'Not Found', message: 'The requested resource was not found' },
      };
    }

    // Default success response based on method
    switch (method) {
      case 'POST':
        return {
          statusCode: 201,
          statusText: 'Created',
          headers: {},
          body: {
            success: true,
            data: {
              id: randomUUID(),
              ...this.tryParseJson(body),
              createdAt: new Date().toISOString(),
            },
            message: 'Resource created successfully',
          },
        };
      case 'PUT':
      case 'PATCH':
        return {
          statusCode: 200,
          statusText: 'OK',
          headers: {},
          body: {
            success: true,
            data: {
              id: randomUUID(),
              ...this.tryParseJson(body),
              updatedAt: new Date().toISOString(),
            },
            message: 'Resource updated successfully',
          },
        };
      case 'DELETE':
        return {
          statusCode: 200,
          statusText: 'OK',
          headers: {},
          body: { success: true, message: 'Resource deleted successfully' },
        };
      default:
        return {
          statusCode: 200,
          statusText: 'OK',
          headers: {},
          body: {
            success: true,
            data: [
              { id: randomUUID(), name: 'Sample Item 1', status: 'active' },
              { id: randomUUID(), name: 'Sample Item 2', status: 'inactive' },
            ],
            total: 2,
            page: 1,
            totalPages: 1,
          },
        };
    }
  }

  private tryParseJson(str: string): Record<string, unknown> {
    try {
      return JSON.parse(str);
    } catch {
      return {};
    }
  }
}
