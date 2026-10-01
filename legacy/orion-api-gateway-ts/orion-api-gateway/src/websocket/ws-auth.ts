/**
 * WebSocket 认证处理器
 *
 * 实现基于 JWT 的 WebSocket 连接认证
 * 支持多种 Token 获取方式：
 * - Query 参数：?token=<jwt_token>
 * - Sub-protocol: sec-websocket-protocol: <jwt_token>
 */

import { FastifyInstance } from 'fastify';
import { JwtPayload } from '../middleware/auth';

export interface WsAuthResult {
  authenticated: boolean;
  payload?: JwtPayload;
  error?: string;
}

export class WsAuthHandler {
  constructor(private app: FastifyInstance) {}

  /**
   * 从 WebSocket 升级请求中提取 Token
   */
  private extractToken(request: any): string | null {
    // 1. 从 Query 参数提取 ?token=xxx
    const url = new URL(request.url, 'http://localhost');
    const queryToken = url.searchParams.get('token');
    if (queryToken) {
      return queryToken;
    }

    // 2. 从 Sec-WebSocket-Protocol 头提取
    const protocol = request.headers['sec-websocket-protocol'];
    if (protocol && typeof protocol === 'string') {
      // 支持格式：Bearer <token> 或直接 token
      if (protocol.startsWith('Bearer ')) {
        return protocol.substring(7);
      }
      // 如果协议字符串看起来像 JWT（包含点号），直接作为 token
      if (protocol.includes('.')) {
        return protocol;
      }
    }

    return null;
  }

  /**
   * 验证 JWT Token
   */
  private async verifyToken(token: string): Promise<JwtPayload> {
    try {
      const decoded = await this.app.jwt.verify(token);
      return decoded as JwtPayload;
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * 认证 WebSocket 连接
   * @returns 认证结果，authenticated=false 表示认证失败
   */
  async authenticate(request: any): Promise<WsAuthResult> {
    try {
      const token = this.extractToken(request);

      if (!token) {
        return {
          authenticated: false,
          error: 'Token is required',
        };
      }

      const payload = await this.verifyToken(token);

      return {
        authenticated: true,
        payload,
      };
    } catch (error) {
      return {
        authenticated: false,
        error: error instanceof Error ? error.message : 'Authentication failed',
      };
    }
  }

  /**
   * 生成认证错误响应
   */
  getAuthErrorReply(error: string): { code: number; message: string } {
    return {
      code: 4001, // WebSocket 自定义错误码
      message: error,
    };
  }
}
