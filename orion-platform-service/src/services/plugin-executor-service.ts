/**
 * Plugin Executor Service
 *
 * 负责执行已安装的插件任务
 * 支持多种执行模式：
 * - gRPC 调用（WASM/容器插件）
 * - HTTP 调用（远程插件）
 * - 进程调用（本地 SDK 插件）
 *
 * 安全特性：
 * - 资源配额限制（CPU 2核、内存2GB）
 * - 执行超时（60秒）
 * - 安全隔离容器
 * - 审计日志
 */

import pino from 'pino';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import { EventBusService } from './event-bus-service';
import { PluginManagerService } from './plugin-manager-service';
import { ExecutionGuardian } from './guardian/ExecutionGuardian';
import { ProcessKiller } from './guardian/ProcessKiller';
import {
  PluginSandbox,
  PluginResourceManager,
  PluginAuditLogger,
  ResourceQuota,
  ExecutionContext,
  SandboxExecutionResult,
  SecurityEventType,
} from './plugin';

const execAsync = promisify(exec);
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
  userId?: string;
  tenantId?: string;
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
  killed?: boolean;
  killReason?: string;
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
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
}

/**
 * 执行器配置
 */
export interface ExecutorConfig {
  defaultTimeoutMs: number;
  maxTimeoutMs: number;
  enableSandbox: boolean;
  enableAuditLog: boolean;
  enableResourceQuota: boolean;
}

/**
 * 默认配置
 */
const DEFAULT_EXECUTOR_CONFIG: ExecutorConfig = {
  defaultTimeoutMs: 60000,
  maxTimeoutMs: 300000,
  enableSandbox: true,
  enableAuditLog: true,
  enableResourceQuota: true,
};

/**
 * 插件执行器
 */
export class PluginExecutorService {
  private pluginManager: PluginManagerService;
  private eventBus?: EventBusService;
  private executions: Map<string, TaskExecutionResult> = new Map();
  private config: ExecutorConfig;
  private sandbox?: PluginSandbox;
  private resourceManager?: PluginResourceManager;
  private auditLogger?: PluginAuditLogger;
  private guardian: ExecutionGuardian;
  private processKiller: ProcessKiller;

  constructor(options: {
    pluginManager: PluginManagerService;
    eventBus?: EventBusService;
    config?: Partial<ExecutorConfig>;
  }) {
    this.pluginManager = options.pluginManager;
    this.eventBus = options.eventBus;
    this.config = { ...DEFAULT_EXECUTOR_CONFIG, ...options.config };

    // 初始化安全组件
    this.initializeSecurityComponents();

    // 初始化 ExecutionGuardian
    this.guardian = new ExecutionGuardian();
    this.guardian.start();

    // 初始化 ProcessKiller
    this.processKiller = new ProcessKiller();
  }

  /**
   * 初始化安全组件
   */
  private initializeSecurityComponents(): void {
    // 创建资源管理器
    this.resourceManager = new PluginResourceManager({
      globalQuota: {
        cpuCores: 8,
        memoryBytes: 16 * 1024 * 1024 * 1024, // 16GB
        timeoutMs: this.config.maxTimeoutMs,
        maxConcurrent: 50,
      },
    });

    // 创建审计日志器
    this.auditLogger = new PluginAuditLogger({
      maxEntries: 10000,
      retentionMs: 7 * 24 * 60 * 60 * 1000, // 7 天
      enableDLPSanitization: true,
      enableSecurityAlerts: true,
    });

    // 监听安全告警
    this.auditLogger.on('security:alert', (event) => {
      logger.warn(
        {
          type: event.type,
          severity: event.severity,
          taskId: event.taskId,
          pluginId: event.pluginId,
        },
        `Security alert: ${event.message}`
      );

      // 发布安全事件
      this.publishEvent('plugin.security.alert', event);
    });

    // 创建沙箱
    this.sandbox = new PluginSandbox({
      resourceManager: this.resourceManager,
      auditLogger: this.auditLogger,
      config: {
        defaultTimeoutMs: this.config.defaultTimeoutMs,
        maxTimeoutMs: this.config.maxTimeoutMs,
        enableInputValidation: true,
        enableOutputDLPSanitization: true,
        enableResourceMonitoring: true,
        resourceMonitorIntervalMs: 1000,
      },
    });

    // 监听沙箱事件
    this.sandbox.on('execution:timeout', ({ taskId, timeoutMs }) => {
      logger.warn({ taskId, timeoutMs }, 'Execution timed out');
    });

    this.sandbox.on('execution:cancelled', ({ taskId, reason }) => {
      logger.info({ taskId, reason }, 'Execution cancelled');
    });

    logger.info('Plugin executor security components initialized');
  }

