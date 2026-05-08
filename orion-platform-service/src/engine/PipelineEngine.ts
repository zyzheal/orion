/**
 * Pipeline Engine - Pipeline 执行编排引擎
 *
 * 负责：
 * - 解析 Pipeline YAML 定义
 * - 创建 PipelineRun 实例
 * - 初始化 Stages 和 Tasks
 * - 协调 Stage 执行顺序
 * - 发布执行事件
 */

import { Pipeline, parsePipelineYaml, PipelineStage as PipelineYamlStage } from '../models/Pipeline';
import { PipelineRun, PipelineRunStatus, TriggerType } from '../models/PipelineRun';
import { Stage, StageStatus, createStage } from '../models/Stage';
import { Task, createTask } from '../models/Task';
import { PipelineService } from '../services/pipeline/PipelineService';
import { PipelineRunService } from '../services/pipeline/PipelineRunService';
import { PipelineEventPublisher } from '../events/PipelineEventPublisher';
import { StageExecutor } from './StageExecutor';
import { ArtifactService } from '../services/pipeline/ArtifactService';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface PipelineExecution {
  run: PipelineRun;
  stages: Map<string, Stage>; // stageId -> Stage
  pendingStages: Set<string>; // stageIds waiting to be executed
  runningStages: Set<string>; // stageIds currently running
  completedStages: Set<string>; // stageIds that have completed
}

export class PipelineEngine {
  private pipelineService: PipelineService;
  private runService: PipelineRunService;
  private eventPublisher: PipelineEventPublisher;
  private stageExecutor: StageExecutor;
  private artifactService: ArtifactService | null;

  // 内存存储执行中的 Pipeline
  private executions = new Map<string, PipelineExecution>();

  // 防止 checkNextStages 并发调用导致重复执行
  private nextStageCheckLocks = new Map<string, Promise<void>>();

  constructor(
    pipelineService: PipelineService,
    runService: PipelineRunService,
    eventPublisher: PipelineEventPublisher,
    stageExecutor: StageExecutor,
    artifactService?: ArtifactService
  ) {
    this.pipelineService = pipelineService;
    this.runService = runService;
    this.eventPublisher = eventPublisher;
    this.stageExecutor = stageExecutor;
    this.artifactService = artifactService || null;
  }

