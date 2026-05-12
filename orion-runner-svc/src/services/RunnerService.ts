/**
 * Runner Service - Core CI task execution logic
 *
 * Handles platform registration, heartbeat, job execution, and result reporting.
 */

import { config } from '../config';
import { hostname, tmpdir } from 'os';
import { mkdir } from 'fs/promises';
import { join } from 'path';

export interface TaskParameters {
  [key: string]: unknown;
  workingDir?: string;
}

export interface TaskResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
}

export interface JobPayload {
  jobId: string;
  task: {
    type: string;
    name: string;
    parameters?: TaskParameters;
  };
}

export interface RunnerStatus {
  runnerId: string | null;
  activeJobs: number;
  status: 'registering' | 'online' | 'offline';
  maxConcurrent: number;
}

export class RunnerService {
  private runnerId: string | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private registerAttempts = 0;
  private readonly MAX_REGISTER_ATTEMPTS = 10;
  activeJobs = 0;

  get status(): RunnerStatus {
    return {
      runnerId: this.runnerId,
      activeJobs: this.activeJobs,
      status: this.runnerId ? 'online' : 'registering',
      maxConcurrent: config.runner.maxConcurrent,
    };
  }

  /**
   * Register with Platform
   */
  async register(): Promise<string> {
    const url = `${config.platform.url}/api/v1/runners`;
    const runnerName = config.runner.name || `${hostname()}-runner`;

    const payload = {
      tenantId: config.tenant.id,
      name: runnerName,
      labels: config.runner.labels,
      maxConcurrent: config.runner.maxConcurrent,
      endpoint: `http://${hostname()}:${config.port}`,
      metadata: {
        os: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.runner.apiToken ? { 'Authorization': `Bearer ${config.runner.apiToken}` } : {}),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(config.platform.timeout),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Registration failed: HTTP ${response.status} — ${text}`);
    }

    const data = await response.json() as Record<string, unknown>;
    this.runnerId = data.id as string;
    return this.runnerId;
  }

  /**
   * Retry registration with exponential backoff
   */
  async registerWithRetry(): Promise<void> {
    const attemptRegister = async () => {
      try {
        const id = await this.register();
        console.log(`[runner] Registered with Platform, runnerId=${id}`);
      } catch (error) {
        this.registerAttempts++;
        console.error(`[runner] Registration failed (attempt ${this.registerAttempts}/${this.MAX_REGISTER_ATTEMPTS}): ${(error as Error).message}`);

        if (this.registerAttempts >= this.MAX_REGISTER_ATTEMPTS) {
          console.error('[runner] Max registration attempts reached, giving up');
          process.exit(1);
        }

        const delay = Math.min(5000 * Math.pow(2, this.registerAttempts - 1), 60000);
        setTimeout(attemptRegister, delay);
      }
    };

    await attemptRegister();
  }

  /**
   * Start heartbeat loop
   */
  startHeartbeat(): void {
    if (!this.runnerId) return;

    const sendHeartbeat = async () => {
      const url = `${config.platform.url}/api/v1/runners/${this.runnerId}/heartbeat`;

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(config.runner.apiToken ? { 'Authorization': `Bearer ${config.runner.apiToken}` } : {}),
          },
          signal: AbortSignal.timeout(config.platform.timeout),
        });

        if (!response.ok) {
          console.warn(`[runner] Heartbeat failed: HTTP ${response.status}`);
        }
      } catch (error) {
        console.warn(`[runner] Heartbeat error: ${(error as Error).message}`);
      }
    };

    sendHeartbeat();
    this.heartbeatTimer = setInterval(sendHeartbeat, config.runner.heartbeatInterval);
  }

  /**
   * Stop heartbeat
   */
  stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Execute a job
   */
  async executeJob(jobId: string, task: { type: string; parameters?: TaskParameters }): Promise<TaskResult> {
    this.activeJobs++;

    // Create isolated workspace per job (sandbox isolation)
    const workspaceDir = join(tmpdir(), `orion-workspace-${jobId}-${Date.now()}`);
    try {
      await mkdir(workspaceDir, { recursive: true });
    } catch {
      // Fallback to default if mkdir fails
    }

    try {
      const params: TaskParameters = {
        ...task.parameters,
        workingDir: workspaceDir,
      };

      // Execute the task
      const result = await this.runTask(task.type, params);

      // Report result to Platform
      this.reportJobResult(jobId, result).catch((err) => {
        console.error(`[runner] Failed to report job result: ${err.message}`);
      });

      return result;
    } finally {
      this.activeJobs--;
      // Workspace cleanup: let OS reclaim on reboot
      // For production, add a periodic cleanup cron
    }
  }

  /**
   * Run a task based on its type
   */
  private async runTask(type: string, params: TaskParameters): Promise<TaskResult> {
    const startTime = Date.now();

    try {
      const { spawn } = await import('child_process');

      const { command, args } = this.buildCommand(type, params);
      const stdout: string[] = [];
      const stderr: string[] = [];

      const child = spawn(command, args, {
        timeout: 300000, // 5 min default timeout
        cwd: params.workingDir,
        shell: false,
        maxBuffer: 10 * 1024 * 1024, // 10MB
      });

      child.stdout?.on('data', (data: Buffer) => stdout.push(data.toString()));
      child.stderr?.on('data', (data: Buffer) => stderr.push(data.toString()));

      const exitCode = await new Promise<number>((resolve, reject) => {
        child.on('close', (code) => resolve(code ?? -1));
        child.on('error', reject);
      });

      return {
        success: exitCode === 0,
        stdout: stdout.join(''),
        stderr: stderr.join(''),
        exitCode,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        stdout: '',
        stderr: (error as Error).message,
        exitCode: -1,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Build shell command based on task type
   * Returns command + args array for safe spawn() usage
   */
  private buildCommand(type: string, params: TaskParameters): { command: string; args: string[] } {
    const cmd = params.command as string | undefined;
    if (cmd) {
      // For shell commands, run through /bin/sh with the command as single argument
      return { command: '/bin/sh', args: ['-c', cmd] };
    }

    const commandMap: Record<string, { command: string; args: string[] }> = {
      shell: { command: '/bin/sh', args: ['-c', (params.script as string) || 'echo "No script provided"'] },
      npm: { command: 'npm', args: ((params.args as string) || 'run build').split(' ') },
      test: { command: '/bin/sh', args: ['-c', (params.command as string) || 'npm test'] },
      build: { command: '/bin/sh', args: ['-c', (params.command as string) || 'npm run build'] },
    };

    return commandMap[type] || { command: 'echo', args: [`"Unknown task type: ${type}"`] };
  }

  /**
   * Report job result to Platform
   */
  private async reportJobResult(jobId: string, result: TaskResult): Promise<void> {
    if (!this.runnerId) return;

    const url = `${config.platform.url}/api/v1/runners/${this.runnerId}/jobs/${jobId}/result`;

    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.runner.apiToken ? { 'Authorization': `Bearer ${config.runner.apiToken}` } : {}),
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
      signal: AbortSignal.timeout(config.platform.timeout),
    });
  }
}
