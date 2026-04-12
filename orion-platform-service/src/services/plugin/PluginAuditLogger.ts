/**
 * Plugin Audit Logger
 *
 * 负责记录插件执行的审计日志：
 * - 执行日志记录
 * - 输入输出快照
 * - 异常事件记录
 * - 安全事件告警
 */

import pino from 'pino';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
  AuditLogEntry,
  AuditLogLevel,
  SecurityEvent,
  SecurityEventType,
  DLPDetectionResult,
  DLPPattern,
  ExecutionContext,
  ResourceUsage,
} from './types';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

/**
 * 审计日志存储配置
 */
interface AuditLoggerConfig {
  maxEntries: number;
  retentionMs: number;
  enableDLPSanitization: boolean;
  enableSecurityAlerts: boolean;
}

/**
 * DLP 正则模式
 */
const DLP_PATTERNS: Record<string, { pattern: RegExp; type: DLPPattern['type'] }> = {
  CREDIT_CARD: {
    pattern: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
    type: 'CREDIT_CARD',
  },
  SSN: {
    pattern: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
    type: 'SSN',
  },
  API_KEY: {
    pattern: /\b[a-zA-Z0-9]{32,}\b/g,
    type: 'API_KEY',
  },
  PASSWORD: {
    pattern: /(?:"password"\s*:\s*")[^"]+|('password'\s*:\s*')[^']+/gi,
    type: 'PASSWORD',
  },
  EMAIL: {
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    type: 'EMAIL',
  },
  PHONE: {
    pattern: /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    type: 'PHONE',
  },
  IP_ADDRESS: {
    pattern: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
    type: 'IP_ADDRESS',
  },
};

/**
 * Plugin Audit Logger
 */
export class PluginAuditLogger extends EventEmitter {
  private logs: Map<string, AuditLogEntry> = new Map();
  private securityEvents: Map<string, SecurityEvent> = new Map();
  private config: AuditLoggerConfig;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(config?: Partial<AuditLoggerConfig>) {
    super();
    this.config = {
      maxEntries: config?.maxEntries || 10000,
      retentionMs: config?.retentionMs || 7 * 24 * 60 * 60 * 1000, // 7 天
      enableDLPSanitization: config?.enableDLPSanitization ?? true,
      enableSecurityAlerts: config?.enableSecurityAlerts ?? true,
    };

    // 启动定期清理
    this.startCleanupInterval();
  }

  /**
   * 记录执行开始
   */
  logExecutionStart(context: ExecutionContext, input?: any): string {
    const entryId = uuidv4();
    const sanitizedInput = this.config.enableDLPSanitization
      ? this.sanitizeInput(input)
      : input;

    const entry: AuditLogEntry = {
      id: entryId,
      timestamp: new Date(),
      level: 'INFO',
      taskId: context.taskId,
      pluginId: context.pluginId,
      action: 'EXECUTION_START',
      message: `Plugin execution started for task ${context.taskId}`,
      input: sanitizedInput,
      metadata: {
        pipelineRunId: context.pipelineRunId,
        stageId: context.stageId,
        userId: context.userId,
        tenantId: context.tenantId,
        quota: context.quota,
      },
    };

    this.addLog(entry);

    logger.info(
      {
        taskId: context.taskId,
        pluginId: context.pluginId,
        entryId,
      },
      'Execution start logged'
    );

    return entryId;
  }

  /**
   * 记录执行完成
   */
  logExecutionComplete(
    context: ExecutionContext,
    output?: any,
    durationMs?: number
  ): string {
    const entryId = uuidv4();
    const sanitizedOutput = this.config.enableDLPSanitization
      ? this.sanitizeOutput(output)
      : output;

    const entry: AuditLogEntry = {
      id: entryId,
      timestamp: new Date(),
      level: 'INFO',
      taskId: context.taskId,
      pluginId: context.pluginId,
      action: 'EXECUTION_COMPLETE',
      message: `Plugin execution completed for task ${context.taskId}`,
      output: sanitizedOutput,
      durationMs,
      metadata: {
        pipelineRunId: context.pipelineRunId,
        stageId: context.stageId,
      },
    };

    this.addLog(entry);

    logger.info(
      {
        taskId: context.taskId,
        pluginId: context.pluginId,
        durationMs,
      },
      'Execution complete logged'
    );

    return entryId;
  }

