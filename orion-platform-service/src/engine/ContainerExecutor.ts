/**
 * ContainerExecutor — 容器化构建执行策略
 *
 * 提供可插拔的构建执行环境：
 * - LocalSpawnExecutor: 本地进程执行（默认）
 * - DockerExecutor: Docker 容器执行（环境隔离）
 * - 可扩展 KubernetesExecutor 等后端
 */

import { spawn, ChildProcess } from 'child_process';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createLogger } from '../utils/logger';

const logger = pino({ name: 'container-executor' });
const execAsync = promisify(exec);

/**
 * 容器规格
 */
export interface ContainerSpec {
  /** 容器镜像 */
  image: string;
  /** 工作目录 */
  workdir?: string;
  /** 环境变量 */
  env?: Record<string, string>;
  /** 资源限制 */
  resources?: {
    cpu?: string;
    memory?: string;
    /** GPU 设备（Docker: --gpus, K8s: nvidia.com/gpu） */
    gpu?: {
      /** GPU 设备标识，如 "all", "0", "device=GPU-uuid" */
      devices?: string;
      /** GPU 能力要求，如 ['compute', 'utility'] */
      capabilities?: string[];
    };
  };
  /** 挂载点 */
  volumes?: Array<{
    hostPath: string;
    containerPath: string;
    readOnly?: boolean;
  }>;
  /** 网络模式 */
  network?: 'host' | 'bridge' | 'none';
  /** 命令 */
  command?: string[];
}

/**
 * 执行结果
 */
export interface ContainerExecutionResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  containerId?: string;
}

/**
 * 容器执行策略接口
 */
export interface ContainerExecutorStrategy {
  /**
   * 在容器中执行命令
   */
  execute(
    spec: ContainerSpec,
    command: string,
    args: string[],
    timeoutMs?: number
  ): Promise<ContainerExecutionResult>;

  /**
   * 检查执行器是否可用
   */
  isAvailable(): Promise<boolean>;
}

/**
 * 本地进程执行器（默认策略）
 */
export class LocalSpawnExecutor implements ContainerExecutorStrategy {
  async execute(
    spec: ContainerSpec,
    command: string,
    args: string[],
    timeoutMs = 30 * 60 * 1000
  ): Promise<ContainerExecutionResult> {
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        cwd: spec.workdir || process.cwd(),
        env: { ...process.env, ...(spec.env || {}) },
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: timeoutMs,
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      child.on('error', (err) => {
        reject(new Error(`Failed to spawn: ${err.message}`));
      });

      child.on('close', (code) => {
        resolve({
          exitCode: code ?? 1,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          durationMs: Date.now() - startTime,
        });
      });
    });
  }

  async isAvailable(): Promise<boolean> {
    return true; // Always available
  }
}

/**
 * Docker 容器执行器
 */
export class DockerExecutor implements ContainerExecutorStrategy {
  async execute(
    spec: ContainerSpec,
    command: string,
    args: string[],
    timeoutMs = 30 * 60 * 1000
  ): Promise<ContainerExecutionResult> {
    const startTime = Date.now();

    // 检查 docker 是否可用
    const available = await this.isAvailable();
    if (!available) {
      return {
        exitCode: 1,
        stdout: '',
        stderr: 'Docker is not available',
        durationMs: Date.now() - startTime,
      };
    }

    // 构建 docker run 命令
    const dockerArgs = this.buildDockerArgs(spec, command, args);

    try {
      const { stdout, stderr } = await execAsync(
        `docker ${dockerArgs.join(' ')}`,
        { timeout: timeoutMs, maxBuffer: 1024 * 1024 * 50 }
      );

      return {
        exitCode: 0,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const exitCodeMatch = errorMessage.match(/exit code (\d+)/);
      const exitCode = exitCodeMatch ? parseInt(exitCodeMatch[1], 10) : 1;

      return {
        exitCode,
        stdout: '',
        stderr: errorMessage,
        durationMs: Date.now() - startTime,
      };
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      await execAsync('docker info', { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 构建 docker run 参数
   */
  private buildDockerArgs(spec: ContainerSpec, command: string, args: string[]): string[] {
    const dockerArgs: string[] = ['run', '--rm'];

    // 工作目录
    const workdir = spec.workdir || '/workspace';
    dockerArgs.push('-w', workdir);

    // 资源限制
    if (spec.resources?.cpu) {
      dockerArgs.push('--cpus', spec.resources.cpu);
    }
    if (spec.resources?.memory) {
      dockerArgs.push('--memory', spec.resources.memory);
    }
    // GPU 资源分配
    if (spec.resources?.gpu) {
      const gpuArgs = [`--gpus`];
      const parts: string[] = [];
      if (spec.resources.gpu.devices) {
        parts.push(`device=${spec.resources.gpu.devices}`);
      }
      if (spec.resources.gpu.capabilities && spec.resources.gpu.capabilities.length > 0) {
        parts.push(spec.resources.gpu.capabilities.join(','));
      }
      dockerArgs.push('--gpus', parts.length > 0 ? parts.join(',') : 'all');
    }

    // 环境变量
    if (spec.env) {
      for (const [key, value] of Object.entries(spec.env)) {
        dockerArgs.push('-e', `${key}=${value}`);
      }
    }

    // 挂载卷
    if (spec.volumes) {
      for (const vol of spec.volumes) {
        const mode = vol.readOnly ? ':ro' : ':rw';
        dockerArgs.push('-v', `${vol.hostPath}:${vol.containerPath}${mode}`);
      }
    }

    // 网络模式
    if (spec.network) {
      dockerArgs.push('--network', spec.network);
    }

    // 镜像
    dockerArgs.push(spec.image);

    // 命令
    if (command) {
      dockerArgs.push(command, ...args);
    }

    return dockerArgs;
  }
}

/**
 * 创建容器执行器工厂函数
 * 根据类型返回对应的执行器实例
 */
export function createContainerExecutor(
  type: 'local' | 'docker',
  options?: { dockerImage?: string }
): ContainerExecutorStrategy {
  switch (type) {
    case 'docker':
      return new DockerExecutor();
    case 'local':
    default:
      return new LocalSpawnExecutor();
  }
}
