/**
 * 日志中间件
 *
 * 记录请求/响应日志，支持结构化输出
 */

import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import { pino, Logger } from 'pino';
import { getConfig } from '../config';

export interface LogContext {
  requestId: string;
  method: string;
  url: string;
  startTime: number;
  userId?: string;
}

export class LoggingMiddleware {
  private logger: Logger;

  constructor(app: FastifyInstance) {
    const config = getConfig();

    this.logger = pino({
      level: config.logLevel,
      formatters: {
        level: (label) => ({ level: label }),
      },
      timestamp: pino.stdTimeFunctions.isoTime,
    });

    // 设置请求 ID 生成器
    app.addHook('onRequest', async (request, reply) => {
      const requestId = request.headers['x-request-id'] || this.generateRequestId();
      request.headers['x-request-id'] = requestId;
      reply.header('x-request-id', requestId);
    });
  }

  /**
   * 生成请求 ID
   */
  private generateRequestId(): string {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 8);
    return `${timestamp}-${randomPart}`;
  }

  /**
   * 日志中间件处理器
   */
  async handler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const requestId = request.headers['x-request-id'] as string;
    const startTime = Date.now();

    const logContext: LogContext = {
      requestId,
      method: request.method,
      url: request.raw.url || '',
      startTime,
    };

    // 请求日志
    this.logger.info(
      {
        type: 'request',
        method: request.method,
        url: request.url,
        headers: this.sanitizeHeaders(request.headers),
        query: request.query,
        requestId,
      },
      'Incoming request'
    );

    // 响应日志（在 onSend 钩子中记录）
    reply.raw.on('finish', () => {
      const duration = Date.now() - startTime;
      this.logger.info(
        {
          type: 'response',
          method: request.method,
          url: request.url,
          statusCode: reply.statusCode,
          duration,
          requestId,
        },
        'Request completed'
      );
    });
  }

  /**
   * 脱敏敏感头部信息
   */
  private sanitizeHeaders(headers: any): any {
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];
    const sanitized = { ...headers };

    for (const header of sensitiveHeaders) {
      if (sanitized[header]) {
        sanitized[header] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  /**
   * 获取日志记录器
   */
  getLogger(): Logger {
    return this.logger;
  }

  /**
   * 记录错误日志
   */
  error(context: LogContext, error: Error, additionalData?: any): void {
    this.logger.error(
      {
        ...context,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
        ...additionalData,
      },
      'Request error'
    );
  }

  /**
   * 记录访问日志
   */
  access(context: LogContext, statusCode: number, duration: number): void {
    this.logger.info(
      {
        ...context,
        statusCode,
        duration,
      },
      'Access log'
    );
  }
}
