/**
 * Orion Runner Agent
 *
 * 轻量级 CI 执行器，作为独立 Node.js 进程运行。
 *
 * 职责：
 * 1. 启动时向 Orion Platform 注册自身
 * 2. 定时发送心跳保持在线
 * 3. 接收 Platform 下发的任务（POST /execute）
 * 4. 执行任务并返回结果
 *
 * 通信协议：
 * - Runner -> Platform: POST /api/v1/runners/:id/heartbeat
 * - Platform -> Runner: POST /execute
 * - Runner -> Platform: POST /api/v1/runners/:id/register (初始注册)
 */

import Fastify from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { TaskExecutor, TaskParameters, TaskResult } from './TaskExecutor';
import { readFileSync } from 'fs';
import { hostname } from 'os';

// ==================== Config ====================

interface RunnerConfig {
  platformUrl: string;
  runnerName: string;
  labels: string[];
  maxConcurrent: number;
  port: number;
  heartbeatInterval: number;
  tenantId: string;
  apiToken?: string;
}

function loadConfig(): RunnerConfig {
  // 支持从配置文件读取
  try {
    const raw = readFileSync('./config/runner.json', 'utf-8');
    const file = JSON.parse(raw);
    return { ...defaultConfig(), ...file };
  } catch {
    // 从环境变量读取
  }

  return {
    platformUrl: process.env.PLATFORM_URL || 'http://localhost:3001',
    runnerName: process.env.RUNNER_NAME || `${hostname()}-runner`,
    labels: parseLabels(process.env.RUNNER_LABELS),
    maxConcurrent: parseInt(process.env.RUNNER_MAX_CONCURRENT || '5', 10),
    port: parseInt(process.env.RUNNER_PORT || '8080', 10),
    heartbeatInterval: parseInt(process.env.HEARTBEAT_INTERVAL || '30000', 10),
    tenantId: process.env.TENANT_ID || 'default',
    apiToken: process.env.RUNNER_API_TOKEN,
  };
}

function defaultConfig(): RunnerConfig {
  return loadConfig();
}

function parseLabels(raw?: string): string[] {
  if (!raw) return ['linux', 'nodejs'];
  return raw.split(',').map((l) => l.trim()).filter(Boolean);
}

// ==================== Runner Agent ====================

class RunnerAgent {
  private config: RunnerConfig;
  private runnerId: string | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private executor = new TaskExecutor();
  private activeJobs = 0;

  constructor(config: RunnerConfig) {
    this.config = config;
  }

  /**
   * 启动 Runner Agent
   */
  async start(): Promise<void> {
    console.log(`[runner] Starting Orion Runner Agent...`);
    console.log(`[runner] Platform: ${this.config.platformUrl}`);
    console.log(`[runner] Labels: ${this.config.labels.join(', ')}`);
    console.log(`[runner] Max concurrent: ${this.config.maxConcurrent}`);

    // 1. 注册到 Platform
    await this.register();

    // 2. 启动 HTTP 服务器接收任务
    const server = Fastify({ logger: true });

    // POST /execute — 接收 Platform 下发的任务
    server.post('/execute', async (request, reply) => {
      return this.handleExecute(request, reply);
    });

    // GET /health — 健康检查
    server.get('/health', async (request, reply) => {
      return { status: 'ok', activeJobs: this.activeJobs, runnerId: this.runnerId };
    });

    await server.listen({ port: this.config.port, host: '0.0.0.0' });
    console.log(`[runner] HTTP server listening on :${this.config.port}`);

    // 3. 启动心跳
    this.startHeartbeat();

    console.log(`[runner] Runner Agent started successfully`);
  }

