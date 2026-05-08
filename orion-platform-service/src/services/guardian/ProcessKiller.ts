import pino from 'pino';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
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

  private async dockerCommand(containerId: string, command: string): Promise<void> {
    try {
      const { stdout } = await execAsync(`docker ${command} ${containerId}`);
      logger.info({ containerId, command, stdout: stdout.trim() }, `Docker ${command} completed`);
    } catch (error) {
      logger.error({ containerId, command, error }, `Docker ${command} failed`);
      throw error;
    }
  }
}
