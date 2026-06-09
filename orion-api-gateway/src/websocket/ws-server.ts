/**
 * WebSocket 服务器
 *
 * 集成 WebSocket 服务到 Fastify 应用
 * 提供认证、心跳、自动重连等功能
 *
 * 支持两种连接模式：
 * 1. 本地处理：网关自身处理消息（ping/pong、广播等）
 * 2. 代理模式：匹配 /ws/* 路径的连接自动代理到后端微服务
 */

import { FastifyInstance, FastifyRequest } from 'fastify';
import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { WsAuthHandler } from './ws-auth';
import { WebSocketConnectionManager } from './ws-heartbeat';
import { WebSocketProxy, WsProxyRoute, WsProxyError, wsProxy } from './ws-proxy';
import { generateId } from '../utils';
import type { Data as WebSocketData } from 'ws';

export interface WebSocketServerConfig {
  path: string; // WebSocket 路径
  heartbeatInterval?: number; // 心跳间隔（毫秒）
  heartbeatTimeout?: number; // 心跳超时（毫秒）
  /** 自定义 WebSocket 代理路由（可选） */
  proxyRoutes?: WsProxyRoute[];
}

const DEFAULT_CONFIG: WebSocketServerConfig = {
  path: '/ws',
  heartbeatInterval: 30000, // 30 秒
  heartbeatTimeout: 15000, // 15 秒
};

export class WebSocketServerManager {
  private wss: WebSocketServer | null = null;
  private connectionManager: WebSocketConnectionManager;
  private authHandler: WsAuthHandler;
  private proxy: WebSocketProxy;
  private config: WebSocketServerConfig;

  constructor(private app: FastifyInstance, config?: Partial<WebSocketServerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.connectionManager = new WebSocketConnectionManager();
    this.authHandler = new WsAuthHandler(app);
    this.proxy = config?.proxyRoutes ? new WebSocketProxy(config.proxyRoutes) : wsProxy;
  }

