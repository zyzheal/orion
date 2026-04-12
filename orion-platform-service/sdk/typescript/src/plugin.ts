/**
 * Orion Plugin SDK for TypeScript
 *
 * 用于开发 Custom Task 类型插件的 SDK
 * 提供任务执行、日志输出、配置读取等基础能力
 */

import { EventEmitter } from 'events';

/**
 * 插件元数据
 */
export interface PluginMetadata {
  name: string;
  version: string;
  description: string;
  author: string;
  tags: string[];
  configSchema: ConfigSchema;
}

/**
 * 配置 Schema
 */
export interface ConfigSchema {
  [key: string]: ConfigField;
}

export interface ConfigField {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required?: boolean;
  default?: any;
  enum?: string[];
}

/**
 * 任务执行上下文
 */
export interface TaskContext {
  taskId: string;
  pipelineRunId: string;
  stageId: string;
  config: Record<string, string>;
  workspace: Workspace;
  env: Record<string, string>;
}

/**
 * 工作区
 */
export interface Workspace {
  rootPath: string;
  files: Record<string, string>;
}

/**
 * 日志级别
 */
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

/**
 * 任务状态
 */
export enum TaskStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  TIMEOUT = 'TIMEOUT',
  CANCELLED = 'CANCELLED',
}

/**
 * 任务执行结果
 */
export interface TaskResult {
  taskId: string;
  status: TaskStatus;
  exitCode: number;
  stdout?: string;
  stderr?: string;
  durationMs: number;
  outputs?: Record<string, string>;
  errorMessage?: string;
}

/**
 * Task Plugin 基类
 *
 * 所有 Custom Task 插件都应继承此类
 */
export abstract class TaskPlugin extends EventEmitter {
  protected context?: TaskContext;
  protected startTime?: number;

  /**
   * 获取插件元数据
   * 子类必须实现
   */
  abstract getMetadata(): PluginMetadata;

  /**
   * 执行任务
   * 子类必须实现
   */
  abstract execute(ctx: TaskContext): Promise<TaskResult>;

  /**
   * 初始化任务上下文
   */
  protected initContext(ctx: TaskContext): void {
    this.context = ctx;
    this.startTime = Date.now();
  }

  /**
   * 输出日志
   */
  protected log(level: LogLevel, message: string): void {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      taskId: this.context?.taskId,
    };

    // 输出到 stdout/stderr
    const output = JSON.stringify(logEntry);
    if (level === LogLevel.ERROR) {
      console.error(output);
    } else {
      console.log(output);
    }

    // 触发事件
    this.emit('log', logEntry);
  }

  /**
   * 输出 DEBUG 日志
   */
  protected debug(message: string): void {
    this.log(LogLevel.DEBUG, message);
  }

  /**
   * 输出 INFO 日志
   */
  protected info(message: string): void {
    this.log(LogLevel.INFO, message);
  }

  /**
   * 输出 WARN 日志
   */
  protected warn(message: string): void {
    this.log(LogLevel.WARN, message);
  }

  /**
   * 输出 ERROR 日志
   */
  protected error(message: string): void {
    this.log(LogLevel.ERROR, message);
  }

  /**
   * 读取配置项
   */
  protected getConfig(key: string, defaultValue?: any): any {
    const value = this.context?.config[key];
    if (value === undefined && defaultValue !== undefined) {
      return defaultValue;
    }
    return value;
  }

  /**
   * 读取环境变量
   */
  protected getEnv(key: string, defaultValue?: string): string {
    const value = this.context?.env[key];
    if (value === undefined && defaultValue !== undefined) {
      return defaultValue;
    }
    return value || '';
  }

  /**
   * 获取工作区根路径
   */
  protected getWorkspaceRoot(): string {
    return this.context?.workspace?.rootPath || '/tmp/workspace';
  }

  /**
   * 读取工作区文件
   */
  protected readWorkspaceFile(relativePath: string): string | undefined {
    return this.context?.workspace?.files[relativePath];
  }

  /**
   * 创建成功结果
   */
  protected createSuccessResult(outputs?: Record<string, string>): TaskResult {
    return {
      taskId: this.context?.taskId || '',
      status: TaskStatus.SUCCESS,
      exitCode: 0,
      durationMs: Date.now() - (this.startTime || Date.now()),
      outputs,
    };
  }

  /**
   * 创建失败结果
   */
  protected createFailedResult(errorMessage: string): TaskResult {
    return {
      taskId: this.context?.taskId || '',
      status: TaskStatus.FAILED,
      exitCode: 1,
      durationMs: Date.now() - (this.startTime || Date.now()),
      errorMessage,
    };
  }
}

/**
 * 插件注册函数
 */
export function registerPlugin(plugin: TaskPlugin): void {
  console.log(`Registering plugin: ${plugin.getMetadata().name} v${plugin.getMetadata().version}`);
}
