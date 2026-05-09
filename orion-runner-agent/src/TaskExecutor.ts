/**
 * TaskExecutor — 实际执行 CI 任务的引擎
 *
 * 支持的 Task 类型：
 * - shell — 执行 shell 命令
 * - script — 执行脚本文件
 * - docker-build — 构建 Docker 镜像
 * - docker-run — 运行 Docker 容器
 * - test — 运行测试（本质上是 shell）
 * - deploy — 部署操作（shell + kubectl 等）
 * - notify — 发送通知
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const execAsync = promisify(exec);

/**
 * 安全校验：允许的字符范围（字母、数字、连字符、下划线、点、斜杠）
 * 防止命令注入和路径穿越
 */
function safeString(value: string, label: string): string {
  if (!/^[a-zA-Z0-9._\/:-]+$/.test(value)) {
    throw new Error(`Invalid ${label}: "${value}" contains unsafe characters`);
  }
  return value;
}

export interface TaskParameters {
  command?: string;
  script?: string;
  workingDir?: string;
  env?: Record<string, string>;
  timeout?: number;
  image?: string;
  dockerfile?: string;
  context?: string;
  tag?: string;
  [key: string]: unknown;
}

export interface TaskResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
  artifacts?: string[];
}

export class TaskExecutor {
  /**
   * 执行一个任务
   */
  async execute(type: string, params: TaskParameters): Promise<TaskResult> {
    const startTime = Date.now();

    try {
      switch (type) {
        case 'shell':
        case 'test':
        case 'deploy':
          return await this.executeShell(params, startTime);

        case 'script':
          return await this.executeScript(params, startTime);

        case 'docker-build':
          return await this.executeDockerBuild(params, startTime);

        case 'docker-run':
          return await this.executeDockerRun(params, startTime);

        case 'notify':
          return await this.executeNotify(params, startTime);

        default:
          return this.failResult(`Unknown task type: ${type}`, startTime);
      }
    } catch (error) {
      return this.errorResult(error, startTime);
    }
  }

  /**
   * 执行 Shell 命令
   */
  private async executeShell(params: TaskParameters, startTime: number): Promise<TaskResult> {
    const command = params.command;
    if (!command) {
      return this.failResult('No command specified', startTime);
    }

    const timeout = params.timeout || 300000; // 5 分钟默认
    const workingDir = params.workingDir || process.cwd();
    const env = { ...process.env, ...params.env };

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: workingDir,
        env,
        timeout,
        maxBuffer: 10 * 1024 * 1024, // 10MB
      });

      return {
        success: true,
        stdout: stdout.toString(),
        stderr: stderr.toString(),
        exitCode: 0,
        duration: Date.now() - startTime,
      };
    } catch (error: any) {
      const stdout = error.stdout?.toString() || '';
      const stderr = error.stderr?.toString() || '';
      const exitCode = error.code === 'TIMEOUT' ? 124 : (error.status || 1);

      return {
        success: false,
        stdout,
        stderr: stderr || error.message,
        exitCode,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * 执行脚本文件
   */
  private async executeScript(params: TaskParameters, startTime: number): Promise<TaskResult> {
    const script = params.script;
    if (!script) {
      return this.failResult('No script specified', startTime);
    }

    const workingDir = params.workingDir || process.cwd();
    const timeout = params.timeout || 300000;

    // Write script to a temp file
    const tmpDir = mkdtempSync(join(tmpdir(), 'orion-runner-'));
    const scriptPath = join(tmpDir, 'script.sh');

    try {
      writeFileSync(scriptPath, script, { mode: 0o755 });

      const { stdout, stderr } = await execAsync(`bash ${scriptPath}`, {
        cwd: workingDir,
        timeout,
        maxBuffer: 10 * 1024 * 1024,
      });

      return {
        success: true,
        stdout: stdout.toString(),
        stderr: stderr.toString(),
        exitCode: 0,
        duration: Date.now() - startTime,
      };
    } catch (error: any) {
      const stdout = error.stdout?.toString() || '';
      const stderr = error.stderr?.toString() || '';
      const exitCode = error.code === 'TIMEOUT' ? 124 : (error.status || 1);

      return {
        success: false,
        stdout,
        stderr: stderr || error.message,
        exitCode,
        duration: Date.now() - startTime,
      };
    } finally {
      try {
        rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        // cleanup best effort
      }
    }
  }

  /**
   * Docker 构建
   */
  private async executeDockerBuild(params: TaskParameters, startTime: number): Promise<TaskResult> {
    const dockerfile = safeString(params.dockerfile || 'Dockerfile', 'dockerfile');
    const context = safeString(params.context || '.', 'context');
    const tag = safeString(params.tag || `orion-build-${uuidv4().slice(0, 8)}`, 'tag');
    const timeout = params.timeout || 600000; // 10 分钟

    const command = `docker build -f ${dockerfile} -t ${tag} ${context}`;

    return this.executeShell({ command, timeout, env: params.env }, startTime);
  }

  /**
   * Docker 运行
   */
  private async executeDockerRun(params: TaskParameters, startTime: number): Promise<TaskResult> {
    const image = params.image;
    if (!image) {
      return this.failResult('No docker image specified', startTime);
    }

    const command = `docker run --rm ${image}`;
    const timeout = params.timeout || 300000;

    return this.executeShell({ command, timeout, env: params.env }, startTime);
  }

  /**
   * 发送通知（占位实现）
   */
  private async executeNotify(params: TaskParameters, startTime: number): Promise<TaskResult> {
    const message = (params.message as string) || (params.command as string) || 'Notification sent';

    // 实际项目中可接入 Slack、钉钉、飞书等
    console.log(`[notify] ${message}`);

    return {
      success: true,
      stdout: message,
      stderr: '',
      exitCode: 0,
      duration: Date.now() - startTime,
    };
  }

  // ==================== Helpers ====================

  private failResult(message: string, startTime: number): TaskResult {
    return {
      success: false,
      stdout: '',
      stderr: message,
      exitCode: 1,
      duration: Date.now() - startTime,
    };
  }

  private errorResult(error: unknown, startTime: number): TaskResult {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      stdout: '',
      stderr: message,
      exitCode: -1,
      duration: Date.now() - startTime,
    };
  }
}
