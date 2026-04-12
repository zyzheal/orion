/**
 * WebSocket 服务器
 *
 * 集成 WebSocket 服务到 Fastify 应用
 * 提供认证、心跳、自动重连等功能
 */

import { FastifyInstance, FastifyRequest } from 'fastify';
import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { WsAuthHandler } from './ws-auth';
import { WebSocketConnectionManager } from './ws-heartbeat';
import { generateId } from '../utils';
import type { Data as WebSocketData } from 'ws';

export interface WebSocketServerConfig {
  path: string; // WebSocket 路径
  heartbeatInterval?: number; // 心跳间隔（毫秒）
  heartbeatTimeout?: number; // 心跳超时（毫秒）
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
  private config: WebSocketServerConfig;

  constructor(private app: FastifyInstance, config?: Partial<WebSocketServerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.connectionManager = new WebSocketConnectionManager();
    this.authHandler = new WsAuthHandler(app);
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
   */
  private handleConnection(ws: WebSocket, request: IncomingMessage): void {
    // 生成客户端 ID
    const clientId = generateId();
    const user = (ws as any).user;
    const userId = user?.sub || 'anonymous';

    this.app.log.info({ clientId, userId }, 'New WebSocket connection');

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
   * 关闭 WebSocket 服务器
   */
  async shutdown(): Promise<void> {
    // 关闭所有连接
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
