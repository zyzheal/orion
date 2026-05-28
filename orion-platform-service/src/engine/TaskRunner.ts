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
import { DockerBuildService, DockerBuildOptions, DockerPushOptions, DockerScanOptions } from '../services/pipeline/DockerBuildService';
import { BuildxBuilderService, BuildOptions } from '../services/build/BuildxBuilderService';
import { ContainerSpec, DockerExecutor, LocalSpawnExecutor, ContainerExecutorStrategy } from './ContainerExecutor';
import { SkillService } from '../services/skill/SkillService';
import { SkillPackage, SkillVersion } from '../services/skill/SkillRepository';
import { OrionError, ErrorCode } from '../errors';
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
 * Skill 运行时配置
 *
 * 定义 Skill 任务的执行方式，支持多种运行时后端：
 * - Docker: 容器化执行（隔离性最强）
 * - Script: 脚本执行（shell/python/node 等）
 * - API: HTTP API 调用（外部服务集成）
 * - Builtin: 内置服务调用（平台原生能力）
 */
interface SkillRuntimeConfig {
  taskType: string;
  docker?: {
    image: string;
    command?: string;
    env?: Record<string, string>;
    resources?: { cpu?: string; memory?: string };
  };
  script?: {
    interpreter: string;
    content?: string;
  };
  api?: {
    endpoint: string;
    method: string;
  };
  builtin?: {
    service: string;
    action: string;
  };
  timeout?: number;
  retryPolicy?: { maxRetries: number; backoffMs: number };
}

/**
 * Skill 任务定义
 *
 * 用于 Pipeline 中声明式调用 Skill 任务。
 * 支持通过 skillId 查找 Skill，通过 instanceId 获取预配置实例，
 * 最终由 Skill 的 schema 中定义的 runtime 配置决定实际执行方式。
 */
interface SkillTaskDefinition {
  type: 'skill';
  skillId: string;
  skillVersion?: string;
  instanceId?: string;
  capability: string;  // SkillCapability type
  input: Record<string, any>;
  timeout?: number;
  retryPolicy?: { maxRetries: number; backoffMs: number };
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
      reject(new OrionError(`Failed to spawn ${command}: ${err.message}`, ErrorCode.OPERATION_FAILED));
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
  private skillService?: SkillService;