  /**
   * 初始化 WebSocket 服务器
   */
  async initialize(): Promise<void> {
    // 创建 WebSocket Server
    this.wss = new WebSocketServer({
      noServer: true, // 不使用内置 HTTP 服务器
      path: this.config.path,
    });

    // 处理升级请求
    this.app.server.on('upgrade', (request, socket, head) => {
      this.handleUpgrade(request, socket, head);
    });

    // 处理新连接
    this.wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
      this.handleConnection(ws, request);
    });

    this.app.log.info({ path: this.config.path }, 'WebSocket server initialized');
  }

  /**
   * 处理 HTTP 升级请求
   */
  private async handleUpgrade(
    request: IncomingMessage,
    socket: any,
    head: Buffer
  ): Promise<void> {
    // 只处理 /ws 前缀的请求
    const url = request.url || '';
    if (!url.startsWith('/ws')) {
      return;
    }

    // 先进行认证
    const authResult = await this.authHandler.authenticate(request);

    if (!authResult.authenticated) {
      // 认证失败，返回错误
      socket.write('HTTP/1.1 401 Unauthorized\r\n');
      socket.write(`Content-Type: application/json\r\n`);
      socket.write('\r\n');
      socket.write(
        JSON.stringify({
          error: 'UNAUTHORIZED',
          message: authResult.error || 'Authentication required',
        })
      );
      socket.destroy();
      return;
    }

    // 认证通过，升级 WebSocket 连接
    this.wss?.handleUpgrade(request, socket, head, (ws) => {
      // 将用户信息附加到 WebSocket 对象上
      (ws as any).user = authResult.payload;
      this.wss?.emit('connection', ws, request);
    });
  }

  /**
   * 处理新连接
   * 检查请求路径是否匹配代理路由，匹配则代理到后端，否则本地处理
   */
  private async handleConnection(ws: WebSocket, request: IncomingMessage): Promise<void> {
    const requestPath = (request.url || '').split('?')[0]; // 去掉查询参数

    // 检查是否匹配代理路由
    const proxyTarget = this.proxy.resolveTarget(requestPath);

    if (proxyTarget) {
      // --- 代理模式：转发到后端微服务 ---
      await this.handleProxyConnection(ws, request, proxyTarget.url);
    } else {
      // --- 本地处理模式 ---
      this.handleLocalConnection(ws, request);
    }
  }

  /**
   * 代理模式：将 WebSocket 连接转发到后端微服务
   */
  private async handleProxyConnection(
    clientWs: WebSocket,
    request: IncomingMessage,
    targetUrl: string
  ): Promise<void> {
    const clientId = generateId();
    const user = (clientWs as any).user;
    const userId = user?.sub || 'anonymous';

    this.app.log.info(
      { clientId, userId, targetUrl },
      'Proxying WebSocket to backend service'
    );

    // 构建一个最小化的 FastifyRequest 代理以复用 buildProxyHeaders
    const fakeRequest = {
      headers: request.headers,
      ip: request.socket.remoteAddress,
      tenantId: (request as any).tenantId,
      requestId: (request as any).requestId || clientId,
    } as unknown as FastifyRequest;

    try {
      await this.proxy.proxy(clientWs, fakeRequest, targetUrl, clientId);
      this.app.log.info({ clientId, targetUrl }, 'WebSocket proxy connection established');
    } catch (error) {
      this.app.log.error(
        { err: error, clientId, targetUrl },
        'WebSocket proxy connection failed'
      );

      // 向客户端发送错误信息
      const errorMessage =
        error instanceof WsProxyError
          ? { type: 'error', code: error.code, message: error.message }
          : { type: 'error', code: 502, message: 'Failed to connect to backend service' };

      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify(errorMessage));
        clientWs.close(1011, 'Backend connection failed');
      }
    }
  }

  /**
   * 本地处理模式：网关自身处理 WebSocket 消息
   */
  private handleLocalConnection(ws: WebSocket, _request: IncomingMessage): void {
    // 生成客户端 ID
    const clientId = generateId();
    const user = (ws as any).user;
    const userId = user?.sub || 'anonymous';

    this.app.log.info({ clientId, userId }, 'New local WebSocket connection');

    // 添加到连接管理器
    this.connectionManager.addConnection(clientId, ws, {
      intervalMs: this.config.heartbeatInterval,
      timeoutMs: this.config.heartbeatTimeout,
    });

    // 发送欢迎消息
    this.sendMessage(ws, {
      type: 'connected',
      clientId,
      userId,
      timestamp: Date.now(),
    });

    // 监听消息
    ws.on('message', (data: WebSocketData) => {
      this.handleMessage(clientId, userId, data);
    });
  }

  /**
   * 处理客户端消息
   */
  private handleMessage(clientId: string, userId: string, data: WebSocketData): void {
    try {
      const message = JSON.parse(data.toString());

      this.app.log.debug({ clientId, userId, message }, 'WebSocket message received');

      // 处理特殊消息类型
      switch (message.type) {
        case 'ping':
          // 响应 ping
          this.sendToClient(clientId, {
            type: 'pong',
            timestamp: Date.now(),
          });
          break;

        default:
          // 广播消息给所有客户端（可根据需求修改）
          this.broadcast({
            type: 'message',
            from: userId,
            data: message,
            timestamp: Date.now(),
          });
          break;
      }
    } catch (error) {
      this.app.log.error({ err: error }, 'Failed to parse WebSocket message');
    }
  }

  /**
   * 发送消息到指定客户端
   */
  private sendMessage(ws: WebSocket, data: Record<string, unknown>): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  /**
   * 发送消息到指定客户端（通过连接管理器）
   */
  sendToClient(clientId: string, data: Record<string, unknown>): boolean {
    return this.connectionManager.sendToClient(clientId, JSON.stringify(data));
  }

  /**
   * 广播消息
   */
  broadcast(data: Record<string, unknown>): void {
    this.connectionManager.broadcast(JSON.stringify(data));
  }

  /**
   * 获取连接数量
   */
  getConnectionCount(): number {
    return this.connectionManager.getConnectionCount();
  }

  /**
   * 获取所有连接 ID
   */
  getAllConnectionIds(): string[] {
    return this.connectionManager.getAllConnectionIds();
  }

  /**
   * 获取连接管理器
   */
  getConnectionManager(): WebSocketConnectionManager {
    return this.connectionManager;
  }

  /**
   * 获取代理实例
   */
  getProxy(): WebSocketProxy {
    return this.proxy;
  }

  /**
   * 关闭 WebSocket 服务器
   */
  async shutdown(): Promise<void> {
    // 关闭所有代理连接
    this.proxy.closeAll();

    // 关闭所有本地连接
    this.connectionManager.closeAll();

    // 关闭服务器
    if (this.wss) {
      return new Promise((resolve) => {
        this.wss?.close(() => {
          this.app.log.info('WebSocket server closed');
          resolve();
        });
      });
    }
  }
}

/**
 * 导出创建函数
 */
export async function createWebSocketServer(
  app: FastifyInstance,
  config?: Partial<WebSocketServerConfig>
): Promise<WebSocketServerManager> {
  const server = new WebSocketServerManager(app, config);
  await server.initialize();
  return server;
}
