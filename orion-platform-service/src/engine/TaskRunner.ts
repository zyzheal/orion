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

export interface TaskExecutionResult {
  status: TaskStatus;
  result?: Record<string, unknown>;
  log?: string;
  error?: string;
}

export class TaskRunner {
  /**
   * 执行 Task
   */
  async run(task: Task): Promise<Task> {
    let updatedTask = { ...task };
    updatedTask = appendTaskLog(updatedTask, `[INFO] Starting task: ${task.name}`);
    updatedTask = appendTaskLog(updatedTask, `[INFO] Task type: ${task.type}`);

    try {
      // 根据 task type 分发到不同的执行器
      const result = await this.executeByType(updatedTask);

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
  private async executeByType(task: Task): Promise<Record<string, unknown>> {
    const type = task.type.toLowerCase();

    if (type.startsWith('git/')) {
      return this.executeGitTask(task);
    } else if (type.startsWith('npm/') || type.startsWith('yarn/')) {
      return this.executeNpmTask(task);
    } else if (type.startsWith('k8s/')) {
      return this.executeK8sTask(task);
    } else if (type.startsWith('shell/') || type.startsWith('script/')) {
      return this.executeShellTask(task);
    } else {
      // 未知类型，模拟执行成功
      return this.executeMockTask(task);
    }
  }

  /**
   * 执行 Git 相关任务
   */
  private async executeGitTask(task: Task): Promise<Record<string, unknown>> {
    const action = task.type.split('/')[1];
    const params = task.parameters;

    task = appendTaskLog(task, `[GIT] Executing ${action}...`);

    // 模拟 Git 操作
    await this.sleep(100);

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
  private async executeNpmTask(task: Task): Promise<Record<string, unknown>> {
    const command = task.parameters.command || task.parameters.script || 'unknown';

    task = appendTaskLog(task, `[NPM] Running command: ${command}`);

    // 模拟命令执行
    await this.sleep(200);

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
  private async executeK8sTask(task: Task): Promise<Record<string, unknown>> {
    const action = task.type.split('/')[1];
    const params = task.parameters;

    task = appendTaskLog(task, `[K8S] ${action} deployment ${params.name || 'unknown'}...`);

    // 模拟 K8s 操作
    await this.sleep(300);

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
  private async executeShellTask(task: Task): Promise<Record<string, unknown>> {
    const script = task.parameters.script || task.parameters.command || '';

    task = appendTaskLog(task, `[SHELL] Executing: ${script}`);

    // 模拟 shell 执行
    await this.sleep(100);

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
  private async executeMockTask(task: Task): Promise<Record<string, unknown>> {
    task = appendTaskLog(task, `[MOCK] Simulating task execution: ${task.name}`);

    // 模拟执行
    await this.sleep(50);

    return {
      simulated: true,
      taskName: task.name,
      taskType: task.type,
      log: task.log,
    };
  }

  /**
   * 休眠辅助函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
