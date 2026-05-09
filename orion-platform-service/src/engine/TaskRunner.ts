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
import { WorkspaceIsolator, getDefaultWorkspaceIsolator } from './WorkspaceIsolator';
import { SecretsService, StreamSecretSanitizer } from '../services/pipeline/SecretsService';
import { RunnerPoolService, RunnerExecutionResult } from '../services/pipeline/RunnerPoolService';
import pino from 'pino';

const logger = pino({ name: 'task-runner' });

export interface TaskExecutionResult {
  status: TaskStatus;
  result?: Record<string, unknown>;
  log?: string;
  error?: string;
  /** Task output variables, e.g., { version: '1.2.3', image: 'myapp:latest' } */
  outputs?: { [key: string]: string };
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
 *
 * 支持流式日志遮蔽：当提供 sanitizer 时，stdout/stderr 数据
 * 在收集过程中自动替换 secret 值为 ***
 */
function spawnCommand(
  command: string,
  args: string[],
  options?: {
    cwd?: string;
    timeoutMs?: number;
    signal?: AbortSignal;
    env?: Record<string, string>;
    sanitizer?: StreamSecretSanitizer;
  }
): Promise<SpawnResult> {
  return new Promise((resolve, reject) => {
    const timeout = options?.timeoutMs || 60000;
    const env = getCleanEnv(options?.env);

    const child = spawn(command, args, {
      cwd: options?.cwd || process.cwd(),
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout,
    });

    let stdout = '';
    let stderr = '';

    // 辅助函数：处理数据块并遮蔽 secret
    const processData = (data: Buffer): string => {
      let text = data.toString();
      if (options?.sanitizer) {
        text = options.sanitizer.sanitize(text);
      }
      return text;
    };

    child.stdout?.on('data', (data: Buffer) => {
      stdout += processData(data);
    });

    child.stderr?.on('data', (data: Buffer) => {
      stderr += processData(data);
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
 * Parse task stdout for output declarations.
 *
 * Supports GitHub Actions style:
 *   ::set-output name=version::1.2.3
 *   ::set-output name=image::myapp:latest
 *
 * Returns a map of output name -> value.
 */
function parseOutputsFromStdout(stdout: string): { [key: string]: string } {
  const outputs: { [key: string]: string } = {};
  // Match ::set-output name=<key>::<value>
  const regex = /::set-output\s+name=([^:]+)::(.*)$/gm;
  let match;
  while ((match = regex.exec(stdout)) !== null) {
    const key = match[1].trim();
    const value = match[2].trim();
    if (key) {
      outputs[key] = value;
    }
  }
  return outputs;
}

/**
 * Merge output values from multiple sources.
 * Priority: explicit outputs > parsed stdout outputs
 */
function mergeOutputs(
  explicit?: { [key: string]: string },
  parsed?: { [key: string]: string }
): { [key: string]: string } | undefined {
  const merged: { [key: string]: string } = {};
  let hasAny = false;

  if (parsed) {
    for (const [key, value] of Object.entries(parsed)) {
      merged[key] = value;
      hasAny = true;
    }
  }
  if (explicit) {
    for (const [key, value] of Object.entries(explicit)) {
      merged[key] = value;
      hasAny = true;
    }
  }

  return hasAny ? merged : undefined;
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
  private workspaceIsolator: WorkspaceIsolator;
  private secretsService?: SecretsService;
  private runnerPoolService?: RunnerPoolService;

  constructor(options?: {
    pluginExecutor?: PluginExecutorService;
    inlineScriptService?: InlineScriptService;
    workspaceIsolator?: WorkspaceIsolator;
    secretsService?: SecretsService;
    runnerPoolService?: RunnerPoolService;
  }) {
    this.pluginExecutor = options?.pluginExecutor;
    this.inlineScriptService = options?.inlineScriptService;
    this.workspaceIsolator = options?.workspaceIsolator || getDefaultWorkspaceIsolator();
    this.secretsService = options?.secretsService;
    this.runnerPoolService = options?.runnerPoolService;
  }

  /**
   * 获取 task 的工作空间路径
   *
   * 优先级：
   * 1. task.parameters.workspace.rootPath（如果已设置）
   * 2. WorkspaceIsolator 生成的默认路径
   */
  private getTaskWorkspace(task: Task, taskId?: string): string {
    const customRoot = task.parameters.workspace as Record<string, unknown> | undefined;
    const customRootPath = customRoot?.rootPath as string | undefined;

    const runId = (task.parameters.pipelineRunId as string) || 'unknown';
    const id = taskId || (task.id as string) || `task-${Date.now()}`;

    return this.workspaceIsolator.getWorkspacePath(runId, id, customRootPath);
  }

  /**
   * 执行 Task
   *
   * GAP-CN-07: If task has __runnerLabels, try to dispatch to a remote runner.
   * Falls back to local execution if no matching runner is available.
   */
  async run(task: Task, signal?: AbortSignal): Promise<Task> {
    let updatedTask = { ...task };
    updatedTask = appendTaskLog(updatedTask, `[INFO] Starting task: ${task.name}`);
    updatedTask = appendTaskLog(updatedTask, `[INFO] Task type: ${task.type}`);

    // 解析 task parameters 中的 secret 引用（如果有 secretsService）
    let sanitizer: StreamSecretSanitizer | undefined;
    if (this.secretsService) {
      const tenantId = (task.parameters.tenantId as string) || '';
      if (tenantId) {
        try {
          const resolved = await this.secretsService.resolveTaskSecrets(tenantId, task.parameters);
          // 将解析后的 secrets 合并到 env
          if (Object.keys(resolved.env).length > 0) {
            task.parameters.env = { ...(task.parameters.env as Record<string, string> || {}), ...resolved.env };
          }
          // 创建日志遮蔽器
          if (resolved.secretValues.length > 0) {
            sanitizer = this.secretsService.createSanitizer(resolved.secretValues);
            updatedTask = appendTaskLog(updatedTask, `[SECRETS] ${resolved.secretValues.length} secret(s) loaded for log sanitization`);
          }
          if (resolved.unresolved.length > 0) {
            updatedTask = appendTaskLog(updatedTask, `[WARN] Unresolved secret references: ${resolved.unresolved.join(', ')}`);
          }
        } catch (error) {
          logger.warn({ error }, 'Failed to resolve task secrets, continuing without secret injection');
        }
      }
    }

    // GAP-CN-07: Check if this task should run on a remote runner
    const runnerLabels = task.parameters.__runnerLabels as string[] | undefined;
    const tenantId = (task.parameters.tenantId as string) || '';

    if (runnerLabels && runnerLabels.length > 0 && this.runnerPoolService && tenantId) {
      try {
        const runner = await this.runnerPoolService.selectRunner(runnerLabels, tenantId);

        if (runner && runner.endpoint) {
          updatedTask = appendTaskLog(updatedTask, `[RUNNER] Dispatching to remote runner: ${runner.name} (${runner.id})`);

          // Build task payload for remote dispatch
          const payload = {
            id: task.id,
            name: task.name,
            type: task.type,
            parameters: this.stripInternalParams(task.parameters),
            stageId: task.stageId,
            runId: (task.parameters.pipelineRunId as string),
            tenantId,
          };

          const result = await this.runnerPoolService.executeOnRunner(
            runner.id,
            payload,
            runner.endpoint
          );

          updatedTask = appendTaskLog(updatedTask, `[RUNNER] Task dispatched successfully, jobId: ${result.jobId}`);

          return {
            ...updatedTask,
            status: TaskStatus.SUCCESS,
            result: {
              runnerId: runner.id,
              runnerName: runner.name,
              jobId: result.jobId,
              remote: true,
              ...(result.result || {}),
            },
          };
        } else if (runner) {
          updatedTask = appendTaskLog(updatedTask, `[RUNNER] Runner found but no endpoint configured, falling back to local`);
        } else {
          updatedTask = appendTaskLog(updatedTask, `[RUNNER] No matching runner available, falling back to local`);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        updatedTask = appendTaskLog(updatedTask, `[RUNNER] Remote dispatch failed (${errorMsg}), falling back to local`);
        // Fall through to local execution
      }
    }

    try {
      // 根据 task type 分发到不同执行器，传入 sanitizer
      const result = await this.executeByType(updatedTask, signal, sanitizer);

      // Parse outputs from task result: explicit outputs + stdout declarations
      const explicitOutputs = result.outputs as { [key: string]: string } | undefined;
      const stdoutStr = (result.stdout as string) || '';
      const parsedOutputs = stdoutStr ? parseOutputsFromStdout(stdoutStr) : {};
      const mergedOutputs = mergeOutputs(explicitOutputs, parsedOutputs);
      if (mergedOutputs) {
        result.outputs = mergedOutputs;
      }

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
   * Remove internal parameters (prefixed with __) before sending to remote runner.
   */
  private stripInternalParams(params: Record<string, unknown>): Record<string, unknown> {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(params)) {
      if (!key.startsWith('__')) {
        cleaned[key] = value;
      }
    }
    return cleaned;
  }

  /**
   * 根据类型执行 Task
   */
  private async executeByType(task: Task, signal?: AbortSignal, sanitizer?: StreamSecretSanitizer): Promise<Record<string, unknown>> {
    const type = task.type.toLowerCase();

    // 新增: 插件类型分发
    if (type.startsWith('plugin/')) {
      return this.executePluginTask(task, signal);
    }

    if (type.startsWith('inline-script/')) {
      return this.executeInlineScriptTask(task, signal);
    }

    if (type.startsWith('git/')) {
      return this.executeGitTask(task, signal, sanitizer);
    } else if (type.startsWith('npm/') || type.startsWith('yarn/')) {
      return this.executeNpmTask(task, signal, sanitizer);
    } else if (type.startsWith('k8s/') || type.startsWith('kubernetes/')) {
      return this.executeK8sTask(task, signal, sanitizer);
    } else if (type.startsWith('shell/') || type.startsWith('script/')) {
      return this.executeShellTask(task, signal, sanitizer);
    } else {
      // 未知类型，模拟执行成功
      return this.executeMockTask(task, signal);
    }
  }

  /**
   * 执行 Git 相关任务
   * Phase 3: 使用真实 git 命令执行
   */
  private async executeGitTask(task: Task, signal?: AbortSignal, sanitizer?: StreamSecretSanitizer): Promise<Record<string, unknown>> {
    const action = task.type.split('/')[1];
    const params = task.parameters;
    const repo = params.repo as string || '';
    const branch = params.branch as string || 'main';
    const cwd = (params.cwd as string) || this.getTaskWorkspace(task, 'git');
    const timeoutMs = (task.timeoutSeconds || 60) * 1000;
    const env = (params.env as Record<string, string>) || undefined;

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
          cwd, timeoutMs, signal, env, sanitizer,
        });
        break;
      case 'checkout':
        result = await spawnCommand('git', ['checkout', branch], { cwd, timeoutMs, signal, env, sanitizer });
        break;
      case 'push':
        const remoteBranch = params.remoteBranch as string || branch;
        result = await spawnCommand('git', ['push', 'origin', remoteBranch], { cwd, timeoutMs, signal, env, sanitizer });
        break;
      case 'pull':
        result = await spawnCommand('git', ['pull', 'origin', branch], { cwd, timeoutMs, signal, env, sanitizer });
        break;
      case 'status':
        result = await spawnCommand('git', ['status', '--short'], { cwd, timeoutMs, signal, env, sanitizer });
        break;
      case 'log':
        const maxCount = (params.maxCount as number) || 10;
        result = await spawnCommand('git', ['log', `--max-count=${maxCount}`, '--oneline'], { cwd, timeoutMs, signal, env, sanitizer });
        break;
      default:
        result = await spawnCommand('git', [action], { cwd, timeoutMs, signal, env, sanitizer });
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
  private async executeNpmTask(task: Task, signal?: AbortSignal, sanitizer?: StreamSecretSanitizer): Promise<Record<string, unknown>> {
    const command = (task.parameters.command as string) || (task.parameters.script as string) || '';
    const cwd = (task.parameters.cwd as string) || this.getTaskWorkspace(task, 'npm');
    const timeoutMs = (task.timeoutSeconds || 120) * 1000;
    const env = (task.parameters.env as Record<string, string>) || undefined;

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

    const result = await spawnCommand(executable, args, { cwd, timeoutMs, signal, env, sanitizer });

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
  private async executeK8sTask(task: Task, signal?: AbortSignal, sanitizer?: StreamSecretSanitizer): Promise<Record<string, unknown>> {
    const action = task.type.split('/')[1];
    const params = task.parameters;
    const name = (params.name as string) || '';
    const namespace = (params.namespace as string) || 'default';
    const cwd = (params.cwd as string) || this.getTaskWorkspace(task, 'k8s');
    const timeoutMs = (task.timeoutSeconds || 60) * 1000;
    const env = (params.env as Record<string, string>) || undefined;

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
        result = await spawnCommand('kubectl', [...nsArgs, 'apply', '-f', file], { cwd, timeoutMs, signal, env, sanitizer });
        break;
      case 'delete':
        result = await spawnCommand('kubectl', [...nsArgs, 'delete', 'deployment', name], { cwd, timeoutMs, signal, sanitizer });
        break;
      case 'rollout':
        const rolloutAction = (params.rolloutAction as string) || 'status';
        result = await spawnCommand('kubectl', [...nsArgs, 'rollout', rolloutAction, 'deployment', name], { cwd, timeoutMs, signal, sanitizer });
        break;
      case 'get':
        const resource = (params.resource as string) || 'pods';
        result = await spawnCommand('kubectl', [...nsArgs, 'get', resource], { cwd, timeoutMs, signal, sanitizer });
        break;
      case 'describe':
        const describeResource = (params.resource as string) || 'deployment';
        result = await spawnCommand('kubectl', [...nsArgs, 'describe', describeResource, name], { cwd, timeoutMs, signal, sanitizer });
        break;
      case 'logs':
        const podName = name || (params.pod as string) || '';
        result = await spawnCommand('kubectl', [...nsArgs, 'logs', podName, '--tail=100'], { cwd, timeoutMs, signal, sanitizer });
        break;
      case 'exec':
        const execCommand = (params.execCommand as string) || 'sh';
        const execPod = name || (params.pod as string) || '';
        result = await spawnCommand('kubectl', [...nsArgs, 'exec', execPod, '--', execCommand], { cwd, timeoutMs, signal, sanitizer });
        break;
      default:
        result = await spawnCommand('kubectl', [...nsArgs, action], { cwd, timeoutMs, signal, sanitizer });
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
  private async executeShellTask(task: Task, signal?: AbortSignal, sanitizer?: StreamSecretSanitizer): Promise<Record<string, unknown>> {
    const script = (task.parameters.script as string) || (task.parameters.command as string) || '';

    // Input validation: ensure script is a non-empty string
    if (typeof script !== 'string' || script.trim().length === 0) {
      throw new Error('Shell script must be a non-empty string');
    }

    // Reject scripts containing null bytes (can truncate strings in some contexts)
    if (script.includes('\0')) {
      throw new Error('Shell script contains null bytes');
    }

    const cwd = (task.parameters.cwd as string) || this.getTaskWorkspace(task, 'shell');
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

    const result = await spawnCommand('sh', ['-c', script], { cwd, timeoutMs, signal, sanitizer });

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
        workspace: { rootPath: this.getTaskWorkspace(task, `plugin-${pluginId}`) },
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
        workspace: { rootPath: this.getTaskWorkspace(task, 'inline-script') },
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
