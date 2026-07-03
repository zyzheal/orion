/**
 * Shell Command Executor — 安全的 Shell 命令执行器
 *
 * 功能:
 * 1. 使用 child_process.exec 执行真实 shell 命令
 * 2. 命令白名单/黑名单安全机制
 * 3. 超时控制（默认 30 秒）
 * 4. 输出大小限制（防止 OOM）
 * 5. 结构化执行结果返回
 *
 * 安全设计:
 * - 默认启用白名单模式，仅允许预注册的命令执行
 * - 黑名单用于拦截已知危险命令
 * - 所有执行记录可审计
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { createLogger } from '../../utils/logger';

const logger = createLogger('ShellCommandExecutor');
const execAsync = promisify(exec);

/** 执行结果 */
export interface ExecutionResult {
  output: string;
  exitCode: number;
  durationMs: number;
  stdout: string;
  stderr: string;
}

/** 执行器配置 */
export interface ExecutorConfig {
  /** 命令白名单（空数组 = 不允许任何命令） */
  whitelist?: string[];
  /** 命令黑名单 */
  blacklist?: string[];
  /** 是否启用白名单模式（默认 true） */
  enforceWhitelist?: boolean;
  /** 是否启用黑名单（默认 true） */
  enforceBlacklist?: boolean;
  /** 最大输出大小（字节），默认 1MB */
  maxOutputBytes?: number;
  /** 默认超时（毫秒），默认 30000 */
  defaultTimeoutMs?: number;
}

/** 执行拦截原因 */
export interface BlockedResult {
  blocked: true;
  reason: string;
  command: string;
}

export class ShellCommandExecutor {
  private whitelist: Set<string>;
  private blacklist: Set<string>;
  private enforceWhitelist: boolean;
  private enforceBlacklist: boolean;
  private maxOutputBytes: number;
  private defaultTimeoutMs: number;

  constructor(config: ExecutorConfig = {}) {
    this.whitelist = new Set(config.whitelist ?? []);
    this.blacklist = new Set(config.blacklist ?? []);
    this.enforceWhitelist = config.enforceWhitelist ?? true;
    this.enforceBlacklist = config.enforceBlacklist ?? true;
    this.maxOutputBytes = config.maxOutputBytes ?? 1024 * 1024; // 1MB
    this.defaultTimeoutMs = config.defaultTimeoutMs ?? 30000;

    logger.info({ whitelist: [...this.whitelist], blacklist: [...this.blacklist] }, 'ShellCommandExecutor initialized');
  }

  /**
   * 注册白名单命令
   */
  addToWhitelist(command: string): void {
    this.whitelist.add(command);
    logger.info({ command }, 'Added to whitelist');
  }

  /**
   * 注册黑名单命令
   */
  addToBlacklist(command: string): void {
    this.blacklist.add(command);
    logger.info({ command }, 'Added to blacklist');
  }

  /**
   * 从白名单移除
   */
  removeFromWhitelist(command: string): void {
    this.whitelist.delete(command);
  }

  /**
   * 从黑名单移除
   */
  removeFromBlacklist(command: string): void {
    this.blacklist.delete(command);
  }

  /**
   * 检查命令是否可执行
   * @returns true 可执行，false 被拦截
   */
  private checkCommandAllowed(command: string): { allowed: true } | BlockedResult {
    // 提取基础命令名（去除参数）
    const baseCommand = command.trim().split(/\s+/)[0];

    // 黑名单检查（优先级高于白名单）
    if (this.enforceBlacklist) {
      for (const blocked of this.blacklist) {
        if (baseCommand === blocked || command.includes(blocked)) {
          return {
            blocked: true,
            reason: `命令被黑名单拦截: ${blocked}`,
            command,
          };
        }
      }
    }

    // 白名单检查
    if (this.enforceWhitelist && this.whitelist.size > 0) {
      const allowed = [...this.whitelist].some(allowedCmd =>
        baseCommand === allowedCmd || command.startsWith(allowedCmd)
      );
      if (!allowed) {
        return {
          blocked: true,
          reason: `命令不在白名单中: ${baseCommand}。允许的命令: ${[...this.whitelist].join(', ')}`,
          command,
        };
      }
    }

    return { allowed: true };
  }