  constructor(options?: {
    pluginExecutor?: PluginExecutorService;
    inlineScriptService?: InlineScriptService;
    workspaceIsolator?: WorkspaceIsolator;
    secretsService?: SecretsService;
    runnerPoolService?: RunnerPoolService;
    skillService?: SkillService;
  }) {
    this.pluginExecutor = options?.pluginExecutor;
    this.inlineScriptService = options?.inlineScriptService;
    this.workspaceIsolator = options?.workspaceIsolator || getDefaultWorkspaceIsolator();
    this.secretsService = options?.secretsService;
    this.runnerPoolService = options?.runnerPoolService;
    this.skillService = options?.skillService;
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

    if (type === 'skill' || type.startsWith('skill/')) {
      return this.executeSkillTaskEntry(task, signal);
    }

    if (type.startsWith('git/')) {
      return this.executeGitTask(task, signal, sanitizer);
    } else if (type.startsWith('docker/')) {
      return this.executeDockerTask(task, signal);
    } else if (type.startsWith('npm/') || type.startsWith('yarn/')) {
      return this.executeNpmTask(task, signal, sanitizer);
    } else if (type.startsWith('k8s/') || type.startsWith('kubernetes/')) {
      return this.executeK8sTask(task, signal, sanitizer);
    } else if (type.startsWith('test/')) {
      return this.executeTestTask(task, signal);
    } else if (type.startsWith('shell/') || type.startsWith('script/')) {
      return this.executeShellTask(task, signal, sanitizer);
    } else if (type.startsWith('container/')) {
      return this.executeContainerTask(task, signal);
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
      throw new OrionError(`git ${action} failed (exit code ${result.exitCode}): ${result.stderr}`, ErrorCode.OPERATION_FAILED);
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
   * 执行 Docker 相关任务
   * 支持 docker/build, docker/push, docker/scan 类型
   */
  private async executeDockerTask(task: Task, signal?: AbortSignal): Promise<Record<string, unknown>> {
    const action = task.type.split('/')[1];
    const params = task.parameters;
    const dockerService = new DockerBuildService();

    task = appendTaskLog(task, `[DOCKER] Action: ${action}`);

    switch (action) {
      case 'build':
        return this.executeDockerBuild(task, dockerService);
      case 'push':
        return this.executeDockerPush(task, dockerService);
      case 'scan':
        return this.executeDockerScan(task, dockerService);
      case 'buildx':
        return this.executeDockerBuildx(task);
      default:
        throw new OrionError(`Unknown docker action: ${action}`, ErrorCode.VALIDATION_ERROR);
    }
  }

  private async executeDockerBuild(task: Task, dockerService: DockerBuildService): Promise<Record<string, unknown>> {
    const params = task.parameters;
    const options: DockerBuildOptions = {
      context: (params.context as string) || this.getTaskWorkspace(task, 'docker'),
      dockerfile: params.dockerfile as string | undefined,
      imageName: params.image as string || params.imageName as string || '',
      tag: (params.tag as string) || 'latest',
      platforms: (params.platforms as string[]) || undefined,
      buildArgs: params.buildArgs as Record<string, string> | undefined,
      labels: params.labels as Record<string, string> | undefined,
      cacheFrom: params.cacheFrom as string | undefined,
      cacheTo: params.cacheTo as string | undefined,
      noCache: (params.noCache as boolean) || false,
      pull: (params.pull as boolean) || false,
      push: (params.push as boolean) || false,
      load: (params.load as boolean) || false,
      progress: (params.progress as 'auto' | 'plain' | 'tty') || 'plain',
      target: params.target as string | undefined,
      additionalTags: (params.additionalTags as string[]) || undefined,
    };

    if (!options.imageName) {
      throw new OrionError('Docker build requires "image" or "imageName" parameter', ErrorCode.VALIDATION_ERROR);
    }

    task = appendTaskLog(task, `[DOCKER] Building ${options.imageName}:${options.tag}`);

    const result = await dockerService.build(options);

    if (!result.success) {
      throw new OrionError(result.error || 'Docker build failed', ErrorCode.OPERATION_FAILED);
    }

    return {
      action: 'build',
      imageName: options.imageName,
      tag: options.tag,
      imageTag: result.imageTag,
      imageId: result.imageId,
      durationMs: result.durationMs,
      stdout: result.stdout,
      stderr: result.stderr,
      log: task.log,
      outputs: { image: result.imageTag, imageId: result.imageId || '' },
    };
  }

  private async executeDockerPush(task: Task, dockerService: DockerBuildService): Promise<Record<string, unknown>> {
    const params = task.parameters;
    const options: DockerPushOptions = {
      imageName: params.image as string || params.imageName as string || '',
      tag: (params.tag as string) || 'latest',
      additionalTags: (params.additionalTags as string[]) || undefined,
    };

    if (!options.imageName) {
      throw new OrionError('Docker push requires "image" or "imageName" parameter', ErrorCode.VALIDATION_ERROR);
    }

    task = appendTaskLog(task, `[DOCKER] Pushing ${options.imageName}:${options.tag}`);

    const result = await dockerService.push(options);

    if (!result.success) {
      throw new OrionError(result.error || 'Docker push failed', ErrorCode.OPERATION_FAILED);
    }

    return {
      action: 'push',
      imageName: options.imageName,
      pushedTags: result.pushedTags,
      durationMs: result.durationMs,
      stdout: result.stdout,
      stderr: result.stderr,
      log: task.log,
    };
  }

  private async executeDockerScan(task: Task, dockerService: DockerBuildService): Promise<Record<string, unknown>> {
    const params = task.parameters;
    const options: DockerScanOptions = {
      imageName: params.image as string || params.imageName as string || '',
      tag: (params.tag as string) || 'latest',
      scanner: (params.scanner as 'trivy' | 'docker-scout' | 'grype') || 'trivy',
      severityThreshold: (params.severityThreshold as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW') || 'HIGH',
      ignoreUnfixed: (params.ignoreUnfixed as boolean) || false,
    };

    if (!options.imageName) {
      throw new OrionError('Docker scan requires "image" or "imageName" parameter', ErrorCode.VALIDATION_ERROR);
    }

    task = appendTaskLog(task, `[DOCKER] Scanning ${options.imageName}:${options.tag}`);

    const result = await dockerService.scan(options);

    if (result.blocked) {
      throw new OrionError(`Security scan blocked: ${result.vulnerabilities.critical} critical, ${result.vulnerabilities.high} high vulnerabilities found`, ErrorCode.OPERATION_FAILED);
    }

    return {
      action: 'scan',
      scanner: result.scanner,
      vulnerabilities: result.vulnerabilities,
      blocked: result.blocked,
      durationMs: result.durationMs,
      stdout: result.stdout,
      stderr: result.stderr,
      log: task.log,
    };
  }

  /**
   * 执行 Docker Buildx 多架构构建任务
   * 使用 BuildxBuilderService.buildMultiArchNative 进行单次命令多平台构建
   */
  private async executeDockerBuildx(task: Task): Promise<Record<string, unknown>> {
    const params = task.parameters;
    const buildxService = new BuildxBuilderService();

    const platforms = (params.platforms as string[]) || [];
    if (platforms.length === 0) {
      throw new OrionError('docker/buildx requires "platforms" parameter (e.g., ["linux/amd64", "linux/arm64"])', ErrorCode.VALIDATION_ERROR);
    }

    const options: BuildOptions = {
      context: (params.context as string) || this.getTaskWorkspace(task, 'docker'),
      dockerfile: (params.dockerfile as string) || undefined,
      imageName: (params.image as string) || (params.imageName as string) || '',
      tags: (params.tags as string[]) || [(params.tag as string) || 'latest'],
      platforms,
      buildArgs: (params.buildArgs as Record<string, string>) || undefined,
      labels: (params.labels as Record<string, string>) || undefined,
      cacheFrom: (params.cacheFrom as string[]) || undefined,
      cacheTo: (params.cacheTo as string[]) || undefined,
      noCache: (params.noCache as boolean) || false,
      pull: (params.pull as boolean) || false,
      push: (params.push as boolean) || false,
      progress: (params.progress as 'auto' | 'plain' | 'tty') || 'plain',
    };

    if (!options.imageName) {
      throw new OrionError('docker/buildx requires "image" or "imageName" parameter', ErrorCode.VALIDATION_ERROR);
    }

    task = appendTaskLog(task, `[DOCKER] Buildx multi-arch build: ${options.imageName} for ${platforms.join(', ')}`);

    const result = await buildxService.buildMultiArchNative(options);

    if (!result.success) {
      throw new OrionError(`Buildx build failed: ${result.errors.join(', ')}`, ErrorCode.OPERATION_FAILED);
    }

    return {
      action: 'buildx',
      imageName: options.imageName,
      tags: options.tags,
      platforms: result.platforms,
      imageId: result.imageId,
      durationMs: result.duration,
      stdout: result.logs.join('\n'),
      stderr: result.errors.join('\n'),
      log: task.log,
      outputs: { image: `${options.imageName}:${options.tags[0]}`, platforms: platforms.join(',') },
    };
  }

  /**
   * 执行容器化任务
   * 支持 container/run@ step type，使用 Docker 容器隔离执行环境
   */
  private async executeContainerTask(task: Task, signal?: AbortSignal): Promise<Record<string, unknown>> {
    const params = task.parameters;
    const action = task.type.split('/')[1];

    const spec: ContainerSpec = {
      image: (params.image as string) || 'ubuntu:latest',
      workdir: (params.workdir as string) || '/workspace',
      env: (params.env as Record<string, string>) || undefined,
      resources: (params.resources as ContainerSpec['resources']) || undefined,
      volumes: (params.volumes as ContainerSpec['volumes']) || undefined,
      network: (params.network as ContainerSpec['network']) || 'bridge',
    };

    const command = (params.command as string[]) || ['sh', '-c', (params.script as string) || ''];
    const timeoutMs = (task.timeoutSeconds || 300) * 1000;

    task = appendTaskLog(task, `[CONTAINER] Action: ${action}, Image: ${spec.image}`);

    // 根据 action 选择执行策略
    let executor: ContainerExecutorStrategy;
    if (action === 'docker' || action === 'container') {
      executor = new DockerExecutor();
      if (!(await executor.isAvailable())) {
        task = appendTaskLog(task, `[CONTAINER] Docker not available, falling back to local`);
        executor = new LocalSpawnExecutor();
      }
    } else {
      executor = new LocalSpawnExecutor();
    }

    const startTime = Date.now();
    const result = await executor.execute(spec, command[0], command.slice(1), timeoutMs);
    const durationMs = Date.now() - startTime;

    if (result.exitCode !== 0) {
      throw new OrionError(`Container execution failed (exit code ${result.exitCode}): ${result.stderr}`, ErrorCode.OPERATION_FAILED);
    }

    return {
      action,
      image: spec.image,
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      durationMs,
      containerId: result.containerId,
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
      throw new OrionError(`${executable} ${command} failed (exit code ${result.exitCode}): ${result.stderr}`, ErrorCode.OPERATION_FAILED);
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
      throw new OrionError(`kubectl ${action} failed (exit code ${result.exitCode}): ${result.stderr}`, ErrorCode.OPERATION_FAILED);
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
   * 执行 Test 相关任务
   * 支持 test/unit, test/integration, test/e2e 类型
   */
  private async executeTestTask(task: Task, signal?: AbortSignal): Promise<Record<string, unknown>> {
    const action = task.type.split('/')[1];
    const params = task.parameters;
    const command = (params.command as string) || (params.script as string) || '';
    const cwd = (params.cwd as string) || this.getTaskWorkspace(task, 'test');
    const timeoutMs = (task.timeoutSeconds || 300) * 1000;
    const env = (params.env as Record<string, string>) || undefined;

    task = appendTaskLog(task, `[TEST] Type: ${action}, Command: ${command}`);

    // 检查命令是否可用
    const cmdAvailable = await isCommandAvailable('npm');
    if (!cmdAvailable) {
      logger.warn('npm command not available for test execution');
      return this.executeMockTask(task, signal);
    }

    // 解析命令并执行
    const args = command.split(' ').filter(Boolean);
    const result = await spawnCommand('npm', args, { cwd, timeoutMs, signal, env });

    // 解析测试输出中的统计信息
    const stats = this.parseTestOutput(result.stdout);

    if (result.exitCode !== 0) {
      return {
        action,
        command,
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
        testStats: stats,
        log: task.log,
        outputs: stats,
      };
    }

    return {
      action,
      command,
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      testStats: stats,
      log: task.log,
      outputs: stats,
    };
  }

  /**
   * 解析测试输出中的简单统计信息
   */
  private parseTestOutput(stdout: string): Record<string, string> {
    const outputs: Record<string, string> = {};

    // Jest style: "Tests:       10 passed, 10 total"
    const jestMatch = stdout.match(/(\d+)\s+passed.*?(\d+)\s+total/);
    if (jestMatch) {
      outputs.passed = jestMatch[1];
      outputs.total = jestMatch[2];
    }

    return outputs;
  }

  /**
   * 执行 Shell 任务
   * Phase 3: 使用真实 shell 命令执行（带安全检查）
   */
  private async executeShellTask(task: Task, signal?: AbortSignal, sanitizer?: StreamSecretSanitizer): Promise<Record<string, unknown>> {
    const script = (task.parameters.script as string) || (task.parameters.command as string) || '';

    // Input validation: ensure script is a non-empty string
    if (typeof script !== 'string' || script.trim().length === 0) {
      throw new OrionError('Shell script must be a non-empty string', ErrorCode.VALIDATION_ERROR);
    }

    // Reject scripts containing null bytes (can truncate strings in some contexts)
    if (script.includes('\0')) {
      throw new OrionError('Shell script contains null bytes', ErrorCode.VALIDATION_ERROR);
    }

    const cwd = (task.parameters.cwd as string) || this.getTaskWorkspace(task, 'shell');
    const timeoutMs = (task.timeoutSeconds || 60) * 1000;

    task = appendTaskLog(task, `[SHELL] Executing: ${script.substring(0, 100)}${script.length > 100 ? '...' : ''}`);

    // Security scan for dangerous patterns
    if (!isScriptSafe(script)) {
      throw new OrionError('Script contains potentially dangerous commands', ErrorCode.VALIDATION_ERROR);
    }

    // 检查 sh 是否可用
    const shAvailable = await isCommandAvailable('sh');
    if (!shAvailable) {
      logger.warn('sh command not available, falling back to mock');
      return this.executeMockTask(task, signal);
    }

    const result = await spawnCommand('sh', ['-c', script], { cwd, timeoutMs, signal, sanitizer });

    if (result.exitCode !== 0) {
      throw new OrionError(`Shell script failed (exit code ${result.exitCode}): ${result.stderr}`, ErrorCode.OPERATION_FAILED);
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
        throw new OrionError(`Plugin execution failed: ${result.errorMessage || 'unknown error'}`, ErrorCode.OPERATION_FAILED);
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
        throw new OrionError(`Inline script execution failed: ${result.errorMessage || 'unknown error'}`, ErrorCode.OPERATION_FAILED);
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
   * Skill 任务执行入口
   *
   * 将 Skill 集成到 Pipeline 任务体系中，作为 TaskRunner 的一种任务类型。
   * 支持通过 skillId 引用 Skill，通过 instanceId 使用预配置实例，
   * 根据 Skill 的 schema 中配置的 runtime 配置决定实际执行方式。
   *
   * 执行流程：
   * 1. 获取 Skill 信息并验证状态
   * 2. 版本校验（如果指定了 skillVersion）
   * 3. 获取实例配置（如果有 instanceId，合并实例配置与输入参数）
   * 4. 获取 capability 对应的 runtime 配置
   * 5. 通过 executeByRuntime 分发到具体执行器
   */
  private async executeSkillTaskEntry(task: Task, signal?: AbortSignal): Promise<Record<string, unknown>> {
    const params = task.parameters;
    const skillId = (params.skillId as string) || '';
    const skillVersion = (params.skillVersion as string) || undefined;
    const instanceId = (params.instanceId as string) || undefined;
    const capability = (params.capability as string) || '';
    const input = (params.input as Record<string, any>) || {};

    if (!skillId) {
      throw new OrionError('Skill task requires "skillId" parameter', ErrorCode.VALIDATION_ERROR);
    }
    if (!capability) {
      throw new OrionError('Skill task requires "capability" parameter', ErrorCode.VALIDATION_ERROR);
    }

    task = appendTaskLog(task, `[SKILL] Executing skill: ${skillId}`);
    if (skillVersion) {
      task = appendTaskLog(task, `[SKILL] Requested version: ${skillVersion}`);
    }
    if (instanceId) {
      task = appendTaskLog(task, `[SKILL] Using instance: ${instanceId}`);
    }
    task = appendTaskLog(task, `[SKILL] Capability: ${capability}`);

    // Delegate to the main execution method
    return this.executeSkillTask(
      { skillId, skillVersion, instanceId, capability, input },
      task
    );
  }

  /**
   * Skill 任务核心执行逻辑
   *
   * @param definition - Skill 任务定义
   * @param task - 当前 Pipeline Task（用于日志记录）
   * @returns 执行结果
   */
  private async executeSkillTask(
    definition: {
      skillId: string;
      skillVersion?: string;
      instanceId?: string;
      capability: string;
      input: Record<string, any>;
    },
    task: Task
  ): Promise<Record<string, unknown>> {
    const { skillId, skillVersion, instanceId, capability, input } = definition;

    // 1. 检查 SkillService 是否可用
    if (!this.skillService) {
      task = appendTaskLog(task, `[SKILL] SkillService not available, falling back to mock`);
      return this.executeMockTask(task);
    }

    // 2. 获取 Skill 信息
    const skill = await this.skillService.getSkill(skillId);
    task = appendTaskLog(task, `[SKILL] Found skill: ${skill.name} (v${skill.version})`);

    // 3. 版本验证：如果指定了版本，校验是否匹配
    // SkillPackage 使用 version 字段表示当前版本
    if (skillVersion && skill.version !== skillVersion) {
      // 尝试查找指定版本
      const versions = await this.skillService.getVersions(skillId);
      const versionExists = versions.some(v => v.version === skillVersion);
      if (!versionExists) {
        throw new OrionError(`Skill version ${skillVersion} not found for ${skill.name}`, ErrorCode.NOT_FOUND);
      }
      task = appendTaskLog(task, `[SKILL] Warning: Current skill version is ${skill.version}, requested ${skillVersion}`);
      // Note: In a full implementation, we would load the specific version's schema
    }

    // 4. 获取实例配置（如果有 instanceId）
    // 当前 SkillService 没有 instance 概念，此处预留扩展点
    let config = input;
    if (instanceId) {
      task = appendTaskLog(task, `[SKILL] Warning: Instance ${instanceId} not yet supported, using input directly`);
      // Future: const instance = await this.skillService.getInstance(instanceId);
      // config = { ...instance.config, ...input };
    }

    // 5. 获取 capability 对应的 runtime 配置
    // Skill 的 schema 中可能包含运行时配置，格式约定：
    // schema.runtimes[capability] = SkillRuntimeConfig
    // 或者 schema.runtime = SkillRuntimeConfig（单运行时）
    const runtime = this.extractRuntimeConfig(skill, capability);
    if (!runtime) {
      throw new OrionError(`Skill "${skill.name}" not configured for capability "${capability}"`, ErrorCode.VALIDATION_ERROR);
    }

    task = appendTaskLog(task, `[SKILL] Runtime type: ${runtime.taskType}`);

    // 6. 通过运行时分发器执行
    const startTime = Date.now();
    const result = await this.executeByRuntime(runtime, config, task);
    const durationMs = Date.now() - startTime;

    return {
      skillId,
      skillName: skill.name,
      skillVersion: skill.version,
      capability,
      runtimeType: runtime.taskType,
      durationMs,
      ...result,
      log: task.log,
    };
  }

  /**
   * 从 Skill 的 schema 中提取运行时配置
   *
   * 支持两种格式：
   * 1. schema.runtimes[capability] - 多运行时配置（按 capability 区分）
   * 2. schema.runtime - 单运行时配置（适用于所有 capability）
   */
  private extractRuntimeConfig(skill: SkillPackage, capability: string): SkillRuntimeConfig | null {
    const schema = skill.schema || {};

    // 尝试从 runtimes 中获取指定 capability 的运行时配置
    const runtimes = schema.runtimes as Record<string, SkillRuntimeConfig> | undefined;
    if (runtimes && runtimes[capability]) {
      return runtimes[capability];
    }

    // 尝试从 schema.capabilities[capability] 中获取
    const capabilities = schema.capabilities as Record<string, { runtime?: SkillRuntimeConfig }> | undefined;
    if (capabilities && capabilities[capability]?.runtime) {
      return capabilities[capability].runtime!;
    }

    // 回退到单运行时配置
    const singleRuntime = schema.runtime as SkillRuntimeConfig | undefined;
    if (singleRuntime) {
      return singleRuntime;
    }

    return null;
  }

  /**
   * 运行时分发器 - 根据 SkillRuntimeConfig 分发到具体执行器
   *
   * 支持四种运行时模式：
   * - Docker: 容器化执行，提供最强隔离
   * - Script: 脚本执行，支持 shell/python/node 等解释器
   * - API: HTTP API 调用，用于外部服务集成
   * - Builtin: 内置服务调用，复用平台原生能力
   */
  private async executeByRuntime(
    runtime: SkillRuntimeConfig,
    input: Record<string, any>,
    task: Task
  ): Promise<Record<string, unknown>> {
    // Docker 执行
    if (runtime.docker) {
      return this.executeSkillDockerTask(runtime.docker, input, task);
    }

    // Script 执行
    if (runtime.script) {
      return this.executeSkillScriptTask(runtime.script, input, runtime.timeout, task);
    }

    // HTTP API 调用
    if (runtime.api) {
      return this.executeSkillApiTask(runtime.api, input, task);
    }

    // 内置服务调用
    if (runtime.builtin) {
      return this.executeSkillBuiltinTask(runtime.builtin, input, task);
    }

    throw new OrionError('No runtime configured for skill task', ErrorCode.VALIDATION_ERROR);
  }

  /**
   * Docker 运行时执行
   *
   * 使用 DockerBuildService 构建/运行容器，适合需要完整隔离环境的 Skill。
   */
  private async executeSkillDockerTask(
    dockerConfig: {
      image: string;
      command?: string;
      env?: Record<string, string>;
      resources?: { cpu?: string; memory?: string };
    },
    input: Record<string, any>,
    task: Task
  ): Promise<Record<string, unknown>> {
    const { image, command, env, resources } = dockerConfig;

    task = appendTaskLog(task, `[SKILL-DOCKER] Image: ${image}`);
    if (command) {
      task = appendTaskLog(task, `[SKILL-DOCKER] Command: ${command}`);
    }

    // 将 input 序列化为环境变量传递给容器
    const containerEnv: Record<string, string> = { ...env };
    // 将 input 中的简单值作为环境变量注入
    for (const [key, value] of Object.entries(input)) {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        containerEnv[`SKILL_INPUT_${key.toUpperCase()}`] = String(value);
      }
    }

    // 复用现有的 ContainerTask 执行逻辑
    const spec: ContainerSpec = {
      image,
      workdir: '/workspace',
      env: containerEnv,
      resources: resources ? {
        cpu: resources.cpu,
        memory: resources.memory,
      } : undefined,
    };

    const cmd = command ? ['sh', '-c', command] : ['sh', '-c', 'echo "Skill executed"'];
    const timeoutMs = (task.timeoutSeconds || 300) * 1000;

    const executor: ContainerExecutorStrategy = new DockerExecutor();
    if (!(await executor.isAvailable())) {
      task = appendTaskLog(task, `[SKILL-DOCKER] Docker not available, falling back to local`);
      throw new OrionError('Docker runtime not available', ErrorCode.SERVICE_UNAVAILABLE);
    }

    const result = await executor.execute(spec, cmd[0], cmd.slice(1), timeoutMs);

    if (result.exitCode !== 0) {
      throw new OrionError(`Docker skill failed (exit code ${result.exitCode}): ${result.stderr}`, ErrorCode.OPERATION_FAILED);
    }

    return {
      runtimeType: 'docker',
      image,
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      containerId: result.containerId,
    };
  }

  /**
   * Script 运行时执行
   *
   * 使用 spawn 执行脚本（shell/python/node 等），适合轻量级 Skill。
   */
  private async executeSkillScriptTask(
    scriptConfig: {
      interpreter: string;
      content?: string;
    },
    input: Record<string, any>,
    timeout: number | undefined,
    task: Task
  ): Promise<Record<string, unknown>> {
    const { interpreter, content } = scriptConfig;

    if (!content) {
      throw new OrionError('Script runtime requires "content" field', ErrorCode.VALIDATION_ERROR);
    }

    const timeoutMs = timeout ? timeout * 1000 : (task.timeoutSeconds || 60) * 1000;
    const cwd = this.getTaskWorkspace(task, 'skill');

    task = appendTaskLog(task, `[SKILL-SCRIPT] Interpreter: ${interpreter}`);

    // 检查解释器是否可用
    const interpreterAvailable = await isCommandAvailable(interpreter);
    if (!interpreterAvailable) {
      task = appendTaskLog(task, `[SKILL-SCRIPT] ${interpreter} not available`);
      throw new OrionError(`Script interpreter "${interpreter}" not available`, ErrorCode.SERVICE_UNAVAILABLE);
    }

    // 安全检查
    if (!isScriptSafe(content)) {
      throw new OrionError('Skill script contains potentially dangerous commands', ErrorCode.VALIDATION_ERROR);
    }

    // 将 input 序列化为环境变量
    const env: Record<string, string> = {};
    for (const [key, value] of Object.entries(input)) {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        env[`SKILL_INPUT_${key.toUpperCase()}`] = String(value);
      }
    }

    const result = await spawnCommand(interpreter, ['-c', content], {
      cwd,
      timeoutMs,
      env,
    });

    if (result.exitCode !== 0) {
      throw new OrionError(`Script skill failed (exit code ${result.exitCode}): ${result.stderr}`, ErrorCode.OPERATION_FAILED);
    }

    return {
      runtimeType: 'script',
      interpreter,
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  }

  /**
   * API 运行时执行
   *
   * 通过 HTTP 调用外部服务，适合与第三方系统集成的 Skill。
   */
  private async executeSkillApiTask(
    apiConfig: {
      endpoint: string;
      method: string;
    },
    input: Record<string, any>,
    task: Task
  ): Promise<Record<string, unknown>> {
    const { endpoint, method } = apiConfig;

    task = appendTaskLog(task, `[SKILL-API] ${method.toUpperCase()} ${endpoint}`);

    // 使用 Node.js 原生 fetch（Node 18+）或 http 模块
    try {
      const response = await fetch(endpoint, {
        method: method.toUpperCase(),
        headers: {
          'Content-Type': 'application/json',
          'X-Skill-Task-Id': (task.id as string) || 'unknown',
        },
        body: JSON.stringify(input),
      });

      const statusCode = response.status;
      let responseData: any;
      const responseText = await response.text();

      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = responseText;
      }

      if (!response.ok) {
        throw new OrionError(`API skill returned ${statusCode}: ${responseText.substring(0, 200)}`, ErrorCode.OPERATION_FAILED);
      }

      return {
        runtimeType: 'api',
        endpoint,
        statusCode,
        response: responseData,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new OrionError(`API skill call failed: ${message}`, ErrorCode.OPERATION_FAILED);
    }
  }

  /**
   * Builtin 运行时执行
   *
   * 调用平台内置服务，复用现有 Service 层能力。
   * 当前支持模拟执行，后续可根据 builtin.service 和 builtin.action
   * 分发到具体的内部服务。
   */
  private async executeSkillBuiltinTask(
    builtinConfig: {
      service: string;
      action: string;
    },
    input: Record<string, any>,
    task: Task
  ): Promise<Record<string, unknown>> {
    const { service, action } = builtinConfig;

    task = appendTaskLog(task, `[SKILL-BUILTIN] Service: ${service}, Action: ${action}`);

    // 当前 builtin runtime 作为扩展点，模拟执行
    // 未来可根据 service + action 路由到具体内部服务
    // 例如：service='notification', action='send' -> NotificationService.send()
    return {
      runtimeType: 'builtin',
      service,
      action,
      input,
      simulated: true,
      stdout: `Builtin skill [${service}.${action}] executed with input: ${JSON.stringify(input)}`,
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
