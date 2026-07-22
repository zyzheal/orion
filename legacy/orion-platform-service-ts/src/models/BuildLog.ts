/**
 * Build Log 数据模型
 *
 * 构建日志，支持实时 streaming 和持久化
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * 日志级别
 */
export enum LogLevel {
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  DEBUG = 'DEBUG',
}

/**
 * 单条日志记录
 */
export interface LogEntry {
  timestamp: string;    // ISO 8601 时间戳
  level: LogLevel;      // 日志级别
  message: string;      // 日志内容
  source?: string;      // 来源（容器名）
  stream?: 'stdout' | 'stderr';  // 输出流
}

/**
 * 构建日志集合
 */
export interface BuildLog {
  id: string;
  runId?: string;           // 关联的 PipelineRun ID
  stageId?: string;         // 关联的 Stage ID
  taskId?: string;          // 关联的 Task ID
  podId?: string;           // 关联的 Pod ID
  podName?: string;         // Pod 名称
  containerName?: string;   // 容器名称
  entries: LogEntry[];      // 日志条目
  isComplete: boolean;      // 是否已完成（不再有新日志）
  totalLines: number;       // 总行数
  createdAt: Date;
  updatedAt?: Date;
}

/**
 * 日志流配置（用于 WebSocket/SSE）
 */
export interface LogStreamConfig {
  runId?: string;
  stageId?: string;
  taskId?: string;
  podId?: string;
  containerName?: string;
  follow?: boolean;         // 是否持续跟踪
  since?: string;           // 起始时间（ISO 8601）
  tailLines?: number;       // 返回最后 N 行
}

/**
 * 日志查询选项
 */
export interface BuildLogQueryOptions {
  runId?: string;
  stageId?: string;
  taskId?: string;
  podId?: string;
  containerName?: string;
  since?: string;
  until?: string;
  level?: LogLevel;
  limit?: number;
  offset?: number;
}

/**
 * 创建构建日志
 */
export function createBuildLog(options?: {
  runId?: string;
  stageId?: string;
  taskId?: string;
  podId?: string;
  podName?: string;
  containerName?: string;
}): BuildLog {
  const now = new Date();
  return {
    id: uuidv4(),
    runId: options?.runId,
    stageId: options?.stageId,
    taskId: options?.taskId,
    podId: options?.podId,
    podName: options?.podName,
    containerName: options?.containerName,
    entries: [],
    isComplete: false,
    totalLines: 0,
    createdAt: now,
  };
}

/**
 * 追加日志条目
 */
export function appendLogEntry(
  log: BuildLog,
  message: string,
  options?: {
    level?: LogLevel;
    source?: string;
    stream?: 'stdout' | 'stderr';
  }
): BuildLog {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level: options?.level || LogLevel.INFO,
    message,
    source: options?.source,
    stream: options?.stream || 'stdout',
  };

  return {
    ...log,
    entries: [...log.entries, entry],
    totalLines: log.totalLines + 1,
    updatedAt: new Date(),
  };
}

/**
 * 批量追加日志条目
 */
export function appendLogEntries(
  log: BuildLog,
  newEntries: LogEntry[]
): BuildLog {
  return {
    ...log,
    entries: [...log.entries, ...newEntries],
    totalLines: log.totalLines + newEntries.length,
    updatedAt: new Date(),
  };
}

/**
 * 标记日志完成
 */
export function completeBuildLog(log: BuildLog): BuildLog {
  return {
    ...log,
    isComplete: true,
    updatedAt: new Date(),
  };
}

/**
 * 创建日志条目（辅助函数）
 */
export function createLogEntry(
  message: string,
  options?: {
    level?: LogLevel;
    source?: string;
    stream?: 'stdout' | 'stderr';
  }
): LogEntry {
  return {
    timestamp: new Date().toISOString(),
    level: options?.level || LogLevel.INFO,
    message,
    source: options?.source,
    stream: options?.stream || 'stdout',
  };
}

/**
 * 解析原始日志行
 */
export function parseLogLine(line: string, source?: string): LogEntry {
  // 尝试解析格式: [TIMESTAMP] [LEVEL] [SOURCE] message
  const match = line.match(
    /^\[([^\]]+)\]\s*\[([^\]]+)\]\s*(?:\[([^\]]+)\]\s*)?(.*)$/
  );

  if (match) {
    return {
      timestamp: match[1] || new Date().toISOString(),
      level: (match[2] as LogLevel) || LogLevel.INFO,
      message: match[4] || line,
      source: match[3] || source,
      stream: 'stdout',
    };
  }

  // 无法解析，作为普通 INFO 日志
  return createLogEntry(line, { source });
}
