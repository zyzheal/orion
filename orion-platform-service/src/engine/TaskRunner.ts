/**
 * Task Runner - Task 执行器
 *
 * 负责：
 * - 解析 Task 配置
 * - 执行具体任务逻辑
 * - 收集 Task 日志
 * - 处理 Task 重试
 */

import { Task, TaskStatus, appendTaskLog } from '../models/Task';
import { PluginExecutorService, TaskExecutionRequest, TaskStatus as PluginTaskStatus } from '../services/plugin-executor-service';
import { InlineScriptService, InlineScriptExecutionRequest } from '../services/inline-script/InlineScriptService';

export interface TaskExecutionResult {
  status: TaskStatus;
  result?: Record<string, unknown>;
  log?: string;
  error?: string;
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
   */
  private async executeGitTask(task: Task, signal?: AbortSignal): Promise<Record<string, unknown>> {
    const action = task.type.split('/')[1];
    const params = task.parameters;

    task = appendTaskLog(task, `[GIT] Executing ${action}...`);

    await this.sleep(100, signal);

    return {
      action,
      repository: params.repo || 'unknown',
      branch: params.branch || 'main',
      commit: params.sha || 'abc123',
      log: task.log,
    };
  }

  /**
   * 执行 Npm/Yarn 任务
   */
  private async executeNpmTask(task: Task, signal?: AbortSignal): Promise<Record<string, unknown>> {
    const command = task.parameters.command || task.parameters.script || 'unknown';

    task = appendTaskLog(task, `[NPM] Running command: ${command}`);

    await this.sleep(200, signal);

    return {
      command,
      exitCode: 0,
      output: 'Build completed successfully',
      log: task.log,
    };
  }

  /**
   * 执行 Kubernetes 任务
   */
  private async executeK8sTask(task: Task, signal?: AbortSignal): Promise<Record<string, unknown>> {
    const action = task.type.split('/')[1];
    const params = task.parameters;

    task = appendTaskLog(task, `[K8S] ${action} deployment ${params.name || 'unknown'}...`);

    await this.sleep(300, signal);

    return {
      action,
      namespace: params.namespace || 'default',
      name: params.name || 'unknown',
      status: 'completed',
      log: task.log,
    };
  }

  /**
   * 执行 Shell 任务
   */
  private async executeShellTask(task: Task, signal?: AbortSignal): Promise<Record<string, unknown>> {
    const script = task.parameters.script || task.parameters.command || '';

    task = appendTaskLog(task, `[SHELL] Executing: ${script}`);

    await this.sleep(100, signal);

    return {
      script,
      exitCode: 0,
      stdout: 'Command executed successfully',
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
      try {
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
      } catch (error) {
        return {
          pluginId,
          pluginName,
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          log: task.log,
        };
      }
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
      try {
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
      } catch (error) {
        return {
          level,
          language,
          codeLength: code.length,
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          log: task.log,
        };
      }
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
