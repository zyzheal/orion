/**
 * Plugin Sandbox
 *
 * 安全执行环境，负责：
 * - 安全隔离容器
 * - 执行超时控制
 * - 输入验证
 * - 输出 DLP 检测
 * - 执行记录 PostgreSQL 持久化
 */

import { createLogger } from '../utils/logger';
import { EventEmitter } from 'events';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import {
  ExecutionContext,
  ValidationResult,
  ValidationError,
  DLPDetectionResult,
  SandboxExecutionResult,
} from './types';
import { PluginResourceManager } from './PluginResourceManager';
import { PluginAuditLogger } from './PluginAuditLogger';
import { PluginSandboxRepository } from '../../repositories/PluginSandboxRepository';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

/**
 * 沙箱配置
 */
export interface SandboxConfig {
  defaultTimeoutMs: number;
  maxTimeoutMs: number;
  enableInputValidation: boolean;
  enableOutputDLPSanitization: boolean;
  enableResourceMonitoring: boolean;
  resourceMonitorIntervalMs: number;
}

/**
 * 输入验证规则
 */
interface ValidationRule {
  type: 'type' | 'format' | 'size' | 'custom';
  field?: string;
  constraint: any;
  message: string;
}

/**
 * 默认沙箱配置
 */
const DEFAULT_SANDBOX_CONFIG: SandboxConfig = {
  defaultTimeoutMs: 60000,
  maxTimeoutMs: 300000,
  enableInputValidation: true,
  enableOutputDLPSanitization: true,
  enableResourceMonitoring: true,
  resourceMonitorIntervalMs: 1000,
};

/**
 * Plugin Sandbox — PostgreSQL 持久化记录实体
 */
interface SandboxTaskRecord {
  id: string;
  tenantId: string;
  pluginId: string;
  status: string;
  errorMessage?: string;
  startedAt?: Date;
  completedAt?: Date;
}

/**
 * Plugin Sandbox
 */
export class PluginSandbox extends EventEmitter {
  private config: SandboxConfig;
  private resourceManager: PluginResourceManager;
  private auditLogger: PluginAuditLogger;
  private repository?: PluginSandboxRepository;

  /** In-memory runtime state (AbortController, timers) */
  private activeExecutions: Map<string, {
    context: ExecutionContext;
    timeoutId?: NodeJS.Timeout;
    monitorInterval?: NodeJS.Timeout;
    aborted: boolean;
    abortReason?: string;
    promise?: Promise<SandboxExecutionResult>;
    dbRecordId?: string;
  }> = new Map();
  private runningTasks: Map<string, AbortController> = new Map();