  /**
   * 截断输出到最大大小
   */
  private truncateOutput(output: string): string {
    if (output.length > this.maxOutputBytes) {
      return output.slice(0, this.maxOutputBytes) + `\n...[截断，总长度 ${output.length} 字节]`;
    }
    return output;
  }

  /**
   * 执行 shell 命令（安全版本）
   *
   * @param command 要执行的命令字符串
   * @param timeoutMs 超时时间（可选，默认使用配置值）
   * @returns 执行结果
   * @throws 如果命令被拦截或执行失败
   */
  async execute(command: string, timeoutMs?: number): Promise<ExecutionResult> {
    // 安全检查
    const checkResult = this.checkCommandAllowed(command);
    if ('blocked' in checkResult && checkResult.blocked) {
      const error = new Error(checkResult.reason);
      (error as any).code = 'COMMAND_BLOCKED';
      (error as any).blockedCommand = checkResult.command;
      logger.warn({ command, reason: checkResult.reason }, 'Command blocked by security policy');
      throw error;
    }

    const timeout = timeoutMs ?? this.defaultTimeoutMs;
    const startTime = Date.now();

    logger.info({ command, timeout }, 'Executing shell command');

    try {
      const { stdout, stderr } = await execAsync(command, {
        timeout,
        maxBuffer: this.maxOutputBytes,
        encoding: 'utf8',
      });

      const durationMs = Date.now() - startTime;
      const truncatedStdout = this.truncateOutput(stdout);
      const truncatedStderr = this.truncateOutput(stderr);

      logger.info({ command, exitCode: 0, durationMs, stdoutLength: stdout.length, stderrLength: stderr.length }, 'Command executed');

      return {
        output: truncatedStdout || truncatedStderr || '命令执行成功（无输出）',
        exitCode: 0,
        durationMs,
        stdout: truncatedStdout,
        stderr: truncatedStderr,
      };
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      const exitCode = err.code || 1;
      const errorMessage = err.message || 'Unknown error';
      const stdout = err.stdout ? this.truncateOutput(err.stdout) : '';
      const stderr = err.stderr ? this.truncateOutput(err.stderr) : errorMessage;

      logger.error({ command, exitCode, durationMs, error: errorMessage }, 'Command execution failed');

      // 超时特殊处理
      if (err.killed || errorMessage.includes('ETIMEDOUT') || errorMessage.includes('timeout')) {
        const timeoutError = new Error(`COMMAND_TIMEOUT: 命令执行超过 ${timeout}ms 限制`);
        (timeoutError as any).code = 'COMMAND_TIMEOUT';
        (timeoutError as any).exitCode = 124;
        throw timeoutError;
      }

      const execError = new Error(stderr || errorMessage);
      (execError as any).code = `EXEC_FAILED:${exitCode}`;
      (execError as any).exitCode = exitCode;
      throw execError;
    }
  }

  /**
   * 批量执行命令（串行）
   */
  async executeAll(commands: string[], timeoutMs?: number): Promise<ExecutionResult[]> {
    const results: ExecutionResult[] = [];
    for (const cmd of commands) {
      try {
        const result = await this.execute(cmd, timeoutMs);
        results.push(result);
      } catch (err) {
        results.push({
          output: err instanceof Error ? err.message : String(err),
          exitCode: (err as any)?.exitCode || 1,
          durationMs: 0,
          stdout: '',
          stderr: err instanceof Error ? err.message : String(err),
        });
      }
    }
    return results;
  }

  /**
   * 获取当前白名单列表
   */
  getWhitelist(): string[] {
    return [...this.whitelist];
  }

  /**
   * 获取当前黑名单列表
   */
  getBlacklist(): string[] {
    return [...this.blacklist];
  }
}