  /**
   * 向 Platform 注册自身
   */
  private async register(): Promise<void> {
    const url = `${this.config.platformUrl}/api/v1/runners`;

    const payload = {
      tenantId: this.config.tenantId,
      name: this.config.runnerName,
      labels: this.config.labels,
      maxConcurrent: this.config.maxConcurrent,
      endpoint: `http://${hostname()}:${this.config.port}`,
      metadata: {
        os: process.platform,
        arch: process.arch,
        version: process.version,
        nodeVersion: process.version,
      },
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiToken ? { 'Authorization': `Bearer ${this.config.apiToken}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Registration failed: HTTP ${response.status} — ${text}`);
      }

      const data = await response.json() as Record<string, unknown>;
      this.runnerId = data.id as string;
      console.log(`[runner] Registered with Platform, runnerId=${this.runnerId}`);
    } catch (error) {
      console.error(`[runner] Failed to register:`, error);
      // 不退出，持续重试
      setTimeout(() => this.register(), 5000);
    }
  }

  /**
   * 启动心跳循环
   */
  private startHeartbeat(): void {
    const sendHeartbeat = async () => {
      if (!this.runnerId) return;

      const url = `${this.config.platformUrl}/api/v1/runners/${this.runnerId}/heartbeat`;

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(this.config.apiToken ? { 'Authorization': `Bearer ${this.config.apiToken}` } : {}),
          },
        });

        if (!response.ok) {
          console.warn(`[runner] Heartbeat failed: HTTP ${response.status}`);
        } else {
          console.debug(`[runner] Heartbeat sent`);
        }
      } catch (error) {
        console.warn(`[runner] Heartbeat error:`, (error as Error).message);
      }
    };

    // 立即发送一次
    sendHeartbeat();

    this.heartbeatTimer = setInterval(sendHeartbeat, this.config.heartbeatInterval);
  }

  /**
   * 处理 Platform 下发的任务
   */
  private async handleExecute(request: any, reply: any): Promise<any> {
    const body = request.body as { jobId: string; task: any };

    if (!body || !body.task) {
      return reply.code(400).send({ error: 'Missing task payload' });
    }

    // 检查容量
    if (this.activeJobs >= this.config.maxConcurrent) {
      return reply.code(503).send({ error: 'Runner at capacity', activeJobs: this.activeJobs });
    }

    const task = body.task;
    const jobId = body.jobId;

    console.log(`[runner] Received job ${jobId}: ${task.type} — ${task.name}`);

    this.activeJobs++;

    try {
      const params: TaskParameters = {
        ...task.parameters,
        workingDir: task.parameters?.workingDir || '/tmp/orion-workspace',
      };

      const result = await this.executor.execute(task.type, params);

      console.log(`[runner] Job ${jobId} completed: ${result.success ? 'success' : 'failed'} (${result.duration}ms)`);

      // 异步回报结果给 Platform
      this.reportJobResult(jobId, result).catch((err) => {
        console.error(`[runner] Failed to report job result:`, err);
      });

      return {
        jobId,
        status: result.success ? 'completed' : 'failed',
        result: {
          success: result.success,
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
          duration: result.duration,
        },
      };
    } catch (error) {
      console.error(`[runner] Job ${jobId} error:`, error);

      const errorResult: TaskResult = {
        success: false,
        stdout: '',
        stderr: (error as Error).message,
        exitCode: -1,
        duration: 0,
      };

      this.reportJobResult(jobId, errorResult).catch(() => {});

      return {
        jobId,
        status: 'failed',
        error: (error as Error).message,
      };
    } finally {
      this.activeJobs--;
    }
  }

  /**
   * 向 Platform 回报 Job 执行结果
   */
  private async reportJobResult(jobId: string, result: TaskResult): Promise<void> {
    if (!this.runnerId) return;

    const url = `${this.config.platformUrl}/api/v1/runners/${this.runnerId}/jobs/${jobId}/result`;

    try {
      await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiToken ? { 'Authorization': `Bearer ${this.config.apiToken}` } : {}),
        },
        body: JSON.stringify({
          jobId,
          status: result.success ? 'completed' : 'failed',
          result: {
            stdout: result.stdout,
            stderr: result.stderr,
            exitCode: result.exitCode,
            duration: result.duration,
          },
          ...(result.success ? {} : { error: result.stderr }),
        }),
      });
    } catch (error) {
      console.error(`[runner] Failed to report job result:`, error);
    }
  }
}

// ==================== Entry Point ====================

const config = loadConfig();
const agent = new RunnerAgent(config);
agent.start().catch((error) => {
  console.error('[runner] Fatal error:', error);
  process.exit(1);
});
