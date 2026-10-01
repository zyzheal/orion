/**
 * WebSocket Proxy
 *
 * 将客户端 WebSocket 连接代理到后端微服务。
 * 支持：
 * - 基于 URL 路径的服务路由（如 /ws/pipeline/:id -> pipeline service）
 * - 认证头和租户上下文传播
 * - 双向消息转发
 * - 优雅的连接生命周期管理（错误处理、超时、清理）
 * - 通过服务注册表动态解析目标地址
 */

import { FastifyRequest } from 'fastify';
import WebSocket from 'ws';
import { getConfig } from '../config';

/**
 * 代理路由配置
 * 将 WebSocket URL 路径映射到后端服务
 */
export interface WsProxyRoute {
  /** URL 路径前缀（如 '/ws/pipeline'） */
  pathPrefix: string;
  /** 目标服务的配置 key（如 'pipeline'），对应 config.services 中的 key */
  serviceKey: string;
  /** 目标服务的 WebSocket 路径（默认与 pathPrefix 相同） */
  targetPath?: string;
}

/**
 * 代理连接选项
 */
export interface WsProxyOptions {
  /** 连接超时（毫秒） */
  connectTimeoutMs?: number;
  /** 是否传播认证头 */
  propagateAuth?: boolean;
  /** 是否传播租户 ID */
  propagateTenant?: boolean;
  /** 自定义请求头 */
  customHeaders?: Record<string, string>;
}

/** 默认代理选项 */
const DEFAULT_OPTIONS: Required<WsProxyOptions> = {
  connectTimeoutMs: 10000,
  propagateAuth: true,
  propagateTenant: true,
  customHeaders: {},
};

/** 默认 WebSocket 代理路由表 */
export const DEFAULT_WS_ROUTES: WsProxyRoute[] = [
  {
    pathPrefix: '/ws/pipeline',
    serviceKey: 'pipeline',
  },
  {
    pathPrefix: '/ws/deploy',
    serviceKey: 'deploy',
  },
  {
    pathPrefix: '/ws/monitoring',
    serviceKey: 'monitor',
  },
  {
    pathPrefix: '/ws/chatops',
    serviceKey: 'chatops',
  },
  {
    pathPrefix: '/ws/agent',
    serviceKey: 'agent',
  },
  {
    pathPrefix: '/ws/runner',
    serviceKey: 'runner',
  },
];

/**
 * WebSocket 代理错误类型
 */
export class WsProxyError extends Error {
  constructor(
    message: string,
    public readonly code: number,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'WsProxyError';
  }
}

/**
 * 代理统计信息
 */
export interface WsProxyStats {
  totalConnections: number;
  activeConnections: number;
  failedConnections: number;
  messagesForwarded: number;
}

/**
 * WebSocket 代理
 *
 * 将客户端 WebSocket 连接透明地转发到后端微服务。
 */
export class WebSocketProxy {
  private routes: WsProxyRoute[];
  private options: Required<WsProxyOptions>;
  private activeConnections: Map<string, { client: WebSocket; target: WebSocket }> = new Map();
  private stats: WsProxyStats = {
    totalConnections: 0,
    activeConnections: 0,
    failedConnections: 0,
    messagesForwarded: 0,
  };