  /**
   * 记录执行失败
   */
  logExecutionError(
    context: ExecutionContext,
    error: Error,
    durationMs?: number
  ): string {
    const entryId = uuidv4();

    const entry: AuditLogEntry = {
      id: entryId,
      timestamp: new Date(),
      level: 'ERROR',
      taskId: context.taskId,
      pluginId: context.pluginId,
      action: 'EXECUTION_ERROR',
      message: `Plugin execution failed: ${error.message}`,
      durationMs,
      metadata: {
        pipelineRunId: context.pipelineRunId,
        stageId: context.stageId,
        errorName: error.name,
        errorStack: error.stack,
      },
    };

    this.addLog(entry);

    logger.error(
      {
        taskId: context.taskId,
        pluginId: context.pluginId,
        error: error.message,
        durationMs,
      },
      'Execution error logged'
    );

    return entryId;
  }

  /**
   * 记录安全事件
   */
  logSecurityEvent(event: Omit<SecurityEvent, 'timestamp'>): string {
    const eventId = uuidv4();
    const fullEvent: SecurityEvent = {
      ...event,
      timestamp: new Date(),
    };

    this.securityEvents.set(eventId, fullEvent);

    // 根据严重程度设置日志级别
    const logLevel = event.severity === 'CRITICAL' ? 'error' :
                     event.severity === 'HIGH' ? 'warn' : 'info';

    logger[logLevel](
      {
        eventId,
        type: event.type,
        severity: event.severity,
        taskId: event.taskId,
        pluginId: event.pluginId,
      },
      `Security event: ${event.message}`
    );

    // 触发告警
    if (this.config.enableSecurityAlerts &&
        (event.severity === 'CRITICAL' || event.severity === 'HIGH')) {
      this.emit('security:alert', fullEvent);
    }

    this.emit('security:event', fullEvent);

    return eventId;
  }

  /**
   * 记录资源使用快照
   */
  logResourceUsage(
    context: ExecutionContext,
    usage: ResourceUsage
  ): string {
    const entryId = uuidv4();

    const entry: AuditLogEntry = {
      id: entryId,
      timestamp: new Date(),
      level: 'DEBUG',
      taskId: context.taskId,
      pluginId: context.pluginId,
      action: 'RESOURCE_USAGE',
      message: 'Resource usage snapshot',
      metadata: {
        cpuPercent: usage.cpuPercent,
        memoryBytes: usage.memoryBytes,
        diskBytes: usage.diskBytes,
        networkRxBytes: usage.networkRxBytes,
        networkTxBytes: usage.networkTxBytes,
      },
    };

    this.addLog(entry);

    return entryId;
  }

  /**
   * 检测敏感数据 (DLP)
   */
  detectSensitiveData(data: string): DLPDetectionResult {
    const patterns: DLPPattern[] = [];

    for (const [name, { pattern, type }] of Object.entries(DLP_PATTERNS)) {
      const regex = new RegExp(pattern.source, pattern.flags);
      let match: RegExpExecArray | null;

      while ((match = regex.exec(data)) !== null) {
        patterns.push({
          type,
          matchedText: this.maskSensitiveText(match[0], type),
          position: { start: match.index, end: match.index + match[0].length },
          confidence: this.getConfidence(type, match[0]),
        });
      }
    }

    return {
      hasSensitiveData: patterns.length > 0,
      patterns,
      redactedData: patterns.length > 0 ? this.redactData(data, patterns) : data,
    };
  }

  /**
   * 获取审计日志
   */
  getLogs(options?: {
    taskId?: string;
    pluginId?: string;
    level?: AuditLogLevel;
    action?: string;
    limit?: number;
  }): AuditLogEntry[] {
    let entries = Array.from(this.logs.values());

    if (options?.taskId) {
      entries = entries.filter((e) => e.taskId === options.taskId);
    }

    if (options?.pluginId) {
      entries = entries.filter((e) => e.pluginId === options.pluginId);
    }

    if (options?.level) {
      entries = entries.filter((e) => e.level === options.level);
    }

    if (options?.action) {
      entries = entries.filter((e) => e.action === options.action);
    }

    // 按时间戳降序排序
    entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (options?.limit) {
      entries = entries.slice(0, options.limit);
    }

    return entries;
  }

  /**
   * 获取安全事件
   */
  getSecurityEvents(options?: {
    taskId?: string;
    pluginId?: string;
    type?: SecurityEventType;
    severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    limit?: number;
  }): SecurityEvent[] {
    let events = Array.from(this.securityEvents.values());

    if (options?.taskId) {
      events = events.filter((e) => e.taskId === options.taskId);
    }

    if (options?.pluginId) {
      events = events.filter((e) => e.pluginId === options.pluginId);
    }

    if (options?.type) {
      events = events.filter((e) => e.type === options.type);
    }

    if (options?.severity) {
      events = events.filter((e) => e.severity === options.severity);
    }

    // 按时间戳降序排序
    events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (options?.limit) {
      events = events.slice(0, options.limit);
    }

    return events;
  }

