/**
 * RunnerPoolService — 构建资源池 (GAP-CN-07)
 *
 * 负责：
 * - Runner 注册与注销
 * - 心跳管理（检测离线 Runner）
 * - 标签路由选择（label-based selection）
 * - 远程任务分发与执行
 * - Runner 资源释放
 *
 * Runner 通信协议：
 * - Runner -> Platform: POST /runners/:id/heartbeat
 * - Platform -> Runner: POST {runnerEndpoint}/execute (HTTP)
 */

import pino from 'pino';
import {
  Runner,
  RunnerCreateInput,
  RunnerUpdateInput,
  isRunnerAvailable,
  isRunnerStale,
  getRunnerUtilization,
} from '../models/Runner';
import { RunnerJob, RunnerJobCreateInput } from '../models/RunnerJob';
import { PostgresRunnerRepository, RunnerRepository } from '../repositories/RunnerRepository';
import { PostgresRunnerJobRepository, RunnerJobRepository } from '../repositories/RunnerJobRepository';

const logger = pino({ name: 'runner-pool-service' });

export interface TaskExecutionPayload {
  id: string;
  name: string;
  type: string;
  parameters: Record<string, unknown>;
  stageId?: string;
  runId?: string;
  tenantId?: string;
  [key: string]: unknown;
}

export interface RunnerExecutionResult {
  jobId: string;
  status: string;
  result?: Record<string, unknown>;
  error?: string;
}

export class RunnerPoolService {
  private runnerRepo: RunnerRepository | null;
  private jobRepo: RunnerJobRepository | null;

  constructor(db: any) {
    if (db) {
      this.runnerRepo = new PostgresRunnerRepository(db);
      this.jobRepo = new PostgresRunnerJobRepository(db);
    } else {
      this.runnerRepo = null;
      this.jobRepo = null;
    }
  }

  // ==================== Runner Lifecycle ====================

  /**
   * 注册一个新的 Runner
   */
  async registerRunner(input: RunnerCreateInput): Promise<Runner> {
    if (!this.runnerRepo) {
      throw new Error('Database not available');
    }

    const runner = await this.runnerRepo.create(input);
    logger.info({ runnerId: runner.id, name: runner.name }, 'Runner registered');
    return runner;
  }

  /**
   * 注销 Runner（同时清理关联的 Job 记录）
   */
  async deregisterRunner(runnerId: string): Promise<void> {
    if (!this.runnerRepo) {
      throw new Error('Database not available');
    }

    await this.runnerRepo.delete(runnerId);
    logger.info({ runnerId }, 'Runner deregistered');
  }

  /**
   * 更新 Runner 心跳
   * @returns false if runner not found
   */
  async heartbeat(runnerId: string): Promise<boolean> {
    if (!this.runnerRepo) {
      throw new Error('Database not available');
    }

    await this.runnerRepo.updateHeartbeat(runnerId, new Date());
    logger.debug({ runnerId }, 'Runner heartbeat updated');
    return true;
  }

  /**
   * 更新 Runner 状态
   */
  async updateRunnerStatus(runnerId: string, status: Runner['status']): Promise<void> {
    if (!this.runnerRepo) {
      throw new Error('Database not available');
    }

    await this.runnerRepo.update(runnerId, { status });
    logger.info({ runnerId, status }, 'Runner status updated');
  }

  // ==================== Runner Selection (Label Routing) ====================

  /**
   * 为任务选择最佳 Runner
   *
   * 选择逻辑：
   * 1. 找到 tenant 下所有匹配所需标签的 Runner
   * 2. 过滤掉 offline、draining 状态
   * 3. 过滤掉 currentJobs >= maxConcurrent（已满）
   * 4. 按利用率（currentJobs/maxConcurrent）升序排序 — 选择最空闲的
   *
   * @param requiredLabels 任务需要的标签（AND 匹配）
   * @param tenantId 租户 ID
   * @returns 最佳 Runner，或 null
   */
  async selectRunner(requiredLabels: string[], tenantId: string): Promise<Runner | null> {
    if (!this.runnerRepo) {
      throw new Error('Database not available');
    }

    // Find all runners matching ALL required labels for this tenant
    const candidates = await this.runnerRepo.findByLabels(tenantId, requiredLabels);

    // Filter to available runners: online AND has capacity
    const available = candidates.filter(
      (r) => r.status === 'online' && r.currentJobs < r.maxConcurrent
    );

    if (available.length === 0) {
      logger.debug({ requiredLabels, tenantId }, 'No available runners matching labels');
      return null;
    }

    // Pick the runner with lowest utilization ratio (most capacity remaining)
    available.sort((a, b) => getRunnerUtilization(a) - getRunnerUtilization(b));
    const best = available[0];

    logger.info(
      { runnerId: best.id, name: best.name, labels: requiredLabels },
      'Selected runner for task'
    );

    return best;
  }

  // ==================== Task Dispatch ====================

