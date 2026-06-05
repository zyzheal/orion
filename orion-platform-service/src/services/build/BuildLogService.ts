/**
 * Build Log Service - 构建日志管理服务
 *
 * 职责：
 * - 实时读取 Pod 日志
 * - WebSocket/SSE 推送支持
 * - 日志持久化
 */

import {
  BuildLog,
  LogEntry,
  LogLevel,
  LogStreamConfig,
  BuildLogQueryOptions,
  createBuildLog,
  appendLogEntry,
  appendLogEntries,
  completeBuildLog,
  createLogEntry,
  parseLogLine,
} from '../../models/BuildLog';
import { BuildLogRepository } from '../../repositories/BuildLogRepository';
import pino from 'pino';
import { getCurrentTraceId } from '../../db/tenant-context-storage';

const logger = pino({ name: 'LBuild-LLog-LService' });

/**
 * 日志订阅者（用于 WebSocket/SSE 推送）
 */
interface LogSubscriber {
  id: string;
  config: LogStreamConfig;
  onLog: (entry: LogEntry) => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

export class BuildLogService {
  private subscribers: Map<string, LogSubscriber>;
  private logs: Map<string, BuildLog>;
  private repository?: BuildLogRepository;

  constructor(db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    this.subscribers = new Map();
    this.logs = new Map();
    if (db) {
      this.repository = new BuildLogRepository(db);
    }
  }

  /**
   * 创建构建日志记录
   */
  async createLog(options?: {
    runId?: string;
    stageId?: string;
    taskId?: string;
    podId?: string;
    podName?: string;
    containerName?: string;
  }): Promise<BuildLog> {
    const log = createBuildLog(options);
    this.logs.set(log.id, log);

    if (this.repository) {
      try {
        await this.repository.create({
          id: log.id,
          buildId: log.runId || log.id,
          projectId: options?.taskId,
          stage: options?.stageId || 'default',
          logContent: '',
          createdAt: log.createdAt,
        });
      } catch (err) {
        logger.warn(`[BuildLogService] Failed to persist log record: ${err}`);
      }
    }
    return log;
  }

  /**
   * 获取日志
   */
  async getLog(id: string): Promise<BuildLog | null> {
    const memLog = this.logs.get(id);
    if (memLog) return memLog;

    if (this.repository) {
      const dbLogs = await this.repository.findByBuildId(id);
      if (dbLogs.length > 0) {
        const dbLog = dbLogs[0];
        // Parse logContent string into LogEntry[]
        const entries: LogEntry[] = dbLog.logContent
          ? dbLog.logContent.split('\n').filter(line => line.trim()).map(line => parseLogLine(line))
          : [];

        return {
          id: dbLog.id,
          runId: dbLog.buildId,
          entries,
          isComplete: false,
          totalLines: entries.length,
          createdAt: dbLog.createdAt,
        };
      }
    }
    return null;
  }

  /**
   * 查询日志
   */
  async queryLogs(options: BuildLogQueryOptions): Promise<BuildLog[]> {
    let result = Array.from(this.logs.values());

    if (options.runId) {
      result = result.filter(log => log.runId === options.runId);
    }
    if (options.stageId) {
      result = result.filter(log => log.stageId === options.stageId);
    }
    if (options.taskId) {
      result = result.filter(log => log.taskId === options.taskId);
    }
    if (options.podId) {
      result = result.filter(log => log.podId === options.podId);
    }
    if (options.containerName) {
      result = result.filter(log => log.containerName === options.containerName);
    }
    if (options.level) {
      result = result.filter(log =>
        log.entries.some(e => e.level === options.level)
      );
    }

    result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const offset = options.offset || 0;
    const limit = options.limit || 100;
    return result.slice(offset, offset + limit);
  }

  /**
   * 追加日志条目
   */
  async appendEntry(logId: string, message: string, options?: {
    level?: LogLevel;
    source?: string;
    stream?: 'stdout' | 'stderr';
  }): Promise<BuildLog | null> {
    const log = this.logs.get(logId);
    if (!log) return null;

    const updated = appendLogEntry(log, message, options);
this.logs.set(logId, updated);

    // 通知订阅者
    const newEntry = updated.entries[updated.entries.length - 1];
    this.notifySubscribers(log, newEntry);

    return updated;
  }