  constructor(routes?: WsProxyRoute[], options?: WsProxyOptions) {
    this.routes = routes || DEFAULT_WS_ROUTES;
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * 根据客户端请求路径解析目标 WebSocket URL
   *
   * @param requestPath - 客户端请求路径（如 '/ws/pipeline/run-123'）
   * @returns 解析后的目标 ws:// URL，未匹配返回 null
   */
  resolveTarget(requestPath: string): { url: string; route: WsProxyRoute } | null {
    for (const route of this.routes) {
      if (requestPath.startsWith(route.pathPrefix)) {
        const config = getConfig();
        const serviceConfig = config.services[route.serviceKey];

        if (!serviceConfig?.url) {
          return null;
        }

        // 将 http:// 转为 ws://，https:// 转为 wss://
        const wsUrl = serviceConfig.url.replace(/^http:\/\//, 'ws://').replace(/^https:\/\//, 'wss://');

        // 构建目标路径：保留 pathPrefix 后面的子路径
        const subPath = requestPath.slice(route.pathPrefix.length);
        const targetPath = route.targetPath
          ? `${route.targetPath}${subPath}`
          : `${route.pathPrefix}${subPath}`;

        return {
          url: `${wsUrl}${targetPath}`,
          route,
        };
      }
    }

    return null;
  }

  /**
   * 构建代理请求头
   * 从客户端请求中提取认证信息和租户上下文，传播到后端服务
   */
  private buildProxyHeaders(request: FastifyRequest): Record<string, string> {
    const headers: Record<string, string> = {};

    // 传播认证头
    if (this.options.propagateAuth) {
      const authHeader = request.headers.authorization;
      if (authHeader) {
        headers['Authorization'] = authHeader;
      }

      const apiKey = request.headers['x-api-key'];
      if (apiKey) {
        headers['X-API-Key'] = apiKey as string;
      }
    }

    // 传播租户 ID
    if (this.options.propagateTenant && (request as any).tenantId) {
      headers['X-Tenant-ID'] = (request as any).tenantId;
    }

    // 传播请求追踪 ID
    if ((request as any).requestId) {
      headers['X-Request-ID'] = (request as any).requestId;
    }

    // 传播原始客户端 IP
    if (request.ip) {
      headers['X-Forwarded-For'] = request.ip;
    }

    // 合并自定义头
    Object.assign(headers, this.options.customHeaders);

    return headers;
  }

  /**
   * 执行 WebSocket 代理
   *
   * 将客户端 WebSocket 连接代理到目标后端服务。双向转发所有消息。
   *
   * @param clientWs - 客户端 WebSocket 连接
   * @param request - 原始 HTTP 升级请求
   * @param targetUrl - 目标 WebSocket URL
   * @param connectionId - 连接标识（用于日志和统计）
   */
  async proxy(
    clientWs: WebSocket,
    request: FastifyRequest,
    targetUrl: string,
    connectionId?: string
  ): Promise<void> {
    const connId = connectionId || `ws-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.stats.totalConnections++;
    this.stats.activeConnections++;

    const headers = this.buildProxyHeaders(request);

    return new Promise<void>((resolve, reject) => {
      // 创建到目标服务的 WebSocket 连接
      const targetWs = new WebSocket(targetUrl, {
        headers,
        handshakeTimeout: this.options.connectTimeoutMs,
      });

      let resolved = false;
      let cleanupDone = false;

      /** 统一清理函数：关闭两端连接并更新统计 */
      const cleanup = (reason: string) => {
        if (cleanupDone) return;
        cleanupDone = true;

        this.activeConnections.delete(connId);
        this.stats.activeConnections--;

        // 安全关闭两端
        this.safeClose(clientWs, `Client cleanup: ${reason}`);
        this.safeClose(targetWs, `Target cleanup: ${reason}`);
      };

      // --- 目标连接事件 ---

      targetWs.on('open', () => {
        resolved = true;
        this.activeConnections.set(connId, { client: clientWs, target: targetWs });

        // 双向消息转发：客户端 -> 目标
        clientWs.on('message', (data: WebSocket.Data, isBinary: boolean) => {
          if (targetWs.readyState === WebSocket.OPEN) {
            targetWs.send(data, { binary: isBinary });
            this.stats.messagesForwarded++;
          }
        });

        // 双向消息转发：目标 -> 客户端
        targetWs.on('message', (data: WebSocket.Data, isBinary: boolean) => {
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(data, { binary: isBinary });
            this.stats.messagesForwarded++;
          }
        });

        resolve();
      });

      // 连接超时
      const connectTimeout = setTimeout(() => {
        if (!resolved) {
          this.stats.failedConnections++;
          cleanup('Connection timeout');
          reject(new WsProxyError(
            `WebSocket connection timeout to ${targetUrl}`,
            504,
            { targetUrl, timeout: this.options.connectTimeoutMs }
          ));
        }
      }, this.options.connectTimeoutMs);

      targetWs.on('open', () => {
        clearTimeout(connectTimeout);
      });

      // 目标连接错误
      targetWs.on('error', (err: Error) => {
        clearTimeout(connectTimeout);

        if (!resolved) {
          this.stats.failedConnections++;
          cleanup(`Target error: ${err.message}`);
          reject(new WsProxyError(
            `Failed to connect to target WebSocket: ${err.message}`,
            502,
            { targetUrl, originalError: err.message }
          ));
        } else {
          // 连接已建立后出错，优雅关闭
          cleanup(`Target error after open: ${err.message}`);
        }
      });

      // 目标连接关闭
      targetWs.on('close', (code: number, reason: Buffer) => {
        clearTimeout(connectTimeout);
        cleanup(`Target closed: ${code} ${reason.toString()}`);
      });

      // --- 客户端连接事件 ---

      // 客户端关闭
      clientWs.on('close', (code: number, reason: Buffer) => {
        cleanup(`Client closed: ${code} ${reason.toString()}`);
      });

      // 客户端错误
      clientWs.on('error', (err: Error) => {
        cleanup(`Client error: ${err.message}`);
      });
    });
  }

  /**
   * 安全关闭 WebSocket 连接
   */
  private safeClose(ws: WebSocket, reason: string): void {
    try {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close(1000, reason.slice(0, 123)); // WebSocket 协议限制 reason 最大 123 字节
      } else if (ws.readyState !== WebSocket.CLOSING) {
        // 如果连接未在关闭中，强制终止
        ws.terminate();
      }
    } catch {
      // 忽略关闭错误
    }
  }

  /**
   * 获取代理统计信息
   */
  getStats(): WsProxyStats {
    return { ...this.stats };
  }

  /**
   * 获取当前活跃连接数
   */
  getActiveConnectionCount(): number {
    return this.activeConnections.size;
  }

  /**
   * 关闭所有代理连接
   * 在网关优雅关闭时调用
   */
  closeAll(): void {
    for (const [connId, { client, target }] of this.activeConnections) {
      this.safeClose(client, 'Gateway shutting down');
      this.safeClose(target, 'Gateway shutting down');
    }
    this.activeConnections.clear();
    this.stats.activeConnections = 0;
  }

  /**
   * 添加自定义代理路由
   */
  addRoute(route: WsProxyRoute): void {
    // 避免重复
    const existing = this.routes.findIndex((r) => r.pathPrefix === route.pathPrefix);
    if (existing >= 0) {
      this.routes[existing] = route;
    } else {
      this.routes.push(route);
    }
  }

  /**
   * 获取当前路由表
   */
  getRoutes(): WsProxyRoute[] {
    return [...this.routes];
  }
}

/** 全局单例 */
export const wsProxy = new WebSocketProxy();