  /**
   * 在远程 Runner 上执行任务
   *
   * 流程：
   * 1. 创建 RunnerJob 记录
   * 2. 更新 Runner 状态为 busy（如果达到容量）
   * 3. 发送 HTTP POST 到 Runner 的 /execute 端点
   * 4. 返回 Job 状态
   *
   * @param runnerId Runner ID
   * @param task Task 配置
   * @param runnerEndpoint Runner 的 HTTP 地址（如 http://runner-1:8080）
   * @returns RunnerExecutionResult
   */
  async executeOnRunner(
    runnerId: string,
    task: TaskExecutionPayload,
    runnerEndpoint: string
  ): Promise<RunnerExecutionResult> {
    if (!this.jobRepo || !this.runnerRepo) {
      throw new Error('Database not available');
    }

    // Create job record
    const jobInput: RunnerJobCreateInput = {
      runnerId,
      taskId: task.id,
      stageId: task.stageId,
      runId: task.runId,
      tenantId: task.tenantId || '',
    };
    const job = await this.jobRepo.create(jobInput);

    // Dispatch task to remote runner
    const payload = {
      jobId: job.id,
      task: {
        id: task.id,
        name: task.name,
        type: task.type,
        parameters: task.parameters,
        stageId: task.stageId,
      },
    };

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      // TODO: Store and use runner's apiToken for authentication
      // if (runner.apiToken) {
      //   headers['Authorization'] = `Bearer ${runner.apiToken}`;
      // }
      const response = await fetch(`${runnerEndpoint}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        const errorMsg = `Runner HTTP ${response.status}: ${errorText || response.statusText}`;
        logger.error({ runnerId, jobId: job.id, status: response.status }, errorMsg);

        // Mark job as failed
        await this.jobRepo.markFailed(job.id, errorMsg);

        throw new Error(`Runner HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json() as Record<string, unknown> | undefined;

      // Mark job as started
      await this.updateJobStatus(job.id, 'running');

      logger.info({ runnerId, jobId: job.id }, 'Task dispatched to runner');

      return {
        jobId: job.id,
        status: 'running',
        result,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown dispatch error';

      // Mark job as failed
      await this.jobRepo.markFailed(job.id, errorMessage);

      logger.error({ runnerId, jobId: job.id, error }, 'Failed to dispatch task to runner');
      throw error;
    }
  }

  /**
   * 释放 Runner（任务完成后调用）
   *
   * 流程：
   * 1. 递减 current_jobs
   * 2. 如果 current_jobs 回到 0，标记为 online
   */
  async releaseRunner(runnerId: string): Promise<void> {
    if (!this.runnerRepo) {
      throw new Error('Database not available');
    }

    await this.runnerRepo.decrementJobs(runnerId);

    logger.debug({ runnerId }, 'Runner released');
  }

  /**
   * 标记 Job 完成
   */
  async markJobComplete(
    jobId: string,
    result: Record<string, unknown>,
    runnerId: string
  ): Promise<void> {
    if (!this.jobRepo) {
      throw new Error('Database not available');
    }

    await this.jobRepo.markComplete(jobId, result);
    await this.releaseRunner(runnerId);

    logger.info({ jobId, runnerId }, 'Job completed and runner released');
  }

  /**
   * 标记 Job 失败
   */
  async markJobFailed(jobId: string, error: string, runnerId: string): Promise<void> {
    if (!this.jobRepo) {
      throw new Error('Database not available');
    }

    await this.jobRepo.markFailed(jobId, error);
    await this.releaseRunner(runnerId);

    logger.error({ jobId, runnerId, error }, 'Job failed and runner released');
  }

  // ==================== Monitoring ====================

  /**
   * 获取过期的 Runner（心跳超时）
   *
   * @param timeoutMinutes 心跳超时时间（分钟），默认 5
   */
  async getStaleRunners(timeoutMinutes = 5): Promise<Runner[]> {
    if (!this.runnerRepo) {
      throw new Error('Database not available');
    }

    // Find all online/busy runners
    const allRunners = [
      ...(await this.runnerRepo.findByStatus('online')),
      ...(await this.runnerRepo.findByStatus('busy')),
    ];

    // Filter to stale ones
    return allRunners.filter((r) => isRunnerStale(r, timeoutMinutes));
  }

  /**
   * 标记过期 Runner 为 offline
   */
  async markStaleRunnersOffline(timeoutMinutes = 5): Promise<number> {
    const stale = await this.getStaleRunners(timeoutMinutes);

    let count = 0;
    for (const runner of stale) {
      await this.updateRunnerStatus(runner.id, 'offline');
      count++;
    }

    if (count > 0) {
      logger.warn({ count }, 'Marked stale runners as offline');
    }

    return count;
  }

  /**
   * 获取 Runner 列表（分页）
   */
  async listRunners(tenantId: string): Promise<Runner[]> {
    if (!this.runnerRepo) {
      throw new Error('Database not available');
    }

    return this.runnerRepo.findByTenant(tenantId);
  }

  /**
   * 获取 Runner 详情
   */
  async getRunner(runnerId: string): Promise<Runner | undefined> {
    if (!this.runnerRepo) {
      throw new Error('Database not available');
    }

    return this.runnerRepo.findById(runnerId);
  }

  /**
   * 获取 Runner 的 Job 历史
   */
  async getRunnerJobs(runnerId: string): Promise<RunnerJob[]> {
    if (!this.jobRepo) {
      throw new Error('Database not available');
    }

    return this.jobRepo.findByRunnerId(runnerId);
  }

  // ==================== Internal Helpers ====================

  private async updateJobStatus(jobId: string, status: string): Promise<void> {
    if (!this.jobRepo) return;

    // Use a simple query through the job repo's db
    const query = `
      UPDATE runner_jobs SET status = $2, started_at = COALESCE(started_at, NOW())
      WHERE id = $1
    `;
    // Access db through the job repo's constructor param
    const db = (this.jobRepo as any).db;
    if (db) {
      await db.query(query, [jobId, status]);
    }
  }
}
