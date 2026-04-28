/**
 * AgentSandbox — Agent Worker Thread 沙箱隔离
 *
 * SRE 安全护栏:
 * 1. Agent 执行在独立 Worker Thread，与主进程隔离
 * 2. Worker Thread 无数据库连接访问权限
 * 3. 所有 I/O 通过 IPC 通道中转
 * 4. 超时自动 kill（默认 30s）
 * 5. 资源限制（内存 < 512MB）
 *
 * P1 SRE Guard | 2026-04-28
 */

import { Worker } from 'worker_threads';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as url from 'url';

// Resolve worker file path correctly in ESM
const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

// ==================== Types ====================

export interface SandboxTask {
  id: string;
  action: string;
  input: Record<string, unknown>;
  profile: {
    allowedTools: string[];
    maxExecutionTimeMs: number;
    memoryLimitMB: number;
  };
}

export interface SandboxResult {
  taskId: string;
  success: boolean;
  output: Record<string, unknown>;
  error?: string;
  durationMs: number;
  memoryUsedMB?: number;
}

export interface SandboxConfig {
  /** Worker Thread 内存限制 (MB) */
  memoryLimitMB?: number;
  /** 默认超时时间 (ms) */
  defaultTimeoutMs?: number;
  /** Worker 空闲后自动回收时间 (ms) */
  idleTimeoutMs?: number;
}

const DEFAULT_CONFIG: Required<SandboxConfig> = {
  memoryLimitMB: 512,
  defaultTimeoutMs: 30_000,
  idleTimeoutMs: 60_000,
};

// ==================== Sandbox Manager ====================

export class AgentSandbox {
  private config: Required<SandboxConfig>;
  private activeWorkers: Map<string, { worker: Worker; timeout: ReturnType<typeof setTimeout> }> = new Map();
  private workerPath: string;

  constructor(config?: SandboxConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    // Use compiled JS path for the worker
    this.workerPath = path.join(__dirname, 'sandbox-worker.js');
  }

  /**
   * Execute a task in an isolated worker thread
   */
  async execute(task: Omit<SandboxTask, 'id'>): Promise<SandboxResult> {
    const taskId = uuidv4();
    const fullTask: SandboxTask = { ...task, id: taskId };
    const timeoutMs = task.profile.maxExecutionTimeMs || this.config.defaultTimeoutMs;

    return new Promise<SandboxResult>((resolve) => {
      let settled = false;

      const worker = new Worker(this.workerPath, {
        resourceLimits: {
          maxOldGenerationSizeMb: task.profile.memoryLimitMB || this.config.memoryLimitMB,
          maxYoungGenerationSizeMb: 64,
          stackSizeMb: 8,
        },
      });

      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        worker.terminate();
        resolve({
          taskId,
          success: false,
          output: {},
          error: `Worker terminated: execution timeout after ${timeoutMs}ms`,
          durationMs: timeoutMs,
        });
        this.activeWorkers.delete(taskId);
      }, timeoutMs);

      this.activeWorkers.set(taskId, { worker, timeout });

      worker.on('message', (result: SandboxResult) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        worker.terminate();
        this.activeWorkers.delete(taskId);
        resolve(result);
      });

      worker.on('error', (err: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        worker.terminate();
        this.activeWorkers.delete(taskId);
        resolve({
          taskId,
          success: false,
          output: {},
          error: `Worker error: ${err.message}`,
          durationMs: Date.now(),
        });
      });

      worker.on('exit', (code: number) => {
        if (settled) return;
        if (code !== 0) {
          settled = true;
          clearTimeout(timeout);
          this.activeWorkers.delete(taskId);
          resolve({
            taskId,
            success: false,
            output: {},
            error: `Worker exited with code ${code}`,
            durationMs: Date.now(),
          });
        }
      });

      // Send task to worker
      worker.postMessage(fullTask);
    });
  }

  /**
   * Get active worker count
   */
  getActiveWorkerCount(): number {
    return this.activeWorkers.size;
  }

  /**
   * Force terminate all active workers (e.g., during shutdown)
   */
  async shutdown(): Promise<void> {
    const promises: Promise<void>[] = [];
    for (const [, { worker, timeout }] of this.activeWorkers) {
      clearTimeout(timeout);
      promises.push(worker.terminate().then(() => {}));
    }
    this.activeWorkers.clear();
    await Promise.all(promises);
  }
}
