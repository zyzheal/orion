/**
 * Build Log Controller - 构建日志 API 控制器
 *
 * 支持：
 * - 日志查询
 * - 日志流订阅（SSE）
 * - 日志导入
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { BuildLogService } from '../../services/BuildLogService';
import {
  LogLevel,
  LogStreamConfig,
  BuildLogQueryOptions,
} from '../../../models/BuildLog';

export class BuildLogController {
  private service: BuildLogService;

  constructor(service: BuildLogService) {
    this.service = service;
  }

  /**
   * POST /api/v1/build-logs - 创建日志记录
   */
  async createLog(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const body = request.body as {
      runId?: string;
      stageId?: string;
      taskId?: string;
      podId?: string;
      podName?: string;
      containerName?: string;
    };

    try {
      const log = await this.service.createLog(body);
      reply.status(201).send(log);
    } catch (error) {
      reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to create build log',
      });
    }
  }

  /**
   * GET /api/v1/build-logs - 查询日志
   */
  async queryLogs(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const query = request.query as Record<string, string>;

    try {
      const options: BuildLogQueryOptions = {};

      if (query.runId) options.runId = query.runId;
      if (query.stageId) options.stageId = query.stageId;
      if (query.taskId) options.taskId = query.taskId;
      if (query.podId) options.podId = query.podId;
      if (query.containerName) options.containerName = query.containerName;
      if (query.level) options.level = query.level as LogLevel;
      if (query.since) options.since = query.since;
      if (query.until) options.until = query.until;
      if (query.limit) options.limit = parseInt(query.limit, 10);
      if (query.offset) options.offset = parseInt(query.offset, 10);

      const logs = await this.service.queryLogs(options);
      reply.send(logs);
    } catch (error) {
      reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to query build logs',
      });
    }
  }

  /**
   * GET /api/v1/build-logs/:id - 获取日志详情
   */
  async getLog(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as { id: string };

    try {
      const log = await this.service.getLog(id);
      if (!log) {
        reply.status(404).send({
          error: 'NOT_FOUND',
          message: `Build log '${id}' not found`,
        });
        return;
      }
      reply.send(log);
    } catch (error) {
      reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to get build log',
      });
    }
  }

  /**
   * GET /api/v1/build-logs/:id/text - 获取格式化日志文本
   */
  async getLogText(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as { id: string };

    try {
      const log = await this.service.getLog(id);
      if (!log) {
        reply.status(404).send({
          error: 'NOT_FOUND',
          message: `Build log '${id}' not found`,
        });
        return;
      }
      const text = this.service.getLogText(log);
      reply.header('Content-Type', 'text/plain').send(text);
    } catch (error) {
      reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to get log text',
      });
    }
  }

  /**
   * POST /api/v1/build-logs/:id/entries - 追加日志条目
   */
  async appendEntry(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as { id: string };
    const body = request.body as {
      message: string;
      level?: LogLevel;
      source?: string;
      stream?: 'stdout' | 'stderr';
    };

    if (!body.message) {
      reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'message is required',
      });
      return;
    }

    try {
      const log = await this.service.appendEntry(id, body.message, {
        level: body.level,
        source: body.source,
        stream: body.stream,
      });
      if (!log) {
        reply.status(404).send({
          error: 'NOT_FOUND',
          message: `Build log '${id}' not found`,
        });
        return;
      }
      reply.send(log);
    } catch (error) {
      reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to append log entry',
      });
    }
  }

  /**
   * POST /api/v1/build-logs/:id/entries/batch - 批量追加日志
   */
  async appendEntries(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as { id: string };
    const body = request.body as {
      entries: Array<{
        timestamp: string;
        level: LogLevel;
        message: string;
        source?: string;
        stream?: 'stdout' | 'stderr';
      }>;
    };

    if (!body.entries || body.entries.length === 0) {
      reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'entries array is required',
      });
      return;
    }

    try {
      const log = await this.service.appendEntries(id, body.entries);
      if (!log) {
        reply.status(404).send({
          error: 'NOT_FOUND',
          message: `Build log '${id}' not found`,
        });
        return;
      }
      reply.send(log);
    } catch (error) {
      reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to append log entries',
      });
    }
  }

  /**
   * POST /api/v1/build-logs/:id/import - 从原始文本导入日志
   */
  async importLogs(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as { id: string };
    const body = request.body as { text: string; source?: string };

    if (!body.text) {
      reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'text is required',
      });
      return;
    }

    try {
      const log = await this.service.importFromRawText(id, body.text, {
        source: body.source,
      });
      if (!log) {
        reply.status(404).send({
          error: 'NOT_FOUND',
          message: `Build log '${id}' not found`,
        });
        return;
      }
      reply.send(log);
    } catch (error) {
      reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to import logs',
      });
    }
  }

  /**
   * POST /api/v1/build-logs/:id/complete - 标记日志完成
   */
  async completeLog(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as { id: string };

    try {
      const log = await this.service.completeLog(id);
      if (!log) {
        reply.status(404).send({
          error: 'NOT_FOUND',
          message: `Build log '${id}' not found`,
        });
        return;
      }
      reply.send(log);
    } catch (error) {
      reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to complete log',
      });
    }
  }

  /**
   * GET /api/v1/build-logs/:id/stream - SSE 日志流
   *
   * Server-Sent Events 端点，用于实时推送日志
   */
  async streamLogs(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as { id: string };
    const query = request.query as Record<string, string>;

    // 设置 SSE 头部
    reply.header('Content-Type', 'text/event-stream');
    reply.header('Cache-Control', 'no-cache');
    reply.header('Connection', 'keep-alive');
    reply.header('X-Accel-Buffering', 'no');

    // 获取日志
    const log = await this.service.getLog(id);
    if (!log) {
      reply.status(404).send({
        error: 'NOT_FOUND',
        message: `Build log '${id}' not found`,
      });
      return;
    }

    // 发送已有日志
    const raw = reply.raw;

    const sendEvent = (event: string, data: unknown): void => {
      raw.write(`event: ${event}\n`);
      raw.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // 发送已有条目
    for (const entry of log.entries) {
      sendEvent('log', entry);
    }

    // 订阅新日志
    const config: LogStreamConfig = {
      runId: log.runId,
      stageId: log.stageId,
      taskId: log.taskId,
      podId: log.podId,
      containerName: log.containerName,
      follow: query.follow !== 'false',
    };

    const subscriberId = this.service.subscribe(config, {
      onLog: (entry) => {
        sendEvent('log', entry);
      },
      onComplete: () => {
        sendEvent('complete', { logId: id });
        raw.end();
      },
      onError: (error) => {
        sendEvent('error', { message: error.message });
      },
    });

    // 客户端断开时取消订阅
    raw.on('close', () => {
      this.service.unsubscribe(subscriberId);
    });

    // 如果日志已完成，直接结束
    if (log.isComplete) {
      sendEvent('complete', { logId: id });
      raw.end();
    }
  }
}
