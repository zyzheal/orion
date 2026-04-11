/**
 * PipelineRun Service - PipelineRun 管理
 */

import {
  PipelineRun,
  PipelineRunStatus,
  TriggerType,
  PipelineRunCreateInput,
  PipelineRunFilter,
  createPipelineRun,
  startPipelineRun,
  completePipelineRun,
  cancelPipelineRun,
} from '../../models/PipelineRun';
import { Stage, StageStatus } from '../../models/Stage';
import { Task } from '../../models/Task';
import { PipelineEventPublisher } from '../../events/PipelineEventPublisher';

/**
 * 内存存储（生产环境应使用数据库）
 */
const pipelineRuns = new Map<string, PipelineRun>();
const stagesByRun = new Map<string, Stage[]>(); // runId -> stages
const tasksByStage = new Map<string, Task[]>(); // stageId -> tasks

export class PipelineRunService {
  private eventPublisher: PipelineEventPublisher;

  constructor(eventPublisher?: PipelineEventPublisher) {
    this.eventPublisher = eventPublisher || new PipelineEventPublisher();
  }

  /**
   * 设置事件发布器
   */
  setEventPublisher(eventPublisher: PipelineEventPublisher): void {
    this.eventPublisher = eventPublisher;
  }

  /**
   * 创建 PipelineRun
   */
  async createRun(input: PipelineRunCreateInput): Promise<PipelineRun> {
    const run = createPipelineRun(input);
    pipelineRuns.set(run.id, run);

    // 发布事件
    await this.eventPublisher.publishRunCreated(run);

    return run;
  }

  /**
   * 获取 PipelineRun
   */
  async getRun(id: string): Promise<PipelineRun | null> {
    return pipelineRuns.get(id) || null;
  }

  /**
   * 获取 PipelineRun 列表
   */
  async listRuns(filter?: PipelineRunFilter): Promise<PipelineRun[]> {
    let result = Array.from(pipelineRuns.values());

    if (filter?.pipelineId) {
      result = result.filter(r => r.pipelineId === filter.pipelineId);
    }

    if (filter?.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
      result = result.filter(r => statuses.includes(r.status));
    }

    if (filter?.triggerType) {
      result = result.filter(r => r.triggerType === filter.triggerType);
    }

    // 排序（最新的在前）
    result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // 分页
    const offset = filter?.offset || 0;
    const limit = filter?.limit || 100;
    return result.slice(offset, offset + limit);
  }

  /**
   * 开始执行 PipelineRun
   */
  async startRun(runId: string): Promise<PipelineRun | null> {
    const run = pipelineRuns.get(runId);
    if (!run) {
      return null;
    }

    const updatedRun = startPipelineRun(run);
    pipelineRuns.set(runId, updatedRun);

    // 发布事件
    await this.eventPublisher.publishRunStarted(updatedRun);

    return updatedRun;
  }

  /**
   * 完成 PipelineRun
   */
  async completeRun(runId: string, status: PipelineRunStatus.SUCCESS | PipelineRunStatus.FAILED): Promise<PipelineRun | null> {
    const run = pipelineRuns.get(runId);
    if (!run) {
      return null;
    }

    const updatedRun = completePipelineRun(run, status);
    pipelineRuns.set(runId, updatedRun);

    // 发布事件
    if (status === PipelineRunStatus.SUCCESS) {
      await this.eventPublisher.publishRunCompleted(updatedRun);
    } else {
      await this.eventPublisher.publishRunFailed(updatedRun);
    }

    return updatedRun;
  }

  /**
   * 取消 PipelineRun
   */
  async cancelRun(runId: string): Promise<PipelineRun | null> {
    const run = pipelineRuns.get(runId);
    if (!run || run.status !== PipelineRunStatus.RUNNING) {
      return null;
    }

    const updatedRun = cancelPipelineRun(run);
    pipelineRuns.set(runId, updatedRun);

    // 发布事件
    await this.eventPublisher.publishRunCancelled(updatedRun);

    return updatedRun;
  }

  /**
   * 添加 Stage 到 PipelineRun
   */
  async addStage(runId: string, stage: Stage): Promise<void> {
    const stages = stagesByRun.get(runId) || [];
    stages.push(stage);
    stagesByRun.set(runId, stages);
  }

  /**
   * 获取 PipelineRun 的所有 Stages
   */
  async getStages(runId: string): Promise<Stage[]> {
    return stagesByRun.get(runId) || [];
  }

  /**
   * 获取 Stage
   */
  async getStage(stageId: string): Promise<Stage | null> {
    for (const stages of stagesByRun.values()) {
      const stage = stages.find(s => s.id === stageId);
      if (stage) return stage;
    }
    return null;
  }

  /**
   * 更新 Stage
   */
  async updateStage(stage: Stage): Promise<void> {
    const stages = stagesByRun.get(stage.runId) || [];
    const index = stages.findIndex(s => s.id === stage.id);
    if (index !== -1) {
      stages[index] = stage;
      stagesByRun.set(stage.runId, stages);
    }
  }

  /**
   * 添加 Task 到 Stage
   */
  async addTask(stageId: string, task: Task): Promise<void> {
    const tasks = tasksByStage.get(stageId) || [];
    tasks.push(task);
    tasksByStage.set(stageId, tasks);
  }

  /**
   * 获取 Stage 的所有 Tasks
   */
  async getTasks(stageId: string): Promise<Task[]> {
    return tasksByStage.get(stageId) || [];
  }

  /**
   * 获取 Task
   */
  async getTask(taskId: string): Promise<Task | null> {
    for (const tasks of tasksByStage.values()) {
      const task = tasks.find(t => t.id === taskId);
      if (task) return task;
    }
    return null;
  }

  /**
   * 更新 Task
   */
  async updateTask(task: Task): Promise<void> {
    // 找到 task 所属的 stage
    for (const [stageId, tasks] of tasksByStage.entries()) {
      const index = tasks.findIndex(t => t.id === task.id);
      if (index !== -1) {
        tasks[index] = task;
        tasksByStage.set(stageId, tasks);
        return;
      }
    }
  }

  /**
   * 获取 PipelineRun 的详情（包含 stages 和 tasks）
   */
  async getRunDetail(runId: string): Promise<{
    run: PipelineRun | null;
    stages: Stage[];
    tasks: Task[];
  } | null> {
    const run = pipelineRuns.get(runId);
    if (!run) {
      return null;
    }

    const stages = stagesByRun.get(runId) || [];
    const tasks: Task[] = [];
    for (const stage of stages) {
      const stageTasks = tasksByStage.get(stage.id) || [];
      tasks.push(...stageTasks);
    }

    return { run, stages, tasks };
  }

  /**
   * 检查 PipelineRun 是否所有 stages 都已完成
   */
  async checkRunCompletion(runId: string): Promise<{
    isComplete: boolean;
    allSuccess: boolean;
  } | null> {
    const run = pipelineRuns.get(runId);
    if (!run) {
      return null;
    }

    const stages = stagesByRun.get(runId) || [];
    if (stages.length === 0) {
      return { isComplete: true, allSuccess: true };
    }

    const hasFailed = stages.some(s => s.status === StageStatus.FAILED);
    const allComplete = stages.every(s =>
      s.status === StageStatus.SUCCESS ||
      s.status === StageStatus.FAILED ||
      s.status === StageStatus.SKIPPED
    );

    return {
      isComplete: allComplete,
      allSuccess: !hasFailed,
    };
  }
}

// 导出单例
export const pipelineRunService = new PipelineRunService();
