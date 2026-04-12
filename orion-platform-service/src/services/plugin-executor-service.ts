/**
 * Plugin Executor Service
 *
 * 负责执行已安装的插件任务
 * 支持多种执行模式：
 * - gRPC 调用（WASM/容器插件）
 * - HTTP 调用（远程插件）
 * - 进程调用（本地 SDK 插件）
 */

import pino from 'pino';
import { EventBusService } from './event-bus-service';
import { PluginManagerService } from './plugin-manager-service';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

/**
 * 任务执行请求
 */
export interface TaskExecutionRequest {
  taskId: string;
  pipelineRunId: string;
  stageId: string;
  pluginId: string;
  config: Record<string, any>;
  workspace: Workspace;
  env?: Record<string, string>;
  timeout?: number;
}

/**
 * 工作区
 */
export interface Workspace {
  rootPath: string;
  files?: Record<string, string>;
}

/**
 * 任务执行结果
 */
export interface TaskExecutionResult {
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
 * 插件执行器
 */
export class PluginExecutorService {
  private pluginManager: PluginManagerService;
  private eventBus?: EventBusService;
  private executions: Map<string, TaskExecutionResult> = new Map();

  constructor(options: {
    pluginManager: PluginManagerService;
    eventBus?: EventBusService;
  }) {
    this.pluginManager = options.pluginManager;
    this.eventBus = options.eventBus;
  }

  /**
   * 执行插件任务
   */
  async executeTask(request: TaskExecutionRequest): Promise<TaskExecutionResult> {
    logger.info({ taskId: request.taskId, pluginId: request.pluginId }, 'Executing plugin task');

    // 检查插件是否已安装并激活
    const plugin = await this.pluginManager.getPluginDetails(request.pluginId);
    if (!plugin || plugin.state !== 'ACTIVE') {
      throw new Error(`Plugin ${request.pluginId} is not active`);
    }

    // 根据插件类型选择执行方式
    const result = await this.executeByType(request, plugin);

    // 保存结果
    this.executions.set(request.taskId, result);

    // 发布事件
    await this.publishEvent('plugin.task.completed', {
      taskId: request.taskId,
      pluginId: request.pluginId,
      status: result.status,
      durationMs: result.durationMs,
    });

    return result;
  }

  /**
   * 获取任务执行结果
   */
  getExecutionResult(taskId: string): TaskExecutionResult | undefined {
    return this.executions.get(taskId);
  }

  /**
   * 根据插件类型执行
   */
  private async executeByType(
    request: TaskExecutionRequest,
    plugin: any
  ): Promise<TaskExecutionResult> {
    const startTime = Date.now();

    try {
      // 更新状态为运行中
      await this.publishEvent('plugin.task.started', {
        taskId: request.taskId,
        pluginId: request.pluginId,
        startedAt: new Date(),
      });

      // 根据安全等级/类型选择执行方式
      switch (plugin.securityLevel) {
        case 'HIGH':
          // WASM 插件 - 通过 gRPC 调用
          return await this.executeWASMPlugin(request, startTime);

        case 'MEDIUM':
          // 容器插件 - 通过 gRPC/HTTP 调用
          return await this.executeContainerPlugin(request, startTime);

        case 'LOW':
          // 进程插件 - 通过 SDK 直接调用
          return await this.executeProcessPlugin(request, startTime);

        default:
          // 默认使用进程模式
          return await this.executeProcessPlugin(request, startTime);
      }
    } catch (err) {
      logger.error({ err }, 'Plugin execution failed');
      return {
        taskId: request.taskId,
        status: TaskStatus.FAILED,
        exitCode: 1,
        durationMs: Date.now() - startTime,
        errorMessage: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  /**
   * 执行 WASM 插件
   */
  private async executeWASMPlugin(
    request: TaskExecutionRequest,
    startTime: number
  ): Promise<TaskExecutionResult> {
    logger.info({ taskId: request.taskId }, 'Executing WASM plugin via gRPC');

    // 模拟 gRPC 调用
    // 实际实现中需要通过 @grpc/grpc-js 调用 WASM 运行时

    return this.simulateExecution(request, startTime, 'WASM');
  }

  /**
   * 执行容器插件
   */
  private async executeContainerPlugin(
    request: TaskExecutionRequest,
    startTime: number
  ): Promise<TaskExecutionResult> {
    logger.info({ taskId: request.taskId }, 'Executing container plugin via HTTP/gRPC');

    // 模拟容器调用
    // 实际实现中需要通过 Docker API 或 Kubernetes API 调用容器

    return this.simulateExecution(request, startTime, 'Container');
  }

  /**
   * 执行进程插件
   */
  private async executeProcessPlugin(
    request: TaskExecutionRequest,
    startTime: number
  ): Promise<TaskExecutionResult> {
    logger.info({ taskId: request.taskId }, 'Executing process plugin via SDK');

    // 模拟进程调用
    // 实际实现中需要通过 child_process 或 worker_threads 执行

    return this.simulateExecution(request, startTime, 'Process');
  }

  /**
   * 模拟执行（用于测试）
   */
  private async simulateExecution(
    request: TaskExecutionRequest,
    startTime: number,
    runtimeType: string
  ): Promise<TaskExecutionResult> {
    logger.info(
      { taskId: request.taskId, runtimeType },
      `Simulating ${runtimeType} execution`
    );

    // 模拟执行延迟
    await new Promise((resolve) => setTimeout(resolve, 100));

    return {
      taskId: request.taskId,
      status: TaskStatus.SUCCESS,
      exitCode: 0,
      stdout: `${runtimeType} plugin executed successfully`,
      durationMs: Date.now() - startTime,
      outputs: {
        pluginId: request.pluginId,
        runtimeType,
      },
    };
  }

  /**
   * 发布事件
   */
  private async publishEvent(type: string, data: any): Promise<void> {
    if (this.eventBus) {
      try {
        await this.eventBus.publish(type, data, { source: 'plugin-executor' });
      } catch (err) {
        logger.error({ err }, 'Failed to publish event');
      }
    }
  }
}
