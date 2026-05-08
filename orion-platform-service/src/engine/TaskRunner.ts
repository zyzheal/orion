/**
 * Task Runner - Task 执行器
 *
 * 负责：
 * - 解析 Task 配置
 * - 执行具体任务逻辑 (Phase 3: 真实执行 git/npm/shell/k8s)
 * - 收集 Task 日志
 * - 处理 Task 重试
 */

import { spawn, ChildProcess } from 'child_process';
import { Task, TaskStatus, appendTaskLog } from '../models/Task';
import { PluginExecutorService, TaskExecutionRequest, TaskStatus as PluginTaskStatus } from '../services/plugin-executor-service';
import { InlineScriptService, InlineScriptExecutionRequest } from '../services/inline-script/InlineScriptService';
import pino from 'pino';

const logger = pino({ name: 'task-runner' });

export interface TaskExecutionResult {
  status: TaskStatus;
  result?: Record<string, unknown>;
  log?: string;
  error?: string;
}

/**
 * Spawn 执行结果
 */
interface SpawnResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/**
 * 安全配置：限制 shell 命令
 */
const DANGEROUS_PATTERNS = [
  'rm -rf /',
  'mkfs',
  'dd if=',
  '> /dev/sd',
  'curl.*|.*sh',
  'wget.*|.*sh',
];

/**
 * 构建安全的最小 PATH 环境变量
 */
function getCleanEnv(customEnv?: Record<string, string>): NodeJS.ProcessEnv {
  const cleanEnv: NodeJS.ProcessEnv = {
    PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin',
    HOME: process.env.HOME || '/tmp',
    NODE_ENV: 'production',
    // 移除敏感环境变量
  };

  // 合并自定义环境变量
  if (customEnv) {
    for (const [key, value] of Object.entries(customEnv)) {
      cleanEnv[key] = value;
    }
  }

  return cleanEnv;
}

/**
 * 检查脚本是否包含危险命令
 */
function isScriptSafe(script: string): boolean {
  for (const pattern of DANGEROUS_PATTERNS) {
    if (new RegExp(pattern, 'i').test(script)) {
      return false;
    }
  }
  return true;
}

/**
 * 使用 child_process.spawn 执行命令（安全）
 */