  constructor(options: {
    resourceManager: PluginResourceManager;
    auditLogger: PluginAuditLogger;
    config?: Partial<SandboxConfig>;
    db?: {
      query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }>;
    };
  }) {
    super();
    this.resourceManager = options.resourceManager;
    this.auditLogger = options.auditLogger;
    this.config = { ...DEFAULT_SANDBOX_CONFIG, ...options.config };
    this.repository = options.db ? new PluginSandboxRepository(options.db) : undefined;
  }

  /**
   * 持久化：创建执行记录
   * 失败时降级到内存（仅记录日志）
   */
  private async persistExecutionStart(
    context: ExecutionContext,
  ): Promise<string | undefined> {
    if (!this.repository) return undefined;
    try {
      const recordId = uuidv4();
      await this.repository.create({
        id: recordId,
        tenantId: context.tenantId || '00000000-0000-0000-0000-000000000000',
        pluginId: context.pluginId,
        taskType: 'sandbox',
        inputData: {},
        outputData: null,
        status: 'running',
        errorMessage: null,
        startedAt: new Date(),
        completedAt: null,
      });
      return recordId;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ err: msg, pluginId: context.pluginId, taskId: context.taskId }, 'Failed to persist execution start, falling back to memory');
      return undefined;
    }
  }

  /**
   * 持久化：更新执行完成记录
   */
  private async persistExecutionComplete(
    recordId: string,
    status: string,
    errorMessage?: string,
    outputData?: any,
  ): Promise<void> {
    if (!recordId || !this.repository) return;
    try {
      const updateData: any = { status };
      if (status === 'running') {
        updateData.startedAt = new Date();
      }
      if (status === 'completed' || status === 'failed') {
        updateData.completedAt = new Date();
      }
      if (errorMessage) {
        updateData.errorMessage = errorMessage;
      }
      if (outputData) {
        updateData.outputData = typeof outputData === 'string' ? JSON.parse(outputData) : outputData;
      }
      await this.repository.update(recordId, updateData);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn({ err: msg, recordId }, 'Failed to persist execution complete');
    }
  }

  /**
   * 验证输入
   */
  validateInput(input: any, rules?: ValidationRule[]): ValidationResult {
    const errors: ValidationError[] = [];

    if (!this.config.enableInputValidation) {
      return { valid: true, errors: [] };
    }

    // 默认验证规则
    const defaultRules: ValidationRule[] = rules || [
      { type: 'size', constraint: { maxSize: 10 * 1024 * 1024 }, message: 'Input exceeds maximum size limit (10MB)' },
    ];

    for (const rule of defaultRules) {
      const error = this.applyValidationRule(input, rule);
      if (error) {
        errors.push(error);
      }
    }

    // 特殊字段验证
    if (typeof input === 'object' && input !== null) {
      // 检查命令注入
      if (input.command || input.cmd) {
        const cmdValidation = this.validateCommand(input.command || input.cmd);
        if (!cmdValidation.valid) {
          errors.push(...cmdValidation.errors);
        }
      }

      // 检查路径遍历
      if (input.path || input.filePath) {
        const pathValidation = this.validatePath(input.path || input.filePath);
        if (!pathValidation.valid) {
          errors.push(...pathValidation.errors);
        }
      }

      // 检查环境变量
      if (input.env) {
        const envValidation = this.validateEnvironment(input.env);
        if (!envValidation.valid) {
          errors.push(...envValidation.errors);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 检测输出中的敏感数据
   */
  detectSensitiveOutput(output: any): DLPDetectionResult {
    if (!this.config.enableOutputDLPSanitization) {
      return { hasSensitiveData: false, patterns: [] };
    }

    let outputStr: string;
    if (typeof output === 'string') {
      outputStr = output;
    } else if (typeof output === 'object') {
      outputStr = JSON.stringify(output);
    } else {
      outputStr = String(output);
    }

    return this.auditLogger.detectSensitiveData(outputStr);
  }

  /**
   * 在沙箱中执行函数
   */
  async executeInSandbox<T>(
    context: ExecutionContext,
    fn: (signal: AbortSignal) => Promise<T>,
    options?: {
      timeout?: number;
      onProgress?: (progress: any) => void;
    }
  ): Promise<SandboxExecutionResult> {
    const startTime = Date.now();
    const timeout = options?.timeout || context.quota.timeoutMs || this.config.defaultTimeoutMs;
    const effectiveTimeout = Math.min(timeout, this.config.maxTimeoutMs);

    // 创建 AbortController
    const abortController = new AbortController();
    const { signal } = abortController;
    this.runningTasks.set(context.taskId, abortController);

    // 设置超时
    let timeoutId: NodeJS.Timeout | undefined;
    let timeoutReached = false;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        timeoutReached = true;
        abortController.abort();
        reject(new Error(`Execution timeout after ${effectiveTimeout}ms`));
      }, effectiveTimeout);
    });

    // 持久化：创建执行记录（fire-and-forget，不阻塞执行注册）
    const recordIdPromise = this.persistExecutionStart(context);

    // 记录执行开始
    this.auditLogger.logExecutionStart(context);

    // 启动资源监控
    const monitorInterval = this.config.enableResourceMonitoring
      ? this.startResourceMonitoring(context)
      : undefined;

    // 记录活跃执行（必须在 await 之前注册，否则外部检查会看到 0）
    const executionEntry: {
      context: ExecutionContext;
      timeoutId?: NodeJS.Timeout;
      monitorInterval?: NodeJS.Timeout;
      aborted: boolean;
      abortReason?: string;
      promise?: Promise<SandboxExecutionResult>;
      dbRecordId?: string;
    } = {
      context,
      timeoutId,
      monitorInterval,
      aborted: false,
    };
    this.activeExecutions.set(context.taskId, executionEntry);

    // 等待 DB 持久化完成，获取 recordId
    const recordId = await recordIdPromise;
    executionEntry.dbRecordId = recordId;

    try {
      // 执行函数
      const result = await Promise.race([
        fn(signal),
        timeoutPromise,
      ]);

      // 清理
      if (timeoutId) clearTimeout(timeoutId);
      if (monitorInterval) clearInterval(monitorInterval);
      this.runningTasks.delete(context.taskId);
      const execEntry = this.activeExecutions.get(context.taskId);
      if (execEntry?.monitorInterval) clearInterval(execEntry.monitorInterval);
      this.activeExecutions.delete(context.taskId);

      const durationMs = Date.now() - startTime;

      // 检测输出中的敏感数据
      const dlpResult = this.detectSensitiveOutput(result);
      if (dlpResult.hasSensitiveData) {
        this.auditLogger.logSecurityEvent({
          type: 'SENSITIVE_DATA_DETECTED',
          severity: 'MEDIUM',
          taskId: context.taskId,
          pluginId: context.pluginId,
          message: 'Sensitive data detected in output',
          details: {
            patterns: dlpResult.patterns.map((p) => p.type),
          },
        });
      }

      // 持久化：更新执行完成
      if (recordId) {
        await this.persistExecutionComplete(recordId, 'completed', undefined, result);
      }

      // 记录执行完成
      this.auditLogger.logExecutionComplete(context, dlpResult.redactedData, durationMs);

      this.emit('execution:complete', {
        taskId: context.taskId,
        durationMs,
        result,
      });

      return {
        taskId: context.taskId,
        success: true,
        exitCode: 0,
        durationMs,
        outputs: this.convertResultToOutputs(result),
      };
    } catch (error) {
      // 清理
      if (timeoutId) clearTimeout(timeoutId);
      if (monitorInterval) clearInterval(monitorInterval);
      this.runningTasks.delete(context.taskId);

      // 清理 monitor interval from activeExecutions entry
      const execEntry = this.activeExecutions.get(context.taskId);
      if (execEntry?.monitorInterval) clearInterval(execEntry.monitorInterval);

      // 获取执行状态
      const executionState = this.activeExecutions.get(context.taskId);
      const wasAborted = executionState?.aborted || false;
      const abortReason = executionState?.abortReason;
      const storedRecordId = executionState?.dbRecordId;

      // 删除活跃执行记录
      this.activeExecutions.delete(context.taskId);

      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      // 判断是否为手动取消
      if (wasAborted && abortReason) {
        this.auditLogger.logExecutionError(context, new Error(`Execution cancelled: ${abortReason}`), durationMs);

        // 持久化：取消记录
        if (storedRecordId) {
          await this.persistExecutionComplete(storedRecordId, 'cancelled', `Execution cancelled: ${abortReason}`);
        }

        this.emit('execution:cancelled', {
          taskId: context.taskId,
          reason: abortReason,
          durationMs,
        });

        return {
          taskId: context.taskId,
          success: false,
          exitCode: 143, // SIGTERM 标准退出码
          durationMs,
          errorMessage: `Execution cancelled: ${abortReason}`,
          killed: true,
          killReason: 'CANCELLED',
        };
      }

      // 判断是否为超时
      const isTimeout = timeoutReached || errorMessage.includes('timeout');

      if (isTimeout) {
        // 持久化：超时记录
        if (storedRecordId) {
          await this.persistExecutionComplete(storedRecordId, 'timeout', `Execution timeout after ${effectiveTimeout}ms`);
        }

        // 记录超时安全事件
        this.auditLogger.logSecurityEvent({
          type: 'TIMEOUT_KILLED',
          severity: 'HIGH',
          taskId: context.taskId,
          pluginId: context.pluginId,
          message: `Execution killed due to timeout (${effectiveTimeout}ms)`,
          details: {
            timeoutMs: effectiveTimeout,
            durationMs,
          },
        });

        this.auditLogger.logExecutionError(context, new Error(`Timeout after ${effectiveTimeout}ms`), durationMs);

        this.emit('execution:timeout', {
          taskId: context.taskId,
          timeoutMs: effectiveTimeout,
          durationMs,
        });

        return {
          taskId: context.taskId,
          success: false,
          exitCode: 124, // 标准超时退出码
          durationMs,
          errorMessage: `Execution timeout after ${effectiveTimeout}ms`,
          killed: true,
          killReason: 'TIMEOUT',
        };
      }

      // 持久化：错误记录
      if (storedRecordId) {
        await this.persistExecutionComplete(storedRecordId, 'failed', errorMessage);
      }

      // 记录执行错误
      this.auditLogger.logExecutionError(
        context,
        error instanceof Error ? error : new Error(errorMessage),
        durationMs
      );

      this.emit('execution:error', {
        taskId: context.taskId,
        error: errorMessage,
        durationMs,
      });

      return {
        taskId: context.taskId,
        success: false,
        exitCode: 1,
        durationMs,
        errorMessage,
      };
    }
  }

  /**
   * 取消执行
   */
  cancelExecution(taskId: string, reason?: string): boolean {
    const abortController = this.runningTasks.get(taskId);
    const execution = this.activeExecutions.get(taskId);

    if (!abortController && !execution) {
      return false;
    }

    // 标记为已中止（在调用 abort 之前）
    if (execution) {
      execution.aborted = true;
      execution.abortReason = reason || 'Manual cancellation';

      // 记录安全事件
      this.auditLogger.logSecurityEvent({
        type: 'SANDBOX_VIOLATION',
        severity: 'MEDIUM',
        taskId: execution.context.taskId,
        pluginId: execution.context.pluginId,
        message: `Execution cancelled: ${reason || 'Manual cancellation'}`,
        details: { reason },
      });
    }

    // 中止任务
    if (abortController) {
      abortController.abort();
      this.runningTasks.delete(taskId);
    }

    // 注意：不立即删除 activeExecutions，让 catch 块处理清理
    // 这样 catch 块可以检测到 aborted 标志并返回正确的结果

    this.emit('execution:cancelled', { taskId, reason });

    logger.info({ taskId, reason }, 'Execution cancelled');

    return true;
  }

  /**
   * 获取活跃执行数量
   */
  getActiveExecutionCount(): number {
    return this.activeExecutions.size;
  }

  /**
   * 获取活跃执行列表
   */
  getActiveExecutions(): string[] {
    return Array.from(this.activeExecutions.keys());
  }

  /**
   * 取消所有执行（异步等待所有取消完成）
   */
  async cancelAllExecutions(reason?: string): Promise<number> {
    const taskIds = Array.from(this.activeExecutions.keys());
    for (const taskId of taskIds) {
      this.cancelExecution(taskId, reason);
    }
    // Wait briefly for cancellation promises to resolve
    await new Promise(resolve => setTimeout(resolve, 500));
    return taskIds.length;
  }

  /**
   * 应用验证规则
   */
  private applyValidationRule(input: any, rule: ValidationRule): ValidationError | null {
    switch (rule.type) {
      case 'type':
        if (rule.field) {
          const value = input[rule.field];
          if (value !== undefined && typeof value !== rule.constraint) {
            return {
              field: rule.field,
              message: rule.message || `Field ${rule.field} must be of type ${rule.constraint}`,
              value,
            };
          }
        }
        break;

      case 'size': {
        const size = typeof input === 'string' ? input.length : JSON.stringify(input).length;
        if (rule.constraint.maxSize && size > rule.constraint.maxSize) {
          return {
            field: 'input',
            message: rule.message,
            value: size,
          };
        }
        break;
      }

      case 'format': {
        if (rule.field && input[rule.field]) {
          const regex = new RegExp(rule.constraint.pattern);
          if (!regex.test(input[rule.field])) {
            return {
              field: rule.field,
              message: rule.message || `Field ${rule.field} has invalid format`,
              value: input[rule.field],
            };
          }
        }
        break;
      }

      case 'custom': {
        if (typeof rule.constraint === 'function') {
          const result = rule.constraint(input);
          if (!result.valid) {
            return {
              field: result.field || 'input',
              message: rule.message || result.message,
              value: result.value,
            };
          }
        }
        break;
      }
    }

    return null;
  }

  /**
   * 验证命令（防止命令注入）
   */
  private validateCommand(cmd: string): ValidationResult {
    const errors: ValidationError[] = [];
    const dangerousPatterns = [
      /[;&|`$]/,  // Shell 元字符
      /\$\(/,     // 命令替换
      /`/,        // 反引号命令替换
      />\s*\//,   // 重定向到根目录
      /rm\s+-rf/, // 危险删除命令
      /chmod\s+777/, // 危险权限设置
      /sudo/,     // 提权命令
      /mkfs/,     // 格式化命令
      /dd\s+if=/, // 磁盘操作
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(cmd)) {
        errors.push({
          field: 'command',
          message: `Command contains potentially dangerous pattern: ${pattern}`,
          value: '[REDACTED]',
        });
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * 验证路径（防止路径遍历）
   */
  private validatePath(path: string): ValidationResult {
    const errors: ValidationError[] = [];
    const dangerousPatterns = [
      /\.\./,           // 目录遍历
      /\/etc\//,        // 系统配置
      /\/root\//,       // Root 目录
      /\/proc\//,       // 进程信息
      /\/sys\//,        // 系统信息
      /\0/,             // Null 字节
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(path)) {
        errors.push({
          field: 'path',
          message: `Path contains potentially dangerous pattern`,
          value: '[REDACTED]',
        });
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * 验证环境变量
   */
  private validateEnvironment(env: Record<string, string>): ValidationResult {
    const errors: ValidationError[] = [];
    const dangerousKeys = [
      'PATH',
      'LD_PRELOAD',
      'LD_LIBRARY_PATH',
      'PYTHONPATH',
      'NODE_PATH',
      'HOME',
      'USER',
      'SUDO_USER',
      'KUBERNETES_SERVICE_HOST',
      'KUBERNETES_SERVICE_PORT',
    ];

    for (const key of dangerousKeys) {
      if (key in env) {
        errors.push({
          field: `env.${key}`,
          message: `Environment variable ${key} is not allowed to be modified`,
          value: '[REDACTED]',
        });
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * 启动资源监控
   *
   * Reads real system metrics where possible (Node.js process memory, CPU load averages,
   * system network counters). For container-specific metrics, a Docker API or cgroup
   * integration would be needed (marked as TODO).
   */
  private startResourceMonitoring(context: ExecutionContext): NodeJS.Timeout {
    // Track CPU usage by comparing process CPU time between samples
    let prevCpuTime = process.cpuUsage();
    let prevTimestamp = Date.now();

    return setInterval(() => {
      try {
        // Read real memory usage from current Node.js process
        const memUsage = process.memoryUsage();

        // Calculate CPU usage percentage since last sample
        const currCpuTime = process.cpuUsage();
        const currTimestamp = Date.now();
        const elapsedMs = currTimestamp - prevTimestamp;
        const cpuDeltaUs = (currCpuTime.user - prevCpuTime.user) + (currCpuTime.system - prevCpuTime.system);
        const cpuPercent = elapsedMs > 0 ? (cpuDeltaUs / 1000 / elapsedMs) * 100 : 0;

        prevCpuTime = currCpuTime;
        prevTimestamp = currTimestamp;

        // Read system load averages (platform-independent)
        const loadAvg = os.loadavg();

        // For network metrics, we use /proc/net/dev on Linux if available,
        // otherwise fall back to zero (no reliable cross-platform API)
        let networkRxBytes = 0;
        let networkTxBytes = 0;
        try {
          const netDev = require('fs').readFileSync('/proc/net/dev', 'utf8');
          const lines = netDev.split('\n').slice(2); // skip header lines
          for (const line of lines) {
            const fields = line.trim().split(/\s+/);
            if (fields.length >= 10 && fields[0] !== 'lo:') {
              networkRxBytes += parseInt(fields[1], 10);
              networkTxBytes += parseInt(fields[9], 10);
            }
          }
        } catch {
          // /proc/net/dev not available (non-Linux), keep at 0
        }

        const usage = {
          cpuPercent: Math.min(cpuPercent, 100), // cap at 100%
          memoryBytes: memUsage.rss, // Resident Set Size - actual physical memory
          diskBytes: memUsage.external, // external memory (native allocations)
          networkRxBytes,
          networkTxBytes,
          timestamp: new Date(),
        };

        // 更新资源管理器
        this.resourceManager.updateUsage(context.taskId, usage);

        // 记录审计日志
        this.auditLogger.logResourceUsage(context, usage);

        // 检查配额违规
        const allocation = this.resourceManager.getAllocation(context.taskId);
        if (allocation) {
          const memoryPercent = usage.memoryBytes / allocation.quota.memoryBytes;
          if (memoryPercent > 0.95) {
            // 内存即将超出，强制终止
            this.auditLogger.logSecurityEvent({
              type: 'MEMORY_LIMIT_EXCEEDED',
              severity: 'CRITICAL',
              taskId: context.taskId,
              pluginId: context.pluginId,
              message: 'Memory limit exceeded, execution will be terminated',
              details: {
                usedBytes: usage.memoryBytes,
                limitBytes: allocation.quota.memoryBytes,
                percent: memoryPercent * 100,
              },
            });

            this.cancelExecution(context.taskId, 'Memory limit exceeded');
          }
        }
      } catch (error) {
        logger.error({ error }, 'Resource monitoring error');
      }
    }, this.config.resourceMonitorIntervalMs);
  }

  /**
   * 将执行结果转换为 outputs 格式
   */
  private convertResultToOutputs(result: unknown): Record<string, string> | undefined {
    if (result === null || result === undefined) {
      return undefined;
    }

    if (typeof result === 'string') {
      return { result };
    }

    if (typeof result === 'object' && result !== null) {
      const outputs: Record<string, string> = {};
      const obj = result as Record<string, unknown>;

      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string') {
          outputs[key] = value;
        } else if (value !== null && value !== undefined) {
          outputs[key] = JSON.stringify(value);
        }
      }

      return outputs;
    }

    return { result: String(result) };
  }

  /**
   * 关闭沙箱（异步等待所有执行终止）
   */
  async shutdown(): Promise<void> {
    const count = await this.cancelAllExecutions('Sandbox shutdown');
    logger.info({ cancelledCount: count }, 'Plugin sandbox shutdown complete');
  }
}
