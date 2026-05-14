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
import pino from 'pino';
import { TaskExecutor, TaskParameters, TaskResult } from './TaskExecutor';
import { readFileSync } from 'fs';
import { hostname } from 'os';

const logger = pino({ name: 'runner-agent', level: process.env.LOG_LEVEL || 'info' });

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
    return {
      platformUrl: process.env.PLATFORM_URL || 'http://localhost:3001',
      runnerName: process.env.RUNNER_NAME || `${hostname()}-runner`,
      labels: parseLabels(process.env.RUNNER_LABELS),
      maxConcurrent: parseInt(process.env.RUNNER_MAX_CONCURRENT || '5', 10),
      port: parseInt(process.env.RUNNER_PORT || '8080', 10),
      heartbeatInterval: parseInt(process.env.HEARTBEAT_INTERVAL || '30000', 10),
      tenantId: process.env.TENANT_ID || 'default',
      apiToken: process.env.RUNNER_API_TOKEN,
      ...file,
    };
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
  private registerAttempts = 0;
  private readonly MAX_REGISTER_ATTEMPTS = 10;

  constructor(config: RunnerConfig) {
    this.config = config;
  }

  /**
   * 启动 Runner Agent
   */
  async start(): Promise<void> {
    logger.info({ platform: this.config.platformUrl }, 'Starting Orion Runner Agent');
    logger.info({ labels: this.config.labels }, 'Runner labels');
    logger.info({ maxConcurrent: this.config.maxConcurrent }, 'Max concurrent jobs');

    // 1. 注册到 Platform
    await this.register();

    // 2. 启动 HTTP 服务器接收任务
    const server = Fastify({ logger: true });

    // POST /execute — 接收 Platform 下发的任务
    server.post('/execute', async (request, reply) => {
      // Verify caller identity via Bearer token
      const authHeader = request.headers['authorization'] as string | undefined;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.code(401).send({ error: 'Unauthorized: Bearer token required' });
      }
      const token = authHeader.slice(7);
      if (this.config.apiToken && token !== this.config.apiToken) {
        return reply.code(403).send({ error: 'Forbidden: Invalid token' });
      }
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
      logger.info({ runnerId: this.runnerId }, 'Registered with Platform');
    } catch (error) {
      logger.error({ error }, 'Failed to register');
      this.registerAttempts++;

      if (this.registerAttempts >= this.MAX_REGISTER_ATTEMPTS) {
        logger.error({ attempts: this.MAX_REGISTER_ATTEMPTS }, 'Max registration attempts reached, giving up');
        process.exit(1);
      }

      // Exponential backoff: 5s, 10s, 20s, 40s, max 60s
      const delay = Math.min(5000 * Math.pow(2, this.registerAttempts - 1), 60000);
      logger.info(
        { attempt: this.registerAttempts, max: this.MAX_REGISTER_ATTEMPTS, delay },
        'Retrying registration'
      );
      setTimeout(() => this.register(), delay);
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
          logger.warn({ status: response.status }, 'Heartbeat failed');
        } else {
          logger.debug('Heartbeat sent');
        }
      } catch (error) {
        logger.warn({ error: (error as Error).message }, 'Heartbeat error');
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

    logger.info({ jobId, type: task.type, name: task.name }, 'Received job');

    this.activeJobs++;

    try {
      const params: TaskParameters = {
        ...task.parameters,
        workingDir: task.parameters?.workingDir || '/tmp/orion-workspace',
      };

      const result = await this.executor.execute(task.type, params);

      logger.info({ jobId, duration: result.duration }, `Job ${result.success ? 'completed' : 'failed'}`);

      // 异步回报结果给 Platform
      this.reportJobResult(jobId, result).catch((err) => {
        logger.error({ jobId, err }, 'Failed to report job result');
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
      logger.error({ jobId, error }, 'Job error');

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
      logger.error({ jobId, error }, 'Failed to report job result');
    }
  }
}

// ==================== Entry Point ====================

const config = loadConfig();
const agent = new RunnerAgent(config);
agent.start().catch((error) => {
  logger.fatal({ error }, 'Runner Agent fatal error');
  process.exit(1);
});
