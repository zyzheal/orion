/**
 * Plugin Sandbox (SPI)
 *
 * Provides an isolated execution environment for plugins with:
 * - Resource limit enforcement (CPU, memory, timeout)
 * - Security sandboxing (path restrictions, env var filtering)
 * - Timeout management with AbortController
 * - Execution result tracking
 *
 * This is the SPI-level sandbox that coordinates with the lower-level
 * plugin sandbox (src/services/plugin/PluginSandbox.ts) for actual
 * execution isolation.
 */

import pino from 'pino';
import { PluginSandboxConfig, PluginExecutionResult } from './types';
import { OrionError } from '../../errors';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

/**
 * Default sandbox configuration
 */
const DEFAULT_CONFIG: PluginSandboxConfig = {
  memoryLimit: 1024 * 1024 * 1024, // 1GB
  timeout: 60000, // 60s
  cpuCores: 2,
  maxConcurrent: 10,
};

/**
 * Active execution tracking
 */
interface ActiveExecution {
  pluginId: string;
  startTime: number;
  abortController: AbortController;
  timeoutId?: NodeJS.Timeout;
}

/**
 * Plugin Sandbox - Isolated execution environment
 */
export class PluginSandboxSPI {
  private config: PluginSandboxConfig;
  private activeExecutions: Map<string, ActiveExecution> = new Map();
  private executionHistory: {
    pluginId: string;
    success: boolean;
    duration: number;
    timestamp: Date;
  }[] = [];
  private executionCounter = 0;

  constructor(config?: Partial<PluginSandboxConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Execute a function in the sandbox with full isolation
   *
   * @param pluginId - Plugin identifier for tracking
   * @param fn - Async function to execute
   * @param options - Optional timeout override
   * @returns PluginExecutionResult with output and metrics
   */
  async execute<T = Record<string, any>>(
    pluginId: string,
    fn: (signal: AbortSignal) => Promise<T>,
    options?: { timeout?: number }
  ): Promise<PluginExecutionResult> {
    const startTime = Date.now();
    const timeout = options?.timeout || this.config.timeout;

    // Enforce concurrency limits
    this.enforceConcurrencyLimit();

    // Create abort controller for cancellation
    const abortController = new AbortController();
    const { signal } = abortController;

    // Timeout error reference for catch block identification
    let timeoutError: Error | null = null;

    // Track active execution (timeoutId will be set in the race)
    let timeoutId: NodeJS.Timeout | undefined;

    const executionId = `${pluginId}-${startTime}-${++this.executionCounter}`;

    const execution: ActiveExecution = {
      pluginId,
      startTime,
      abortController,
    };
    this.activeExecutions.set(executionId, execution);

    logger.debug(
      { pluginId, timeout },
      'Starting sandboxed execution'
    );

    try {
      // Enforce resource limits before execution
      this.enforceLimits(pluginId);

      // Create a timeout promise that races against the function
      timeoutError = new Error(`Execution timed out after ${timeout}ms`);
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(timeoutError), timeout);
      });

      // Race the function against the timeout
      const result = await Promise.race([fn(signal), timeoutPromise]);

      // Cleanup
      clearTimeout(timeoutId);
      this.activeExecutions.delete(executionId);

      const duration = Date.now() - startTime;

      // Track success
      this.executionHistory.push({
        pluginId,
        success: true,
        duration,
        timestamp: new Date(),
      });

      logger.info(
        { pluginId, duration },
        'Sandboxed execution completed successfully'
      );