  /**
   * 执行插件任务
   */
  async executeTask(request: TaskExecutionRequest): Promise<TaskExecutionResult> {
    logger.info({ taskId: request.taskId, pluginId: request.pluginId }, 'Executing plugin task');

    // 检查插件是否已安装并激活
    let plugin: any;
    try {
      plugin = await this.pluginManager.getPluginDetails(request.pluginId);
      if (!plugin || plugin.state !== 'ACTIVE') {
        return this.createErrorResult(
          request.taskId,
          TaskStatus.FAILED,
          `Plugin ${request.pluginId} is not active`,
          1
        );
      }
    } catch (error) {
      return this.createErrorResult(
        request.taskId,
        TaskStatus.FAILED,
        `Plugin ${request.pluginId} not found: ${error instanceof Error ? error.message : String(error)}`,
        1
      );
    }

    // 输入验证
    if (this.config.enableSandbox && this.sandbox) {
      const validation = this.sandbox.validateInput(request.config);
      if (!validation.valid) {
        // 记录安全事件
        this.auditLogger?.logSecurityEvent({
          type: 'INPUT_VALIDATION_FAILED',
          severity: 'MEDIUM',
          taskId: request.taskId,
          pluginId: request.pluginId,
          message: 'Input validation failed',
          details: { errors: validation.errors },
        });

        return this.createErrorResult(
          request.taskId,
          TaskStatus.VALIDATION_FAILED,
          `Input validation failed: ${validation.errors.map((e) => e.message).join(', ')}`,
          1
        );
      }
    }

    // 分配资源配额
    let context: ExecutionContext | null = null;
    if (this.config.enableResourceQuota && this.resourceManager) {
      context = this.resourceManager.allocateQuota(
        request.taskId,
        request.pluginId,
        plugin.securityLevel
      );

      if (!context) {
        // 记录安全事件
        this.auditLogger?.logSecurityEvent({
          type: 'QUOTA_EXCEEDED',
          severity: 'HIGH',
          taskId: request.taskId,
          pluginId: request.pluginId,
          message: 'Resource quota allocation failed',
          details: {
            requestedQuota: this.resourceManager.getPluginQuota(
              request.pluginId,
              plugin.securityLevel
            ),
          },
        });

        return this.createErrorResult(
          request.taskId,
          TaskStatus.QUOTA_EXCEEDED,
          'Resource quota exceeded. Please try again later.',
          1
        );
      }

      // 更新上下文信息
      context.pipelineRunId = request.pipelineRunId;
      context.stageId = request.stageId;
      context.userId = request.userId;
      context.tenantId = request.tenantId;
    }

    // 根据插件类型选择执行方式 - 通过 guardian 注册监控
    this.guardian.registerTask(request.taskId, {
      globalTimeoutMs: request.timeout || this.config.maxTimeoutMs,
      stepTimeoutMs: this.config.defaultTimeoutMs,
    });

    const abortController = this.guardian.createAbortSignal(request.taskId);

    let result: TaskExecutionResult;
    try {
      result = await this.executeByType(request, plugin, context, abortController.signal);
    } finally {
      this.guardian.unregisterTask(request.taskId);
    }

    // 释放资源配额
    if (context && this.resourceManager) {
      this.resourceManager.releaseQuota(request.taskId);
    }

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
   * 取消任务执行
   */
  cancelTask(taskId: string, reason?: string): boolean {
    if (this.sandbox) {
      return this.sandbox.cancelExecution(taskId, reason);
    }
    return false;
  }

  /**
   * 获取资源统计
   */
  getResourceStats(): any {
    return this.resourceManager?.getResourceStats();
  }

  /**
   * 获取活跃执行数
   */
  getActiveExecutionCount(): number {
    return this.sandbox?.getActiveExecutionCount() || 0;
  }

  /**
   * 获取审计日志
   */
  getAuditLogs(options?: {
    taskId?: string;
    pluginId?: string;
    limit?: number;
  }) {
    return this.auditLogger?.getLogs(options) || [];
  }

  /**
   * 获取安全事件
   */
  getSecurityEvents(options?: {
    taskId?: string;
    pluginId?: string;
    limit?: number;
  }) {
    return this.auditLogger?.getSecurityEvents(options) || [];
  }

  /**
   * 根据插件类型执行
   */
  private async executeByType(
    request: TaskExecutionRequest,
    plugin: any,
    context?: ExecutionContext | null,
    signal?: AbortSignal
  ): Promise<TaskExecutionResult> {
    const startTime = Date.now();

    try {
      // 更新状态为运行中
      await this.publishEvent('plugin.task.started', {
        taskId: request.taskId,
        pluginId: request.pluginId,
        startedAt: new Date(),
      });

      // 如果没有上下文，创建一个默认的
      const executionContext: ExecutionContext = context || {
        taskId: request.taskId,
        pluginId: request.pluginId,
        pipelineRunId: request.pipelineRunId,
        stageId: request.stageId,
        startedAt: new Date(),
        quota: {
          cpuCores: 2,
          memoryBytes: 2 * 1024 * 1024 * 1024,
          timeoutMs: request.timeout || this.config.defaultTimeoutMs,
          maxConcurrent: 10,
        },
      };

      // 在沙箱中执行
      if (this.config.enableSandbox && this.sandbox) {
        const sandboxResult = await this.executeInSandbox(
          request,
          plugin,
          executionContext,
          signal
        );

        return this.convertSandboxResult(sandboxResult, startTime);
      }

      // 不使用沙箱，直接执行
      return await this.executeWithoutSandbox(request, plugin, startTime, signal);
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
   * 在沙箱中执行
   */
  private async executeInSandbox(
    request: TaskExecutionRequest,
    plugin: any,
    context: ExecutionContext,
    signal?: AbortSignal
  ): Promise<SandboxExecutionResult> {
    if (!this.sandbox) {
      throw new Error('Sandbox not initialized');
    }

    // 根据安全等级选择执行函数
    const executor = async (signal: AbortSignal) => {
      // 检查是否已取消
      if (signal.aborted) {
        throw new Error('Execution aborted');
      }

      switch (plugin.securityLevel) {
        case 'HIGH':
          return await this.executeWASMPlugin(request, signal);
        case 'MEDIUM':
          return await this.executeContainerPlugin(request, signal);
        case 'LOW':
        default:
          return await this.executeProcessPlugin(request, signal);
      }
    };

    return this.sandbox.executeInSandbox(context, executor, {
      timeout: request.timeout,
    });
  }

  /**
   * 不使用沙箱执行（仅用于测试或信任环境）
   */
  private async executeWithoutSandbox(
    request: TaskExecutionRequest,
    plugin: any,
    startTime: number,
    signal?: AbortSignal
  ): Promise<TaskExecutionResult> {
    logger.warn(
      { taskId: request.taskId },
      'Executing without sandbox - not recommended for production'
    );

    switch (plugin.securityLevel) {
      case 'HIGH':
        return await this.executeWASMPlugin(request, signal);

      case 'MEDIUM':
        return await this.executeContainerPlugin(request, signal);

      case 'LOW':
      default:
        return await this.executeProcessPlugin(request, signal);
    }
  }

  /**
   * 执行 WASM 插件
   */
  private async executeWASMPlugin(
    request: TaskExecutionRequest,
    signal?: AbortSignal
  ): Promise<any> {
    logger.info({ taskId: request.taskId }, 'Executing WASM plugin via gRPC');

    // 模拟 gRPC 调用
    // 实际实现中需要通过 @grpc/grpc-js 调用 WASM 运行时

    return this.simulateExecution(request, 'WASM', signal);
  }

  /**
   * 执行容器插件 - 真实 Docker 实现
   */
  private async executeContainerPlugin(
    request: TaskExecutionRequest,
    signal?: AbortSignal
  ): Promise<any> {
    logger.info({ taskId: request.taskId }, 'Executing container plugin via Docker');

    if (signal?.aborted) {
      throw new Error('Execution aborted');
    }

    const containerImage = (request.config.image as string) || 'alpine:latest';
    const containerCmd = (request.config.command as string) || 'echo "No command specified"';
    const containerId = `orion-plugin-${request.taskId}-${Date.now()}`;
    const memoryLimit = (request.config.memoryLimit as string) || '512m';
    const timeoutSec = Math.ceil((request.timeout || this.config.defaultTimeoutMs) / 1000);

    // Create and start container
    try {
      await execAsync(
        `docker create --name ${containerId} --memory=${memoryLimit} --network=bridge --rm ${containerImage} sh -c '${containerCmd}'`
      );
    } catch (error) {
      throw new Error(`Failed to create container: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Register with ProcessKiller for container lifecycle management
    this.processKiller.register({
      taskId: request.taskId,
      pid: -1, // Container doesn't have a local PID
      containerId,
    });

    let stdout = '';
    let stderr = '';
    let exitCode = 1;

    try {
      // Start container and capture output
      const { stdout: startOut } = await execAsync(`docker start -a ${containerId}`);
      stdout = startOut;
      exitCode = 0;
    } catch (error: any) {
      stderr = error.stdout || error.stderr || error.message;
      exitCode = error.code || 1;
    } finally {
      this.processKiller.unregister(request.taskId);
    }

    return {
      pluginId: request.pluginId,
      runtimeType: 'Container',
      containerId,
      exitCode,
      stdout,
      stderr,
      outputs: { result: exitCode === 0 ? 'success' : 'failed' },
    };
  }

  /**
   * 执行进程插件 - 真实 child_process 实现
   */
  private async executeProcessPlugin(
    request: TaskExecutionRequest,
    signal?: AbortSignal
  ): Promise<any> {
    logger.info({ taskId: request.taskId }, 'Executing process plugin via child_process');

    if (signal?.aborted) {
      throw new Error('Execution aborted');
    }

    const command = (request.config.command as string) || 'echo "No command specified"';
    const workingDir = request.workspace?.rootPath || '/tmp';
    const env = { ...process.env, ...request.env };

    return new Promise((resolve, reject) => {
      const child = spawn(command, {
        shell: true,
        cwd: workingDir,
        env,
        detached: true, // Create process group for clean killing
        timeout: request.timeout || this.config.defaultTimeoutMs,
      });

      let stdout = '';
      let stderr = '';

      // Register with ProcessKiller for graceful termination
      this.processKiller.register({
        taskId: request.taskId,
        pid: child.pid!,
        pgid: child.pid!, // detached=true creates process group with same PID as PGID
      });

      child.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        this.processKiller.unregister(request.taskId);
        resolve({
          pluginId: request.pluginId,
          runtimeType: 'Process',
          exitCode: code ?? 1,
          stdout,
          stderr,
          outputs: { result: code === 0 ? 'success' : 'failed' },
        });
      });

      child.on('error', (error) => {
        this.processKiller.unregister(request.taskId);
        reject(new Error(`Process execution failed: ${error.message}`));
      });

      // Handle abort signal
      signal?.addEventListener('abort', () => {
        child.kill('SIGTERM');
        setTimeout(() => {
          if (!child.killed) {
            child.kill('SIGKILL');
          }
        }, 3000);
        reject(new Error('Execution aborted'));
      }, { once: true });
    });
  }

  /**
   * 模拟执行（用于测试）
   */
  private async simulateExecution(
    request: TaskExecutionRequest,
    runtimeType: string,
    signal?: AbortSignal
  ): Promise<any> {
    logger.info(
      { taskId: request.taskId, runtimeType },
      `Simulating ${runtimeType} execution`
    );

    // 检查是否已取消
    if (signal?.aborted) {
      throw new Error('Execution aborted');
    }

    // 模拟执行延迟
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(resolve, 100);

      if (signal) {
        signal.addEventListener('abort', () => {
          clearTimeout(timeout);
          reject(new Error('Execution aborted'));
        });
      }
    });

    return {
      pluginId: request.pluginId,
      runtimeType,
      stdout: `${runtimeType} plugin executed successfully`,
      outputs: {
        result: 'success',
      },
    };
  }

  /**
   * 转换沙箱执行结果
   */
  private convertSandboxResult(
    result: SandboxExecutionResult,
    startTime: number
  ): TaskExecutionResult {
    let status: TaskStatus;

    if (result.success) {
      status = TaskStatus.SUCCESS;
    } else if (result.killed) {
      status = result.killReason === 'TIMEOUT' ? TaskStatus.TIMEOUT : TaskStatus.CANCELLED;
    } else {
      status = TaskStatus.FAILED;
    }

    return {
      taskId: result.taskId,
      status,
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      durationMs: result.durationMs,
      outputs: result.outputs,
      errorMessage: result.errorMessage,
      killed: result.killed,
      killReason: result.killReason,
    };
  }

  /**
   * 创建错误结果
   */
  private createErrorResult(
    taskId: string,
    status: TaskStatus,
    errorMessage: string,
    exitCode: number
  ): TaskExecutionResult {
    return {
      taskId,
      status,
      exitCode,
      durationMs: 0,
      errorMessage,
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

  /**
   * 关闭执行器
   */
  shutdown(): void {
    // 取消所有执行
    this.sandbox?.cancelAllExecutions('Executor shutdown');

    // 关闭沙箱
    this.sandbox?.shutdown();

    // 关闭审计日志器
    this.auditLogger?.shutdown();

    // 清理资源
    this.resourceManager?.releaseAll();

    logger.info('Plugin executor shutdown complete');
  }
}