  /**
   * 清理过期日志
   */
  cleanupExpiredLogs(): number {
    const now = Date.now();
    const expiredThreshold = now - this.config.retentionMs;
    let removedCount = 0;

    // 清理审计日志
    for (const [id, entry] of this.logs.entries()) {
      if (entry.timestamp.getTime() < expiredThreshold) {
        this.logs.delete(id);
        removedCount++;
      }
    }

    // 清理安全事件
    for (const [id, event] of this.securityEvents.entries()) {
      if (event.timestamp.getTime() < expiredThreshold) {
        this.securityEvents.delete(id);
      }
    }

    // 如果超过最大条目数，删除最旧的
    if (this.logs.size > this.config.maxEntries) {
      const entries = Array.from(this.logs.values()).sort(
        (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
      );

      const toRemove = entries.slice(0, this.logs.size - this.config.maxEntries);
      for (const entry of toRemove) {
        this.logs.delete(entry.id);
        removedCount++;
      }
    }

    logger.info({ removedCount }, 'Expired logs cleaned up');
    return removedCount;
  }

  /**
   * 关闭审计日志器
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    logger.info('Audit logger shutdown');
  }

  /**
   * 添加日志条目
   */
  private addLog(entry: AuditLogEntry): void {
    this.logs.set(entry.id, entry);
    this.emit('log:created', entry);
  }

  /**
   * 清理输入数据
   */
  private sanitizeInput(input: any): any {
    if (!input) return input;

    if (typeof input === 'string') {
      const result = this.detectSensitiveData(input);
      return result.redactedData;
    }

    if (typeof input === 'object') {
      try {
        const str = JSON.stringify(input);
        const result = this.detectSensitiveData(str);
        return JSON.parse(result.redactedData || str);
      } catch {
        return input;
      }
    }

    return input;
  }

  /**
   * 清理输出数据
   */
  private sanitizeOutput(output: any): any {
    return this.sanitizeInput(output);
  }

  /**
   * 遮蔽敏感文本
   */
  private maskSensitiveText(text: string, type: DLPPattern['type']): string {
    switch (type) {
      case 'CREDIT_CARD':
        return text.slice(0, 4) + '-****-****-' + text.slice(-4);
      case 'SSN':
        return '***-**-' + text.slice(-4);
      case 'API_KEY':
        return text.slice(0, 8) + '***' + text.slice(-4);
      case 'PASSWORD':
        return '"password": "***REDACTED***"';
      case 'EMAIL':
        const [local, domain] = text.split('@');
        return local.slice(0, 2) + '***@' + domain;
      case 'PHONE':
        return '***-***-' + text.slice(-4);
      case 'IP_ADDRESS':
        return '***.***.***.***';
      default:
        return '***REDACTED***';
    }
  }

  /**
   * 获取检测置信度
   */
  private getConfidence(type: DLPPattern['type'], matchedText: string): number {
    // 根据类型和匹配文本特征计算置信度
    switch (type) {
      case 'CREDIT_CARD':
        // 验证 Luhn 算法
        return this.luhnCheck(matchedText) ? 0.95 : 0.7;
      case 'EMAIL':
        return matchedText.includes('@') && matchedText.includes('.') ? 0.95 : 0.6;
      case 'IP_ADDRESS':
        const parts = matchedText.split('.');
        return parts.length === 4 ? 0.8 : 0.5;
      default:
        return 0.8;
    }
  }

  /**
   * Luhn 算法验证信用卡号
   */
  private luhnCheck(num: string): boolean {
    const digits = num.replace(/\D/g, '');
    let sum = 0;
    let isEven = false;

    for (let i = digits.length - 1; i >= 0; i--) {
      let digit = parseInt(digits[i], 10);

      if (isEven) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }

      sum += digit;
      isEven = !isEven;
    }

    return sum % 10 === 0;
  }

  /**
   * 遮蔽数据
   */
  private redactData(data: string, patterns: DLPPattern[]): string {
    let redacted = data;

    // 按位置降序排序，避免位置偏移
    const sortedPatterns = [...patterns].sort(
      (a, b) => b.position.start - a.position.start
    );

    for (const pattern of sortedPatterns) {
      redacted =
        redacted.slice(0, pattern.position.start) +
        pattern.matchedText +
        redacted.slice(pattern.position.end);
    }

    return redacted;
  }

  /**
   * 启动定期清理
   */
  private startCleanupInterval(): void {
    // 每小时清理一次
    this.cleanupInterval = setInterval(
      () => {
        this.cleanupExpiredLogs();
      },
      60 * 60 * 1000
    );
  }
}