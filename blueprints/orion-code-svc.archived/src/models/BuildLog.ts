/**
 * Build Log Models - 构建日志数据模型
 */

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal',
}

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  source?: string;
  stream?: 'stdout' | 'stderr';
}

export interface BuildLog {
  id: string;
  runId?: string;
  stageId?: string;
  taskId?: string;
  podId?: string;
  podName?: string;
  containerName?: string;
  entries: LogEntry[];
  isComplete: boolean;
  totalLines: number;
  createdAt: Date;
  updatedAt?: Date;
}

export interface LogStreamConfig {
  runId?: string;
  stageId?: string;
  taskId?: string;
  podId?: string;
  containerName?: string;
  follow?: boolean;
}

export interface BuildLogQueryOptions {
  runId?: string;
  stageId?: string;
  taskId?: string;
  podId?: string;
  containerName?: string;
  level?: LogLevel;
  since?: string;
  until?: string;
  limit?: number;
  offset?: number;
}

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
    id: `build-log-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
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

export function appendLogEntry(log: BuildLog, message: string, options?: {
  level?: LogLevel;
  source?: string;
  stream?: 'stdout' | 'stderr';
}): BuildLog {
  const entry: LogEntry = {
    timestamp: new Date(),
    level: options?.level || LogLevel.INFO,
    message,
    source: options?.source,
    stream: options?.stream,
  };
  return {
    ...log,
    entries: [...log.entries, entry],
    totalLines: log.totalLines + 1,
    updatedAt: new Date(),
  };
}

export function appendLogEntries(log: BuildLog, entries: LogEntry[]): BuildLog {
  return {
    ...log,
    entries: [...log.entries, ...entries],
    totalLines: log.totalLines + entries.length,
    updatedAt: new Date(),
  };
}

export function completeBuildLog(log: BuildLog): BuildLog {
  return {
    ...log,
    isComplete: true,
    updatedAt: new Date(),
  };
}

export function createLogEntry(message: string, options?: {
  level?: LogLevel;
  source?: string;
}): LogEntry {
  return {
    timestamp: new Date(),
    level: options?.level || LogLevel.INFO,
    message,
    source: options?.source,
  };
}

export function parseLogLine(line: string, source?: string): LogEntry {
  // Try to parse common log formats
  const match = line.match(/^\[([^\]]+)\]\s*\[([^\]]+)\]\s*(.*)$/);
  if (match) {
    return {
      timestamp: new Date(match[1]),
      level: (match[2].toLowerCase() as LogLevel) || LogLevel.INFO,
      message: match[3],
      source,
    };
  }
  return {
    timestamp: new Date(),
    level: LogLevel.INFO,
    message: line,
    source,
  };
}