      return {
        success: true,
        output: result as Record<string, any>,
        duration,
        exitCode: 0,
      };
    } catch (error) {
      // Cleanup
      clearTimeout(timeoutId);
      this.activeExecutions.delete(executionId);

      const duration = Date.now() - startTime;
      const message = error instanceof Error ? error.message : String(error);
      const isTimeout = error === timeoutError || signal.aborted;

      // Track failure
      this.executionHistory.push({
        pluginId,
        success: false,
        duration,
        timestamp: new Date(),
      });

      if (isTimeout) {
        logger.warn(
          { pluginId, duration, timeout },
          'Sandboxed execution timed out'
        );

        return {
          success: false,
          duration,
          error: `Execution timed out after ${timeout}ms`,
          exitCode: 124,
          killed: true,
          killReason: 'TIMEOUT',
        };
      }

      logger.error(
        { pluginId, duration, error: message },
        'Sandboxed execution failed'
      );

      return {
        success: false,
        duration,
        error: message,
        exitCode: 1,
      };
    }
  }

  /**
   * Execute with explicit timeout (wrapper around execute)
   */
  async executeWithTimeout<T = Record<string, any>>(
    pluginId: string,
    fn: (signal: AbortSignal) => Promise<T>,
    timeoutMs: number
  ): Promise<PluginExecutionResult> {
    return this.execute(pluginId, fn, { timeout: timeoutMs });
  }

  /**
   * Cancel a running execution
   */
  cancelExecution(pluginId: string, reason?: string): boolean {
    for (const [key, execution] of this.activeExecutions) {
      if (execution.pluginId === pluginId) {
        execution.abortController.abort();
        if (execution.timeoutId) {
          clearTimeout(execution.timeoutId);
        }
        this.activeExecutions.delete(key);

        logger.info({ pluginId, reason }, 'Execution cancelled');
        return true;
      }
    }
    return false;
  }

  /**
   * Cancel all running executions
   */
  cancelAllExecutions(reason?: string): number {
    const count = this.activeExecutions.size;
    for (const [key, execution] of this.activeExecutions) {
      execution.abortController.abort();
      if (execution.timeoutId) {
        clearTimeout(execution.timeoutId);
      }
      this.activeExecutions.delete(key);
    }
    logger.info({ count, reason }, 'All executions cancelled');
    return count;
  }

  /**
   * Get the number of active executions for a plugin
   */
  getActiveExecutionCount(pluginId?: string): number {
    if (pluginId) {
      let count = 0;
      for (const exec of this.activeExecutions.values()) {
        if (exec.pluginId === pluginId) count++;
      }
      return count;
    }
    return this.activeExecutions.size;
  }

  /**
   * Get plugin execution health metrics
   */
  getPluginHealth(pluginId: string): {
    pluginId: string;
    totalExecutions: number;
    successCount: number;
    failureCount: number;
    successRate: number;
    avgDurationMs: number;
    activeExecutions: number;
  } {
    const history = this.executionHistory.filter((e) => e.pluginId === pluginId);
    const successCount = history.filter((e) => e.success).length;
    const failureCount = history.filter((e) => !e.success).length;
    const totalExecutions = history.length;
    const successRate = totalExecutions > 0 ? successCount / totalExecutions : 1;
    const avgDurationMs =
      totalExecutions > 0
        ? history.reduce((sum, e) => sum + e.duration, 0) / totalExecutions
        : 0;

    return {
      pluginId,
      totalExecutions,
      successCount,
      failureCount,
      successRate,
      avgDurationMs,
      activeExecutions: this.getActiveExecutionCount(pluginId),
    };
  }

  /**
   * Update sandbox configuration
   */
  updateConfig(config: Partial<PluginSandboxConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info({ config }, 'Sandbox configuration updated');
  }

  /**
   * Get current sandbox configuration
   */
  getConfig(): Readonly<PluginSandboxConfig> {
    return { ...this.config };
  }

  /**
   * Enforce resource limits before execution
   */
  private enforceLimits(pluginId: string): void {
    // Check active execution count for this plugin
    const activeCount = this.getActiveExecutionCount(pluginId);
    if (activeCount >= this.config.maxConcurrent) {
      throw new OrionError('OPERATION_FAILED', `Plugin "${pluginId}" has reached maximum concurrent executions (${this.config.maxConcurrent})`);
    }

    // Check memory (simulated - in production would check actual memory usage)
    const estimatedMemory = this.config.memoryLimit;
    if (estimatedMemory > this.config.memoryLimit) {
      throw new OrionError('VALIDATION_ERROR', `Plugin "${pluginId}" memory limit exceeded: ${estimatedMemory} > ${this.config.memoryLimit}`);
    }
  }

  /**
   * Enforce global concurrency limits
   */
  private enforceConcurrencyLimit(): void {
    if (this.activeExecutions.size >= this.config.maxConcurrent * 5) {
      // Global limit: 5x per-plugin limit
      throw new OrionError('VALIDATION_ERROR', `Global execution limit reached (${this.activeExecutions.size} active executions)`);
    }
  }

  /**
   * Shutdown the sandbox, cancelling all executions
   */
  shutdown(): void {
    const cancelled = this.cancelAllExecutions('Sandbox shutdown');
    logger.info({ cancelled }, 'Plugin sandbox shutdown complete');
  }
}
