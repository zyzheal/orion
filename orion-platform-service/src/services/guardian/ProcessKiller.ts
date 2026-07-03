import { createLogger } from '../utils/logger';
import { spawn } from 'child_process';
import { OrionError } from '../../errors';
import { ProcessRegistryRepository } from '../../repositories/ProcessRegistryRepository';
import { v4 as uuidv4 } from 'uuid';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

interface ProcessInfo {
  taskId: string;
  pid: number;
  pgid?: number;
  containerId?: string;
}

export class ProcessKiller {
  private repository: ProcessRegistryRepository;

  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    if (!db) {
      throw new Error('ProcessKiller requires a database connection');
    }
    this.repository = new ProcessRegistryRepository(db);
  }

  register(processInfo: ProcessInfo): void {
    this.repository.create({
      id: uuidv4(),
      taskId: processInfo.taskId,
      pid: processInfo.pid,
      pgid: processInfo.pgid ?? null,
      containerId: processInfo.containerId ?? null,
      status: 'active',
    }).catch((err) => {
      logger.warn({ err, taskId: processInfo.taskId }, 'Failed to persist process registration');
    });
  }

  unregister(taskId: string): void {
    this.repository.deleteByTaskId(taskId).catch((err) => {
      logger.warn({ err, taskId }, 'Failed to delete process from DB');
    });
  }

  async kill(taskId: string, reason: string): Promise<void> {
    let processInfo: ProcessInfo | undefined;

    const entity = await this.repository.findByTaskId(taskId);
    if (entity) {
      processInfo = {
        taskId: entity.taskId,
        pid: entity.pid,
        pgid: entity.pgid ?? undefined,
        containerId: entity.containerId ?? undefined,
      };
    }

    if (!processInfo) {
      logger.warn({ taskId }, 'Process not found, nothing to kill');
      return;
    }

    logger.info({ taskId, pid: processInfo.pid, reason }, 'Starting process kill sequence');

    // Phase 1: SIGTERM to process group (prevents orphan children)
    logger.info({ taskId }, 'Phase 1: Giving SIGTERM to process group');
    try {
      const targetPid = processInfo.pgid || processInfo.pid;
      process.kill(-targetPid, 'SIGTERM');
    } catch {
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

    // Mark as killed in DB
    this.repository.markKilled(taskId).catch((err) => {
      logger.warn({ err, taskId }, 'Failed to mark process as killed in DB');
    });
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
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(containerId)) {
      throw new OrionError(`Invalid container ID: ${containerId}`, 'VALIDATION_ERROR')
    }
    const allowedCommands = new Set(['pause', 'unpause', 'kill', 'stop', 'rm']);
    if (!allowedCommands.has(command)) {
      throw new OrionError(`Invalid docker command: ${command}`, 'VALIDATION_ERROR')
    }
    return new Promise((resolve, reject) => {
      const child = spawn('docker', [command, containerId], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

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