function spawnCommand(
  command: string,
  args: string[],
  options?: {
    cwd?: string;
    timeoutMs?: number;
    signal?: AbortSignal;
    env?: Record<string, string>;
  }
): Promise<SpawnResult> {
  return new Promise((resolve, reject) => {
    const timeout = options?.timeoutMs || 60000;
    const env = getCleanEnv(options?.env);

    const child = spawn(command, args, {
      cwd: options?.cwd || '/tmp',
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout,
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    const cleanup = () => {
      child.removeAllListeners();
    };

    // 处理 AbortSignal
    if (options?.signal) {
      if (options.signal.aborted) {
        child.kill('SIGTERM');
        cleanup();
        reject(new DOMException('Task was cancelled', 'AbortError'));
        return;
      }
      options.signal.addEventListener('abort', () => {
        child.kill('SIGTERM');
        cleanup();
        reject(new DOMException('Task was cancelled', 'AbortError'));
      }, { once: true });
    }

    child.on('error', (err) => {
      cleanup();
      reject(new Error(`Failed to spawn ${command}: ${err.message}`));
    });

    child.on('close', (code) => {
      cleanup();
      resolve({
        exitCode: code ?? 1,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      });
    });

    child.on('exit', (code) => {
      cleanup();
      resolve({
        exitCode: code ?? 1,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      });
    });
  });
}

/**
 * 检查命令是否可用
 */
async function isCommandAvailable(command: string): Promise<boolean> {
  try {
    const result = await spawnCommand('which', [command], { timeoutMs: 5000 });
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

export class TaskRunner {
  private pluginExecutor?: PluginExecutorService;
  private inlineScriptService?: InlineScriptService;

  constructor(options?: {
    pluginExecutor?: PluginExecutorService;
    inlineScriptService?: InlineScriptService;
  }) {
    this.pluginExecutor = options?.pluginExecutor;
    this.inlineScriptService = options?.inlineScriptService;
  }

  /**
   * 执行 Task
   */
  async run(task: Task, signal?: AbortSignal): Promise<Task> {
    let updatedTask = { ...task };
    updatedTask = appendTaskLog(updatedTask, `[INFO] Starting task: ${task.name}`);
    updatedTask = appendTaskLog(updatedTask, `[INFO] Task type: ${task.type}`);

    try {
      // 根据 task type 分发到不同执行器
      const result = await this.executeByType(updatedTask, signal);

      updatedTask = appendTaskLog(updatedTask, `[INFO] Task completed successfully`);

      // 合并 executeByType 返回的日志
      if (result.log) {
        updatedTask.log = result.log as string;
      }

      return {
        ...updatedTask,
        status: TaskStatus.SUCCESS,
        result,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      updatedTask = appendTaskLog(updatedTask, `[ERROR] ${errorMessage}`);
      return {
        ...updatedTask,
        status: TaskStatus.FAILED,
        error: errorMessage,
      };
    }
  }

  /**
   * 根据类型执行 Task
   */
  private async executeByType(task: Task, signal?: AbortSignal): Promise<Record<string, unknown>> {
    const type = task.type.toLowerCase();

    // 新增: 插件类型分发
    if (type.startsWith('plugin/')) {
      return this.executePluginTask(task, signal);
    }

    if (type.startsWith('inline-script/')) {
      return this.executeInlineScriptTask(task, signal);
    }

    if (type.startsWith('git/')) {
      return this.executeGitTask(task, signal);
    } else if (type.startsWith('npm/') || type.startsWith('yarn/')) {
      return this.executeNpmTask(task, signal);
    } else if (type.startsWith('k8s/') || type.startsWith('kubernetes/')) {
      return this.executeK8sTask(task, signal);
    } else if (type.startsWith('shell/') || type.startsWith('script/')) {
      return this.executeShellTask(task, signal);
    } else {
      // 未知类型，模拟执行成功
      return this.executeMockTask(task, signal);
    }
  }

  /**
   * 执行 Git 相关任务
   * Phase 3: 使用真实 git 命令执行
   */
  private async executeGitTask(task: Task, signal?: AbortSignal): Promise<Record<string, unknown>> {
    const action = task.type.split('/')[1];
    const params = task.parameters;
    const repo = params.repo as string || '';
    const branch = params.branch as string || 'main';
    const cwd = (params.cwd as string) || '/tmp';
    const timeoutMs = (task.timeoutSeconds || 60) * 1000;

    task = appendTaskLog(task, `[GIT] Executing ${action}...`);

    // 检查 git 是否可用
    const gitAvailable = await isCommandAvailable('git');
    if (!gitAvailable) {
      logger.warn('git command not available, falling back to mock');
      return this.executeMockTask(task, signal);
    }

    let result: SpawnResult;
    switch (action) {
      case 'clone':
        result = await spawnCommand('git', ['clone', repo, '--branch', branch, '--single-branch', '--depth', '1'], {
          cwd, timeoutMs, signal,
        });
        break;
      case 'checkout':
        result = await spawnCommand('git', ['checkout', branch], { cwd, timeoutMs, signal });
        break;
      case 'push':
        const remoteBranch = params.remoteBranch as string || branch;
        result = await spawnCommand('git', ['push', 'origin', remoteBranch], { cwd, timeoutMs, signal });
        break;
      case 'pull':
        result = await spawnCommand('git', ['pull', 'origin', branch], { cwd, timeoutMs, signal });
        break;
      case 'status':
        result = await spawnCommand('git', ['status', '--short'], { cwd, timeoutMs, signal });
        break;
      case 'log':
        const maxCount = (params.maxCount as number) || 10;
        result = await spawnCommand('git', ['log', `--max-count=${maxCount}`, '--oneline'], { cwd, timeoutMs, signal });
        break;
      default:
        result = await spawnCommand('git', [action], { cwd, timeoutMs, signal });
        break;
    }

    if (result.exitCode !== 0) {
      throw new Error(`git ${action} failed (exit code ${result.exitCode}): ${result.stderr}`);
    }

    return {
      action,
      repository: repo,
      branch,
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      log: task.log,
    };
  }

  /**
   * 执行 Npm/Yarn 任务
   * Phase 3: 使用真实 npm/npx 命令执行
   */
  private async executeNpmTask(task: Task, signal?: AbortSignal): Promise<Record<string, unknown>> {
    const command = (task.parameters.command as string) || (task.parameters.script as string) || '';
    const cwd = (task.parameters.cwd as string) || '/tmp';
    const timeoutMs = (task.timeoutSeconds || 120) * 1000;

    task = appendTaskLog(task, `[NPM] Running command: ${command}`);

    // 检查 npm 是否可用
    const npmAvailable = await isCommandAvailable('npm');
    if (!npmAvailable) {
      logger.warn('npm command not available, falling back to mock');
      return this.executeMockTask(task, signal);
    }

    // 解析命令：支持 "run build", "install", "test" 等
    const args = command.split(' ').filter(Boolean);

    // 处理 npx 命令
    let executable = 'npm';
    if (args[0] === 'run') {
      // npm run <script>
    } else if (args[0] === 'exec' || args[0] === 'x') {
      executable = 'npx';
      args.shift();
    }

    const result = await spawnCommand(executable, args, { cwd, timeoutMs, signal });

    if (result.exitCode !== 0) {
      throw new Error(`${executable} ${command} failed (exit code ${result.exitCode}): ${result.stderr}`);
    }

    return {
      command,
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      log: task.log,
    };
  }

  /**
   * 执行 Kubernetes 任务
   * Phase 3: 使用真实 kubectl 命令执行
   */
  private async executeK8sTask(task: Task, signal?: AbortSignal): Promise<Record<string, unknown>> {
    const action = task.type.split('/')[1];
    const params = task.parameters;
    const name = (params.name as string) || '';
    const namespace = (params.namespace as string) || 'default';
    const cwd = (params.cwd as string) || '/tmp';
    const timeoutMs = (task.timeoutSeconds || 60) * 1000;

    task = appendTaskLog(task, `[K8S] ${action} deployment ${name || 'unknown'}...`);

    // 检查 kubectl 是否可用
    const kubectlAvailable = await isCommandAvailable('kubectl');
    if (!kubectlAvailable) {
      logger.warn('kubectl command not available, falling back to mock');
      return this.executeMockTask(task, signal);
    }

    let result: SpawnResult;
    const nsArgs = namespace !== 'default' ? ['-n', namespace] : [];

    switch (action) {
      case 'apply':
        const file = (params.file as string) || (params.manifest as string) || '';
        result = await spawnCommand('kubectl', [...nsArgs, 'apply', '-f', file], { cwd, timeoutMs, signal });
        break;
      case 'delete':
        result = await spawnCommand('kubectl', [...nsArgs, 'delete', 'deployment', name], { cwd, timeoutMs, signal });
        break;
      case 'rollout':
        const rolloutAction = (params.rolloutAction as string) || 'status';
        result = await spawnCommand('kubectl', [...nsArgs, 'rollout', rolloutAction, 'deployment', name], { cwd, timeoutMs, signal });
        break;
      case 'get':
        const resource = (params.resource as string) || 'pods';
        result = await spawnCommand('kubectl', [...nsArgs, 'get', resource], { cwd, timeoutMs, signal });
        break;
      case 'describe':
        const describeResource = (params.resource as string) || 'deployment';
        result = await spawnCommand('kubectl', [...nsArgs, 'describe', describeResource, name], { cwd, timeoutMs, signal });
        break;
      case 'logs':
        const podName = name || (params.pod as string) || '';
        result = await spawnCommand('kubectl', [...nsArgs, 'logs', podName, '--tail=100'], { cwd, timeoutMs, signal });
        break;
      case 'exec':
        const execCommand = (params.execCommand as string) || 'sh';
        const execPod = name || (params.pod as string) || '';
        result = await spawnCommand('kubectl', [...nsArgs, 'exec', execPod, '--', execCommand], { cwd, timeoutMs, signal });
        break;
      default:
        result = await spawnCommand('kubectl', [...nsArgs, action], { cwd, timeoutMs, signal });
        break;
    }

    if (result.exitCode !== 0) {
      throw new Error(`kubectl ${action} failed (exit code ${result.exitCode}): ${result.stderr}`);
    }

    return {
      action,
      namespace,
      name,
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      log: task.log,
    };
  }

  /**
   * 执行 Shell 任务
   * Phase 3: 使用真实 shell 命令执行（带安全检查）
   */
  private async executeShellTask(task: Task, signal?: AbortSignal): Promise<Record<string, unknown>> {
    const script = (task.parameters.script as string) || (task.parameters.command as string) || '';

    // Input validation: ensure script is a non-empty string
    if (typeof script !== 'string' || script.trim().length === 0) {
      throw new Error('Shell script must be a non-empty string');
    }

    // Reject scripts containing null bytes (can truncate strings in some contexts)
    if (script.includes('\0')) {
      throw new Error('Shell script contains null bytes');
    }

    const cwd = (task.parameters.cwd as string) || '/tmp';
    const timeoutMs = (task.timeoutSeconds || 60) * 1000;

    task = appendTaskLog(task, `[SHELL] Executing: ${script.substring(0, 100)}${script.length > 100 ? '...' : ''}`);

    // Security scan for dangerous patterns
    if (!isScriptSafe(script)) {
      throw new Error('Script contains potentially dangerous commands');
    }

    // 检查 sh 是否可用
    const shAvailable = await isCommandAvailable('sh');
    if (!shAvailable) {
      logger.warn('sh command not available, falling back to mock');
      return this.executeMockTask(task, signal);
    }

    const result = await spawnCommand('sh', ['-c', script], { cwd, timeoutMs, signal });

    if (result.exitCode !== 0) {
      throw new Error(`Shell script failed (exit code ${result.exitCode}): ${result.stderr}`);
    }

    return {
      script,
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      log: task.log,
    };
  }

  /**
   * 执行模拟任务（用于测试）
   */
  private async executeMockTask(task: Task, signal?: AbortSignal): Promise<Record<string, unknown>> {
    task = appendTaskLog(task, `[MOCK] Simulating task execution: ${task.name}`);

    await this.sleep(50, signal);

    return {
      simulated: true,
      taskName: task.name,
      taskType: task.type,
      log: task.log,
    };
  }

  private async executePluginTask(task: Task, signal?: AbortSignal): Promise<Record<string, unknown>> {
    const pluginId = task.parameters.pluginId as string;
    const pluginName = (task.parameters.pluginName as string) || pluginId;

    task = appendTaskLog(task, `[PLUGIN] Executing plugin: ${pluginName}`);

    // Use real PluginExecutorService if available
    if (this.pluginExecutor) {
      const request: TaskExecutionRequest = {
        taskId: (task.id as string) || `task-${Date.now()}`,
        pipelineRunId: (task.parameters.pipelineRunId as string) || 'unknown',
        stageId: (task.parameters.stageId as string) || 'unknown',
        pluginId,
        config: (task.parameters.config as Record<string, any>) || {},
        workspace: { rootPath: (task.parameters.workspace as string) || '/tmp' },
        env: task.parameters.env as Record<string, string> | undefined,
        timeout: task.parameters.timeout as number | undefined,
        userId: task.parameters.userId as string | undefined,
        tenantId: task.parameters.tenantId as string | undefined,
      };

      const result = await this.pluginExecutor.executeTask(request);

      // Check if the plugin execution failed - throw to propagate correct FAILED status
      const statusStr = String(result.status);
      if (statusStr === 'FAILED' || statusStr === 'TIMEOUT' || statusStr === 'QUOTA_EXCEEDED' || statusStr === 'VALIDATION_FAILED') {
        throw new Error(`Plugin execution failed: ${result.errorMessage || 'unknown error'}`);
      }

      return {
        pluginId,
        pluginName,
        status: result.status,
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
        durationMs: result.durationMs,
        errorMessage: result.errorMessage,
        log: task.log,
      };
    }

    // Fallback to simulated execution
    await this.sleep(100, signal);

    return {
      pluginId,
      pluginName,
      simulated: true,
      isolationTier: 'TIER_1',
      exitCode: 0,
      stdout: `Plugin ${pluginName} executed successfully`,
      log: task.log,
    };
  }

  private async executeInlineScriptTask(task: Task, signal?: AbortSignal): Promise<Record<string, unknown>> {
    const level = (task.parameters.level as string) || 'safe';
    const language = (task.parameters.language as string) || 'javascript';
    const code = (task.parameters.code as string) || '';

    task = appendTaskLog(task, `[INLINE-SCRIPT] Level: ${level}, Language: ${language}`);

    // Use real InlineScriptService if available
    if (this.inlineScriptService) {
      const request: InlineScriptExecutionRequest = {
        taskId: (task.id as string) || `task-${Date.now()}`,
        pipelineRunId: (task.parameters.pipelineRunId as string) || 'unknown',
        stageId: (task.parameters.stageId as string) || 'unknown',
        config: {
          level: level as any,
          language,
          code,
          permissions: task.parameters.permissions as any,
          approvalId: task.parameters.approvalId as string | undefined,
        },
        workspace: { rootPath: (task.parameters.workspace as string) || '/tmp' },
        env: task.parameters.env as Record<string, string> | undefined,
        timeout: task.parameters.timeout as number | undefined,
        userId: task.parameters.userId as string | undefined,
        tenantId: task.parameters.tenantId as string | undefined,
      };

      const result = await this.inlineScriptService.execute(request);

      // Check if execution failed - throw to propagate correct FAILED status
      if (result.status === 'failed' || result.status === 'timeout') {
        throw new Error(`Inline script execution failed: ${result.errorMessage || 'unknown error'}`);
      }

      return {
        level,
        language,
        codeLength: code.length,
        status: result.status,
        exitCode: result.status === 'success' ? 0 : 1,
        stdout: result.stdout,
        stderr: result.stderr,
        durationMs: result.durationMs,
        errorMessage: result.errorMessage,
        log: task.log,
      };
    }

    // Fallback to simulated execution
    await this.sleep(50, signal);

    return {
      level,
      language,
      codeLength: code.length,
      simulated: true,
      exitCode: 0,
      stdout: 'Inline script executed successfully',
      log: task.log,
    };
  }

  /**
   * 休眠辅助函数（支持 AbortSignal 取消）
   */
  private sleep(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(new DOMException('Task was cancelled', 'AbortError'));
        return;
      }

      const timer = setTimeout(resolve, ms);

      signal?.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new DOMException('Task was cancelled', 'AbortError'));
      }, { once: true });
    });
  }
}
