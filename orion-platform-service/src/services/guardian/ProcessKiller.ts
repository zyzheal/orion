import pino from 'pino';
import { spawn } from 'child_process';
import { OrionError } from '../../errors';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

interface ProcessInfo {
  taskId: string;
  pid: number;
  pgid?: number;  // Process group ID
  containerId?: string;
}

export class ProcessKiller {
  private processes: Map<string, ProcessInfo> = new Map();

  register(processInfo: ProcessInfo): void {
    this.processes.set(processInfo.taskId, processInfo);
  }

  unregister(taskId: string): void {
    this.processes.delete(taskId);
  }

  async kill(taskId: string, reason: string): Promise<void> {
    const processInfo = this.processes.get(taskId);
    if (!processInfo) {
      logger.warn({ taskId }, 'Process not found, nothing to kill');
      return;
    }

    logger.info({ taskId, pid: processInfo.pid, reason }, 'Starting process kill sequence');

    // Phase 1: SIGTERM to process group (prevents orphan children)
    logger.info({ taskId }, 'Phase 1: Giving SIGTERM to process group');
    try {
      const targetPid = processInfo.pgid || processInfo.pid;
      // Negative PID means process group
      process.kill(-targetPid, 'SIGTERM');
    } catch {
      // Fallback to single process
      try {
        process.kill(processInfo.pid, 'SIGTERM');
      } catch {
        logger.warn({ taskId }, 'SIGTERM failed, process may already be dead');
      }
    }

    await this.waitForExit(processInfo.pid, 5000);

    if (this.isAlive(processInfo.pid)) {
      // Phase 2: SIGKILL to process group
      logger.warn({ taskId }, 'Phase 2: SIGTERM ignored, sending SIGKILL to process group');
      try {
        const targetPid = processInfo.pgid || processInfo.pid;
        process.kill(-targetPid, 'SIGKILL');
      } catch {
        try {
          process.kill(processInfo.pid, 'SIGKILL');
        } catch {
          logger.warn({ taskId }, 'SIGKILL failed');
        }
      }

      await this.waitForExit(processInfo.pid, 2000);

      if (this.isAlive(processInfo.pid) && processInfo.containerId) {
        // Phase 3: Container freeze and kill (real implementation)
        logger.error({ taskId, containerId: processInfo.containerId }, 'Phase 3: Freezing and killing container');
        try {
          await this.dockerCommand(processInfo.containerId, 'pause');
          await this.dockerCommand(processInfo.containerId, 'kill');
        } catch (error) {
          logger.error({ taskId, error }, 'Container kill failed');
        }
      }
    }

    this.processes.delete(taskId);
  }

  private isAlive(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  private waitForExit(pid: number, timeoutMs: number): Promise<void> {
    return new Promise((resolve) => {
      const start = Date.now();
      const check = setInterval(() => {
        if (!this.isAlive(pid) || Date.now() - start > timeoutMs) {
          clearInterval(check);
          resolve();
        }
      }, 100);
    });
  }

  private dockerCommand(containerId: string, command: string, timeoutMs: number = 10000): Promise<void> {
    // Validate containerId to prevent injection via malformed IDs
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(containerId)) {
      throw new OrionError('VALIDATION_ERROR', `Invalid container ID: ${containerId}`)
    }
    // Validate command to prevent arbitrary docker subcommand execution
    const allowedCommands = new Set(['pause', 'unpause', 'kill', 'stop', 'rm']);
    if (!allowedCommands.has(command)) {
      throw new OrionError('VALIDATION_ERROR', `Invalid docker command: ${command}`)
    }
    return new Promise((resolve, reject) => {
      const child = spawn('docker', [command, containerId], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      // SRE: Timeout to prevent indefinite hang if Docker daemon is unresponsive
      const timer = setTimeout(() => {
        try { child.kill('SIGKILL'); } catch { /* already dead */ }
        reject(new Error(`docker ${command} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      child.stdout.on('data', (data) => { stdout += data.toString(); });
      child.stderr.on('data', (data) => { stderr += data.toString(); });

      child.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0) {
          logger.info({ containerId, command, stdout: stdout.trim() }, `Docker ${command} completed`);
          resolve();
        } else {
          logger.error({ containerId, command, code, stderr: stderr.trim() }, `Docker ${command} failed`);
          reject(new Error(`docker ${command} exited with code ${code}: ${stderr.trim()}`));
        }
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        logger.error({ containerId, command, error: err.message }, `Docker ${command} failed to spawn`);
        reject(err);
      });
    });
  }
}