  /**
   * 执行 Pipeline
   */
  async execute(
    pipelineId: string,
    triggerType: TriggerType,
    triggerBy?: string,
    context?: Record<string, unknown>
  ): Promise<PipelineRun | null> {
    // 1. 获取 Pipeline 定义
    const pipeline = await this.pipelineService.getById(pipelineId);
    if (!pipeline) {
      throw new Error(`Pipeline '${pipelineId}' not found`);
    }

    // 2. 解析 YAML
    let spec: { stages: PipelineYamlStage[] };
    try {
      if (!pipeline.yamlDefinition) {
        throw new Error('Pipeline has no YAML definition');
      }
      const result = parsePipelineYaml(pipeline.yamlDefinition);
      spec = result.spec;
    } catch (error) {
      throw new Error(`Failed to parse pipeline YAML: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // 3. 创建 PipelineRun
    const run = await this.runService.createRun({
      pipelineId,
      pipelineVersion: String(pipeline.version || 1),
      triggerType,
      triggerBy,
      context,
    });

    // 4. 初始化 Stages
    const stages = this.initializeStages(run.id, spec.stages);
    for (const stage of stages) {
      await this.runService.addStage(run.id, stage);
    }

    // 5. 初始化 Tasks
    for (const yamlStage of spec.stages) {
      const stage = stages.find(s => s.name === yamlStage.name)!;
      const tasks = this.initializeTasks(stage.id, yamlStage.steps);
      for (const task of tasks) {
        await this.runService.addTask(stage.id, task);
      }
    }

    // 6. 创建执行上下文
    const execution: PipelineExecution = {
      run,
      stages: new Map(stages.map(s => [s.id, s])),
      pendingStages: new Set(stages.filter(s => s.dependsOn.length === 0).map(s => s.id)),
      runningStages: new Set(),
      completedStages: new Set(),
    };
    this.executions.set(run.id, execution);

    // 7. 开始执行
    await this.runService.startRun(run.id);
    this.executePendingStages(execution);

    return run;
  }

  /**
   * 初始化 Stages
   */
  private initializeStages(runId: string, yamlStages: PipelineYamlStage[]): Stage[] {
    return yamlStages.map((yamlStage, index) =>
      createStage({
        runId,
        name: yamlStage.name,
        sequence: index,
        dependsOn: yamlStage.dependsOn || [],
        condition: yamlStage.if,
        timeoutSeconds: yamlStage.timeout || 3600,
        maxRetries: yamlStage.retries || 0,
      })
    );
  }

  /**
   * 初始化 Tasks
   */
  private initializeTasks(stageId: string, steps: { name: string; uses: string; with?: Record<string, unknown> }[]): Task[] {
    return steps.map((step, index) => {
      const [type] = step.uses.split('@');
      return createTask({
        stageId,
        name: step.name,
        type,
        sequence: index,
        config: { uses: step.uses } as Record<string, unknown>,
        parameters: step.with || {},
        timeoutSeconds: 600,
      });
    });
  }

  /**
   * 执行待处理的 Stages
   * 改进：支持并行执行 — 检测无依赖关系的 stages，使用 Promise.allSettled 并发执行
   */
  private async executePendingStages(execution: PipelineExecution): Promise<void> {
    const stagesToExecute = Array.from(execution.pendingStages);

    // 过滤出条件满足的 stages（跳过不满足条件的）
    const eligibleStageIds: string[] = [];
    for (const stageId of stagesToExecute) {
      const stage = execution.stages.get(stageId);
      if (!stage) continue;

      if (stage.condition && !this.evaluateCondition(stage.condition, execution)) {
        const skippedStage = { ...stage, status: StageStatus.SKIPPED, completedAt: new Date() };
        execution.stages.set(stageId, skippedStage);
        await this.runService.updateStage(skippedStage);
        await this.eventPublisher.publishStageSkipped(execution.run.id, skippedStage);

        execution.pendingStages.delete(stageId);
        execution.completedStages.add(stageId);
        continue;
      }
      eligibleStageIds.push(stageId);
    }

    // 从待处理队列中移除所有 eligible stages
    for (const stageId of eligibleStageIds) {
      execution.pendingStages.delete(stageId);
      execution.runningStages.add(stageId);
    }

    if (eligibleStageIds.length === 0) {
      return;
    }

    logger.info({ stageCount: eligibleStageIds.length, stageIds: eligibleStageIds }, 'Executing stages');

    // 并行执行所有符合条件的 stages
    const executionPromises = eligibleStageIds.map(async (stageId) => {
      const stage = execution.stages.get(stageId);
      if (!stage) return;
      try {
        await this.executeStage(execution, stage);
      } catch (error) {
        logger.error({ stageName: stage.name, error }, 'Failed to execute stage');
      }
    });

    await Promise.allSettled(executionPromises);
  }

  /**
   * 执行单个 Stage
   */
  private async executeStage(execution: PipelineExecution, stage: Stage): Promise<void> {
    // 更新 Stage 状态为 running
    const runningStage = {
      ...stage,
      status: StageStatus.RUNNING,
      startedAt: new Date(),
    };
    execution.stages.set(stage.id, runningStage);
    await this.runService.updateStage(runningStage);
    await this.eventPublisher.publishStageStarted(execution.run.id, runningStage);

    try {
      // 获取 Stage 的 Tasks
      const tasks = await this.runService.getTasks(stage.id);

      // 按顺序执行 Tasks
      for (const task of tasks) {
        if (task.status !== 'pending') continue;

        const result = await this.stageExecutor.executeTask(execution.run.id, stage, task);
        await this.runService.updateTask(result);

        if (result.status === 'failed') {
          throw new Error(result.error || `Task '${task.name}' failed`);
        }
      }

      // Stage 成功完成
      const completedStage = {
        ...runningStage,
        status: StageStatus.SUCCESS,
        completedAt: new Date(),
        durationMs: Date.now() - runningStage.startedAt!.getTime(),
      };
      execution.stages.set(stage.id, completedStage);
      await this.runService.updateStage(completedStage);
      await this.eventPublisher.publishStageCompleted(execution.run.id, completedStage);

      execution.runningStages.delete(stage.id);
      execution.completedStages.add(stage.id);

      // 检查是否有新的 Stages 可以执行
      this.checkNextStages(execution);

    } catch (error) {
      // Stage 失败
      const failedStage = {
        ...runningStage,
        status: StageStatus.FAILED,
        completedAt: new Date(),
        durationMs: Date.now() - runningStage.startedAt!.getTime(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      execution.stages.set(stage.id, failedStage);
      await this.runService.updateStage(failedStage);
      await this.eventPublisher.publishStageFailed(execution.run.id, failedStage, failedStage.error);

      execution.runningStages.delete(stage.id);
      execution.completedStages.add(stage.id);

      // 检查是否需要重试
      if (this.shouldRetry(stage)) {
        this.retryStage(execution, stage);
      } else {
        // 标记依赖于此 Stage 的其他 Stages 为失败
        this.failDependentStages(execution, stage);
      }

      // 检查 PipelineRun 是否完成
      this.checkRunCompletion(execution);
    }
  }

  /**
   * 检查是否有新的 Stages 可以执行
   * 改进：批量检查所有 pending stages，支持 fan-in 模式
   * 使用锁防止并行阶段完成时并发调用导致重复执行
   */
  private async checkNextStages(execution: PipelineExecution): Promise<void> {
    const runId = execution.run.id;

    // 如果已有 check 在进行，等待它完成（只允许一个 check 在跑）
    if (this.nextStageCheckLocks.has(runId)) {
      await this.nextStageCheckLocks.get(runId);
      // 等待完成后返回，因为之前的 check 已经处理了所有逻辑
      return;
    }

    const checkPromise = this.doCheckNextStages(execution).finally(() => {
      this.nextStageCheckLocks.delete(runId);
    });
    this.nextStageCheckLocks.set(runId, checkPromise);
    await checkPromise;
  }

  /**
   * 实际执行 next stages 检查的逻辑
   */
  private async doCheckNextStages(execution: PipelineExecution): Promise<void> {
    let newlyUnlocked = false;

    for (const [stageId, stage] of execution.stages.entries()) {
      if (
        execution.pendingStages.has(stageId) ||
        execution.runningStages.has(stageId) ||
        execution.completedStages.has(stageId)
      ) {
        continue;
      }

      // 检查依赖是否都已完成
      const dependenciesMet = stage.dependsOn.every(depName => {
        const depStage = Array.from(execution.stages.values()).find(s => s.name === depName);
        // Fan-in: 所有依赖的 stage 都必须成功完成
        return depStage && depStage.status === StageStatus.SUCCESS;
      });

      // 检查是否有依赖失败（如果是，则跳过此 stage）
      const hasFailedDependency = stage.dependsOn.some(depName => {
        const depStage = Array.from(execution.stages.values()).find(s => s.name === depName);
        return depStage && depStage.status === StageStatus.FAILED;
      });

      if (hasFailedDependency) {
        // 依赖失败，跳过此 stage
        const skippedStage = {
          ...stage,
          status: StageStatus.SKIPPED,
          completedAt: new Date(),
          error: 'Skipped due to failed dependency',
        };
        execution.stages.set(stageId, skippedStage);
        await this.runService.updateStage(skippedStage);
        await this.eventPublisher.publishStageSkipped(execution.run.id, skippedStage);
        execution.completedStages.add(stageId);
        continue;
      }

      if (dependenciesMet) {
        execution.pendingStages.add(stageId);
        newlyUnlocked = true;

        // 将上游已完成 Stages 的 artifacts 传递给新解锁的 Stage
        if (this.artifactService && stage.dependsOn.length > 0) {
          this.passArtifactsToStage(execution, stage).catch(err => {
            logger.warn({ stageId: stage.id, error: err }, 'Failed to pass artifacts to stage');
          });
        }
      }
    }

    // 执行新解锁的待处理 Stages
    if (newlyUnlocked && execution.pendingStages.size > 0) {
      await this.executePendingStages(execution);
    }

    // 检查 PipelineRun 是否完成
    await this.checkRunCompletion(execution);
  }

  /**
   * 检查 PipelineRun 是否完成
   */
  private async checkRunCompletion(execution: PipelineExecution): Promise<void> {
    const allStagesCompleted = Array.from(execution.stages.values()).every(
      s => s.status === StageStatus.SUCCESS || s.status === StageStatus.FAILED || s.status === StageStatus.SKIPPED
    );

    if (allStagesCompleted && execution.runningStages.size === 0) {
      const hasFailure = Array.from(execution.stages.values()).some(s => s.status === StageStatus.FAILED);

      if (hasFailure) {
        await this.runService.completeRun(execution.run.id, PipelineRunStatus.FAILED);
      } else {
        await this.runService.completeRun(execution.run.id, PipelineRunStatus.SUCCESS);
      }

      // 清理执行上下文
      this.executions.delete(execution.run.id);
    }
  }

  /**
   * 检查是否应该重试 Stage
   */
  private shouldRetry(stage: Stage): boolean {
    return stage.retryCount < stage.maxRetries;
  }

  /**
   * 重试 Stage
   */
  private async retryStage(execution: PipelineExecution, stage: Stage): Promise<void> {
    const retriedStage = {
      ...stage,
      retryCount: stage.retryCount + 1,
      status: StageStatus.PENDING,
      startedAt: undefined,
      completedAt: undefined,
      durationMs: undefined,
      error: undefined,
    };
    execution.stages.set(stage.id, retriedStage);
    await this.runService.updateStage(retriedStage);
    execution.pendingStages.add(stage.id);
    execution.completedStages.delete(stage.id);

    // Actually trigger the retry
    await this.executePendingStages(execution);
  }

  /**
   * 将上游已完成 Stages 的 artifacts 传递给目标 Stage
   */
  private async passArtifactsToStage(
    execution: PipelineExecution,
    targetStage: Stage
  ): Promise<void> {
    // 找到所有依赖的已完成 Stages
    const upstreamStageIds: string[] = [];
    for (const depName of targetStage.dependsOn) {
      const depStage = Array.from(execution.stages.values()).find(s => s.name === depName);
      if (depStage && depStage.status === StageStatus.SUCCESS) {
        upstreamStageIds.push(depStage.id);
      }
    }

    if (upstreamStageIds.length === 0) return;

    const result = await this.stageExecutor.passUpstreamArtifacts(
      execution.run.id,
      upstreamStageIds,
      targetStage.id
    );

    if (result.errors.length > 0) {
      logger.warn(
        { runId: execution.run.id, stageId: targetStage.id, errors: result.errors },
        'Some artifact passing operations failed'
      );
    }

    if (result.passed > 0) {
      logger.info(
        { runId: execution.run.id, stageId: targetStage.id, passed: result.passed },
        'Artifacts passed to stage'
      );
    }
  }

  /**
   * 失败依赖此 Stage 的其他 Stages
   */
  private async failDependentStages(execution: PipelineExecution, failedStage: Stage): Promise<void> {
    for (const [stageId, stage] of execution.stages.entries()) {
      if (
        stage.status === StageStatus.PENDING &&
        stage.dependsOn.includes(failedStage.name)
      ) {
        const skippedStage = {
          ...stage,
          status: StageStatus.SKIPPED,
          completedAt: new Date(),
        };
        execution.stages.set(stageId, skippedStage);
        await this.runService.updateStage(skippedStage);
        await this.eventPublisher.publishStageSkipped(execution.run.id, skippedStage);
        execution.completedStages.add(stageId);
      }
    }
  }

  /**
   * 评估 Stage 条件表达式
   */
  private evaluateCondition(condition: string, execution: PipelineExecution): boolean {
    // 简化的条件评估，实际应实现更复杂的表达式解析
    // 示例条件：github.ref == 'refs/heads/main'

    const context = {
      github: {
        ref: execution.run.context?.git?.ref || 'refs/heads/main',
        ...execution.run.context,
      },
      pipeline: {
        status: execution.run.status,
      },
    };

    // 简单的相等性检查
    const match = condition.match(/^(\S+)\s*==\s*'([^']+)'$/);
    if (match) {
      const [, path, expectedValue] = match;
      const parts = path.split('.');
      let actualValue: unknown = context as Record<string, unknown>;
      for (const part of parts) {
        if (typeof actualValue === 'object' && actualValue !== null) {
          actualValue = (actualValue as Record<string, unknown>)[part];
        } else {
          return false;
        }
      }
      return actualValue === expectedValue;
    }

    // 默认返回 true
    return true;
  }

  /**
   * 获取执行中的 PipelineRun
   */
  getExecution(runId: string): PipelineExecution | undefined {
    return this.executions.get(runId);
  }

  /**
   * 取消正在执行的 PipelineRun（FIXED P0-4）
   * 停止所有运行中的 Stages，标记待处理 Stages 为取消
   */
  async cancelExecution(runId: string): Promise<boolean> {
    const execution = this.executions.get(runId);
    if (!execution) {
      return false;
    }

    // 取消所有运行中的 Stages
    for (const stageId of execution.runningStages) {
      const stage = execution.stages.get(stageId);
      if (stage) {
        const cancelledStage = {
          ...stage,
          status: StageStatus.SKIPPED,
          completedAt: new Date(),
          durationMs: Date.now() - stage.startedAt!.getTime(),
        };
        execution.stages.set(stageId, cancelledStage);
        await this.runService.updateStage(cancelledStage);
        await this.eventPublisher.publishStageSkipped(execution.run.id, cancelledStage);
      }
    }

    // 标记所有待处理的 Stages 为跳过
    for (const stageId of execution.pendingStages) {
      const stage = execution.stages.get(stageId);
      if (stage) {
        const skippedStage = {
          ...stage,
          status: StageStatus.SKIPPED,
          completedAt: new Date(),
        };
        execution.stages.set(stageId, skippedStage);
        await this.runService.updateStage(skippedStage);
        await this.eventPublisher.publishStageSkipped(execution.run.id, skippedStage);
      }
    }

    // 取消 PipelineRun
    await this.runService.cancelRun(runId);

    // 清理执行上下文
    this.executions.delete(runId);

    return true;
  }
}