  /**
   * 批量追加日志条目
   */
  async appendEntries(logId: string, entries: LogEntry[]): Promise<BuildLog | null> {
    const log = this.logs.get(logId);
    if (!log) return null;

    const updated = appendLogEntries(log, entries);
this.logs.set(logId, updated);

    // 通知订阅者
    for (const entry of entries) {
      this.notifySubscribers(log, entry);
    }

    return updated;
  }

  /**
   * 从原始文本导入日志
   */
  async importFromRawText(
    logId: string,
    rawText: string,
    options?: { source?: string }
  ): Promise<BuildLog | null> {
    const log = this.logs.get(logId);
    if (!log) return null;

    const lines = rawText.split('\n').filter(line => line.trim());
    const entries = lines.map(line => parseLogLine(line, options?.source));

    const updated = appendLogEntries(log, entries);
this.logs.set(logId, updated);

    return updated;
  }

  /**
   * 标记日志完成
   */
  async completeLog(logId: string): Promise<BuildLog | null> {
    const log = this.logs.get(logId);
    if (!log) return null;

    const updated = completeBuildLog(log);
this.logs.set(logId, updated);

    // 通知订阅者日志已完成
    const subscribers = Array.from(this.subscribers.values()).filter(
      sub => this.matchSubscriber(sub, log)
    );
    for (const sub of subscribers) {
      sub.onComplete?.();
    }

    return updated;
  }

  // ==================== WebSocket/SSE 订阅 ====================

  /**
   * 订阅日志流
   *
   * @param config 订阅配置
   * @param callbacks 回调函数
   * @returns 订阅 ID
   */
  subscribe(
    config: LogStreamConfig,
    callbacks: {
      onLog: (entry: LogEntry) => void;
      onComplete?: () => void;
      onError?: (error: Error) => void;
    }
  ): string {
    const subscriberId = `sub-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const subscriber: LogSubscriber = {
      id: subscriberId,
      config,
      onLog: callbacks.onLog,
      onComplete: callbacks.onComplete,
      onError: callbacks.onError,
    };

    this.subscribers.set(subscriberId, subscriber);
    return subscriberId;
  }

  /**
   * 取消订阅
   */
  unsubscribe(subscriberId: string): boolean {
    return this.subscribers.delete(subscriberId);
  }

  /**
   * 通知订阅者
   */
  private notifySubscribers(log: BuildLog, entry: LogEntry): void {
    for (const subscriber of this.subscribers.values()) {
      if (this.matchSubscriber(subscriber, log)) {
        try {
          subscriber.onLog(entry);
        } catch (error) {
          logger.error(`[BuildLogService] Error notifying subscriber ${subscriber.id}:`, error);
          subscriber.onError?.(error as Error);
        }
      }
    }
  }

  /**
   * 检查订阅者是否匹配日志
   */
  private matchSubscriber(subscriber: LogSubscriber, log: BuildLog): boolean {
    const config = subscriber.config;

    if (config.runId && log.runId !== config.runId) return false;
    if (config.stageId && log.stageId !== config.stageId) return false;
    if (config.taskId && log.taskId !== config.taskId) return false;
    if (config.podId && log.podId !== config.podId) return false;
    if (config.containerName && log.containerName !== config.containerName) {
      return false;
    }

    return true;
  }

  /**
   * 获取日志文本（格式化输出）
   */
  getLogText(log: BuildLog): string {
    return log.entries
      .map(entry => {
        const source = entry.source ? ` [${entry.source}]` : '';
        return `[${entry.timestamp}] [${entry.level}]${source} ${entry.message}`;
      })
      .join('\n');
  }

  /**
   * 清理已完成的旧日志
   *
   * @param olderThanMs 多久之前的日志（毫秒）
   * @returns 清理数量
   */
  async cleanupCompletedLogs(olderThanMs: number = 86400000): Promise<number> {
    const now = Date.now();
    let count = 0;

    for (const [id, log] of this.logs.entries()) {
      if (log.isComplete && log.updatedAt) {
        const age = now - log.updatedAt.getTime();
        if (age >= olderThanMs) {
          this.logs.delete(id);
          count++;
        }
      }
    }

    return count;
  }

  /**
   * 获取活跃订阅者数量
   */
  getSubscriberCount(): number {
    return this.subscribers.size;
  }
}

export const buildLogService = new BuildLogService();
