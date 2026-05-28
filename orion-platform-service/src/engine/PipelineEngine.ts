/**
 * Pipeline Engine - Pipeline 执行编排引擎 (Facade)
 *
 * 作为 Facade 委托给 5 个提取的类：
 * - StageInitializer: Stage/Task 工厂
 * - StageOrchestrator: Stage 执行编排
 * - NotificationDispatcher: IM/Webhook 通知
 * - ScmStatusReporter: SCM 状态回写
 * - PipelineGateController: 质量门禁/审批网关/部署策略
 *
 * 负责：
 * - 解析 Pipeline YAML 定义
 * - 创建 PipelineRun 实例
 * - 协调 Stage 执行顺序
 * - 发布执行事件
 */

import { Pipeline, parsePipelineYaml, PipelineStage as PipelineYamlStage } from '../models/Pipeline';
import { OrionError, ErrorCode } from '../errors';
import { PipelineRun, PipelineRunStatus, TriggerType } from '../models/PipelineRun';
import { Stage, StageStatus } from '../models/Stage';
import { Task } from '../models/Task';
import { PipelineService } from '../services/pipeline/PipelineService';
import { PipelineRunService } from '../services/pipeline/PipelineRunService';
import { SubPipelineService } from '../services/pipeline/SubPipelineService';
import { PipelineEventPublisher } from '../events/PipelineEventPublisher';
import { PipelineEventSSEBridge } from '../services/pipeline/PipelineEventSSEBridge';
import { StageExecutor } from './StageExecutor';
import { ArtifactService } from '../services/pipeline/ArtifactService';
import { ApprovalGateService } from '../services/pipeline/ApprovalGateService';
import { PipelineExecutionQueue, QueuePriority } from '../services/pipeline/PipelineExecutionQueue';
import { AutoRetryService } from '../services/pipeline/AutoRetryService';
import { ExpressionEvaluator } from './ExpressionEvaluator';
import { PipelineCheckpointManager } from './PipelineCheckpointManager';
import { IMNotifier, IMNotificationConfig } from '../services/pipeline/IMNotifier';
import { WebhookNotifier } from '../services/pipeline/WebhookNotifier';
import { WebhookConfigRepository } from '../repositories/WebhookConfigRepository';
import { QualityGateService } from '../services/pipeline/QualityGateService';
import { DeploymentStrategyService } from '../services/pipeline/DeploymentStrategyService';
import { MatrixExpander } from './MatrixExpander';
import { DebugController } from './DebugController';
import { YamlPreprocessor } from './YamlPreprocessor';
import { SecretsService, SecretsServiceConfig } from '../services/pipeline/SecretsService';
import { SecretRepository } from '../repositories/SecretRepository';
import { CommitStatusService } from '../services/code-repo/CommitStatusService';

// Extracted classes
import { StageInitializer } from './StageInitializer';
import { StageOrchestrator } from './StageOrchestrator';
import { NotificationDispatcher } from './NotificationDispatcher';
import { ScmStatusReporter } from './ScmStatusReporter';
import { PipelineGateController } from './PipelineGateController';

import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

/**
 * 回调函数：当 Pipeline Run 完成时调用（用于 metrics 记录等）
 */
export type RunCompletionCallback = (run: PipelineRun) => void;

export interface PipelineExecution {
  run: PipelineRun;
  stages: Map<string, Stage>; // stageId -> Stage
  pendingStages: Set<string>; // stageIds waiting to be executed
  runningStages: Set<string>; // stageIds currently running
  completedStages: Set<string>; // stageIds that have completed
}

export class PipelineEngine {
  // Extracted collaborators (Facade delegates)
  private stageInitializer: StageInitializer;
  private stageOrchestrator: StageOrchestrator;
  private notificationDispatcher: NotificationDispatcher;
  private scmStatusReporter: ScmStatusReporter;
  private gateController: PipelineGateController;

  // Dependencies still managed by facade
  private pipelineService: PipelineService;
  private runService: PipelineRunService;
  private eventPublisher: PipelineEventPublisher;
  private sseBridge: PipelineEventSSEBridge | null;
  private executionQueue: PipelineExecutionQueue | null;
  private onRunComplete: RunCompletionCallback | null;
  private checkpointManager: PipelineCheckpointManager | null;
  private debugController: DebugController | null;
  private yamlPreprocessor: YamlPreprocessor | null;
  private secretsService: SecretsService | null;

  // 内存存储执行中的 Pipeline
  private executions = new Map<string, PipelineExecution>();

  constructor(
    pipelineService: PipelineService,
    runService: PipelineRunService,
    eventPublisher: PipelineEventPublisher,
    stageExecutor: StageExecutor,
    sseBridge?: PipelineEventSSEBridge | null,
    subPipelineService?: SubPipelineService | null,
    artifactService?: ArtifactService,
    approvalGateService?: ApprovalGateService,
    executionQueue?: PipelineExecutionQueue,
    autoRetryService?: AutoRetryService,
    onRunComplete?: RunCompletionCallback,
    checkpointManager?: PipelineCheckpointManager,
    imNotifier?: IMNotifier,
    imNotificationConfigs?: IMNotificationConfig[],
    debugController?: DebugController,
    webhookNotifier?: WebhookNotifier,
    webhookConfigRepo?: WebhookConfigRepository,
    qualityGateService?: QualityGateService,
    deploymentStrategyService?: DeploymentStrategyService,
    yamlPreprocessor?: YamlPreprocessor | null,
    secretsService?: SecretsService | null,
    scmStatusService?: CommitStatusService | null
  ) {
    this.pipelineService = pipelineService;
    this.runService = runService;
    this.eventPublisher = eventPublisher;
    this.sseBridge = sseBridge || null;
    this.executionQueue = executionQueue || null;
    this.onRunComplete = onRunComplete || null;
    this.checkpointManager = checkpointManager || null;
    this.debugController = debugController || null;
    this.yamlPreprocessor = yamlPreprocessor || null;
    this.secretsService = secretsService || null;

    // Construct extracted collaborators
    this.stageInitializer = new StageInitializer();

    this.stageOrchestrator = new StageOrchestrator({
      pipelineService,
      runService,
      eventPublisher,
      sseBridge: this.sseBridge,
      stageExecutor,
      subPipelineService: subPipelineService || null,
      artifactService: artifactService || null,
      autoRetryService: autoRetryService || null,
      expressionEvaluator: new ExpressionEvaluator(),
      checkpointManager: this.checkpointManager,
      debugController: this.debugController,
      secretsService: this.secretsService,
    });

    this.notificationDispatcher = new NotificationDispatcher({
      pipelineService,
      runService,
      imNotifier: imNotifier || null,
      imNotificationConfigs: imNotificationConfigs || [],
      webhookNotifier: webhookNotifier || null,
      webhookConfigRepo: webhookConfigRepo || null,
    });

    this.scmStatusReporter = new ScmStatusReporter({
      pipelineService,
      runService,
      scmStatusService: scmStatusService || null,
    });

    this.gateController = new PipelineGateController({
      runService,
      eventPublisher,
      sseBridge: this.sseBridge,
      approvalGateService: approvalGateService || null,
      qualityGateService: qualityGateService || null,
      deploymentStrategyService: deploymentStrategyService || null,
    });
  }

  /**
   * Initialize SecretsService from database connection.
   */
  initializeSecrets(database: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }, masterKey?: string): void {
    if (!database) return;
    const repo = new SecretRepository(database);
    const config: SecretsServiceConfig | undefined = masterKey ? { encryptionKey: masterKey } : undefined;
    this.secretsService = new SecretsService(repo, config);
  }

  /**
   * Get the SecretsService instance (for external access)
   */
  getSecretsService(): SecretsService | null {
    return this.secretsService;
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
      throw new OrionError(`Pipeline '${pipelineId}' not found`, ErrorCode.NOT_FOUND);
    }

    // 2. 解析 YAML
    let spec: { stages: PipelineYamlStage[] };
    try {
      if (!pipeline.yamlDefinition) {
        throw new OrionError('Pipeline has no YAML definition', ErrorCode.VALIDATION_ERROR);
      }
      let yamlDefinition = pipeline.yamlDefinition;
      if (this.yamlPreprocessor) {
        try {
          yamlDefinition = await this.yamlPreprocessor.preprocess(yamlDefinition);
          logger.info(
            { pipelineId },
            'YAML preprocessed: action references expanded'
          );
        } catch (error) {
          logger.warn({ error }, 'YAML preprocessing failed, using original YAML');
        }
      }
      const result = parsePipelineYaml(yamlDefinition);
      spec = result.spec;
    } catch (error) {
      throw new OrionError(`Failed to parse pipeline YAML: ${error instanceof Error ? error.message : 'Unknown error'}`, ErrorCode.VALIDATION_ERROR);
    }

    // 2.5. Expand matrix stages (GAP-02)
    const expandedStages = MatrixExpander.expandAll(spec.stages);
    const hasMatrixExpansion = expandedStages.some(e => e.originalName !== e.name);
    if (hasMatrixExpansion) {
      const matrixCount = expandedStages.filter(e => e.originalName !== e.name).length;
      logger.info(
        { originalCount: spec.stages.length, expandedCount: expandedStages.length, matrixStages: matrixCount },
        'Matrix expansion: stages expanded for matrix build'
      );
    }

    // 3. 创建 PipelineRun
    const run = await this.runService.createRun({
      pipelineId,
      pipelineVersion: String(pipeline.version || 1),
      triggerType,
      triggerBy,
      context,
    });

    // 4. 初始化 Stages (delegate to StageInitializer)
    const stages = this.stageInitializer.initializeStagesFromExpanded(run.id, expandedStages);
    for (const stage of stages) {
      await this.runService.addStage(run.id, stage);
    }

    // 5. 初始化 Tasks (delegate to StageInitializer)
    for (const expanded of expandedStages) {
      const stage = stages.find(s => s.name === expanded.name)!;
      const tasks = this.stageInitializer.initializeTasks(stage.id, expanded.stage.steps, expanded.stage.runsOn);
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

    // 6.1. Create VariableContext (delegate to StageOrchestrator)
    this.stageOrchestrator.createVariableContext(run.id, context);

    // 6.2. Register debug session if DebugController is available
    if (this.debugController) {
      this.debugController.registerRun(run.id, { status: 'running' });
      logger.debug({ runId: run.id }, 'Debug session registered for pipeline run');
    }

    // 6.5. GAP-06: Handle retry skip metadata (delegate to StageOrchestrator)
    this.stageOrchestrator.applyRetrySkipMetadata(execution);

    // 7. 开始执行
    await this.runService.startRun(run.id);

    // 7.1. Publish SSE run started event
    this.sseBridge?.publishRunStarted(pipelineId, run);

    // 7.2. Report SCM commit status as pending (delegate to ScmStatusReporter)
    this.scmStatusReporter.reportScmStatus(run, 'pending', this.executions).catch(err => {
      logger.warn({ runId: run.id, error: err }, 'SCM status reporting failed (non-fatal)');
    });

    if (this.executionQueue) {
      // 使用全局执行队列
      const priority = this.determinePriority(triggerType, context);
      logger.info({ runId: run.id, priority }, 'Enqueueing pipeline run');

      this.executionQueue.enqueue({
        runId: run.id,
        pipelineId,
        priority,
        executeFn: async () => {
          logger.info({ runId: run.id }, 'Executing dequeued pipeline run');
          this.executePendingStages(execution);
        },
        resolve: () => { /* handled by queue internally */ },
        reject: () => { /* handled by queue internally */ },
      }).catch(err => {
        logger.error({ runId: run.id, error: err }, 'Failed to enqueue pipeline run');
      });
    } else {
      // 直接执行（无队列模式）
      this.executePendingStages(execution);
    }

    return run;
  }

  /**
   * 根据触发类型和上下文确定优先级
   */
  private determinePriority(triggerType: TriggerType, context?: Record<string, unknown>): QueuePriority {
    if (triggerType === TriggerType.EVENT) {
      return 'HIGH';
    }
    if (triggerType === TriggerType.MANUAL && (context as any)?.priority === 'high') {
      return 'HIGH';
    }
    if (triggerType === TriggerType.API) {
      return 'NORMAL';
    }
    if (triggerType === TriggerType.SCHEDULE) {
      return 'LOW';
    }
    return 'NORMAL';
  }

  /**
   * Execute pending stages — delegate to StageOrchestrator with callbacks
   */
  private executePendingStages(execution: PipelineExecution): void {
    // Build the callbacks object that StageOrchestrator needs
    const callbacks = {
      evaluateCondition: (condition: string, exec: PipelineExecution) =>
        this.stageOrchestrator.evaluateCondition(condition, exec),
      checkApprovalGate: (exec: PipelineExecution, stage: Stage) =>
        this.gateController.checkApprovalGate(exec, stage),
      checkAndExecuteDeploymentStrategy: (exec: PipelineExecution, stage: Stage, tasks: Array<{ id: string; name: string; type: string; parameters: Record<string, unknown>; status?: string }>) =>
        this.gateController.checkAndExecuteDeploymentStrategy(exec, stage, tasks),
      checkStageQualityGate: (exec: PipelineExecution, stage: Stage) =>
        this.gateController.checkStageQualityGate(exec, stage, this.stageOrchestrator.getVariableContexts()),
      checkRunCompletion: (exec: PipelineExecution) =>
        this.checkRunCompletion(exec),
    };

    this.stageOrchestrator.executePendingStages(execution, callbacks).catch(err => {
      logger.error({ runId: execution.run.id, error: err }, 'executePendingStages failed');
    });
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
        this.sseBridge?.publishRunFailed(execution.run.pipelineId, execution.run, 'Pipeline execution failed');
      } else {
        await this.runService.completeRun(execution.run.id, PipelineRunStatus.SUCCESS);
        this.sseBridge?.publishRunCompleted(execution.run.pipelineId, execution.run);
      }

      // 获取更新后的 run 数据并触发回调
      const completedRun = await this.runService.getRun(execution.run.id);
      if (completedRun && this.onRunComplete) {
        this.onRunComplete(completedRun);
      }

      // 发送 IM 通知（delegate to NotificationDispatcher）
      if (completedRun) {
        this.notificationDispatcher.sendIMNotifications(completedRun).catch(err => {
          logger.warn({ runId: completedRun.id, error: err }, 'IM notification batch sending failed (non-fatal)');
        });
      }

      // 发送 Webhook 通知（delegate to NotificationDispatcher）
      if (completedRun) {
        this.notificationDispatcher.sendWebhookNotifications(completedRun, this.executions).catch(err => {
          logger.warn({ runId: completedRun.id, error: err }, 'Webhook notification batch sending failed (non-fatal)');
        });
      }

      // SCM bidirectional: write pipeline result back to PR/commit (delegate to ScmStatusReporter)
      if (completedRun) {
        const scmOutcome = hasFailure ? 'failure' as const : 'success' as const;
        this.scmStatusReporter.reportScmStatus(completedRun, scmOutcome, this.executions).catch(err => {
          logger.warn({ runId: completedRun.id, error: err }, 'SCM status reporting failed (non-fatal)');
        });
      }

      // Cleanup checkpoint after pipeline completion
      if (this.checkpointManager) {
        await this.checkpointManager.cleanupCompleted(execution.run.id);
      }

      // Cleanup debug session
      if (this.debugController) {
        this.debugController.unregisterRun(execution.run.id);
        logger.debug({ runId: execution.run.id }, 'Debug session unregistered on pipeline completion');
      }

      // 清理执行上下文
      this.executions.delete(execution.run.id);
      this.stageOrchestrator.cleanupVariableContext(execution.run.id);
    }
  }

  /**
   * 获取执行中的 PipelineRun
   */
  getExecution(runId: string): PipelineExecution | undefined {
    return this.executions.get(runId);
  }

  /**
   * 取消正在执行的 PipelineRun（FIXED P0-4）
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
        this.sseBridge?.publishStageSkipped(execution.run.pipelineId, execution.run.id, cancelledStage);
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
        this.sseBridge?.publishStageSkipped(execution.run.pipelineId, execution.run.id, skippedStage);
      }
    }

    // 取消 PipelineRun
    await this.runService.cancelRun(runId);

    // Publish SSE run cancelled event
    this.sseBridge?.publishRunCancelled(execution.run.pipelineId, execution.run);

    // SCM bidirectional: write cancellation back (delegate to ScmStatusReporter)
    this.scmStatusReporter.reportScmStatus(execution.run, 'cancelled', this.executions).catch(err => {
      logger.warn({ runId: execution.run.id, error: err }, 'SCM status reporting failed (non-fatal)');
    });

    // Cleanup checkpoint on cancellation
    if (this.checkpointManager) {
      await this.checkpointManager.cleanupCompleted(runId);
    }

    // 清理执行上下文
    this.executions.delete(runId);
    this.stageOrchestrator.cleanupVariableContext(runId);

    return true;
  }

  // ==================== Approval Gate Delegation ====================

  /**
   * 审批通过一个 stage
   */
  async approveStage(
    runId: string,
    stageId: string,
    userId: string,
    comment?: string
  ): Promise<void> {
    // Delegate approval to gate controller
    await this.gateController.approveStage(runId, stageId, userId, comment);

    // 将 stage 重新加入待处理队列，触发继续执行
    this.resumeAfterApproval(runId, stageId);
  }

  /**
   * 审批拒绝一个 stage
   */
  async rejectStage(
    runId: string,
    stageId: string,
    userId: string,
    comment?: string
  ): Promise<void> {
    // Delegate rejection to gate controller
    await this.gateController.rejectStage(runId, stageId, userId, comment);

    // 标记 pipeline 为失败
    const execution = this.executions.get(runId);
    if (execution) {
      const stage = execution.stages.get(stageId);
      if (stage) {
        const rejectedStage = {
          ...stage,
          status: StageStatus.FAILED,
          completedAt: new Date(),
          error: `Approval rejected by ${userId}${comment ? `: ${comment}` : ''}`,
        };
        execution.stages.set(stageId, rejectedStage);
        await this.runService.updateStage(rejectedStage);
        await this.eventPublisher.publishStageFailed(execution.run.id, rejectedStage, rejectedStage.error);
        this.sseBridge?.publishStageFailed(execution.run.pipelineId, execution.run.id, rejectedStage, rejectedStage.error);

        execution.runningStages.delete(stageId);
        execution.completedStages.add(stageId);

        // Checkpoint: stage rejected by approval
        await this.stageOrchestrator.saveCheckpoint(execution, stage.name);

        // 标记依赖于此 stage 的其他 stages 为失败
        this.stageOrchestrator.failDependentStages(execution, rejectedStage);
        this.checkRunCompletion(execution);
      }
    }
  }

  /**
   * 审批通过后恢复 stage 执行
   */
  private resumeAfterApproval(runId: string, stageId: string): void {
    const execution = this.executions.get(runId);
    if (!execution) return;

    const stage = execution.stages.get(stageId);
    if (!stage) return;

    // 将 stage 重新加入待处理队列
    execution.pendingStages.add(stageId);

    // 触发执行
    this.executePendingStages(execution);
  }

  /**
   * 获取审批状态
   */
  async getApprovalStatus(runId: string, stageId: string) {
    return this.gateController.getApprovalStatus(runId, stageId);
  }

  /**
   * 获取 run 的所有审批请求
   */
  async getApprovalRequestsByRun(runId: string) {
    return this.gateController.getApprovalRequestsByRun(runId);
  }

  // ==================== Execution Queue Methods ====================

  /**
   * 获取执行队列实例
   */
  getExecutionQueue(): PipelineExecutionQueue | null {
    return this.executionQueue;
  }

  /**
   * 获取队列统计信息
   */
  getQueueStats() {
    return this.executionQueue?.getStats() || null;
  }

  /**
   * 获取队列中等待的 runs
   */
  getQueuedRuns() {
    return this.executionQueue?.getQueuedRuns() || [];
  }

  /**
   * 从队列中取消指定的 run
   */
  cancelQueuedRun(runId: string): boolean {
    if (!this.executionQueue) return false;
    return this.executionQueue.remove(runId);
  }

  // ==================== Crash Recovery ====================

  /**
   * Recover orphaned runs during startup using checkpoint data.
   */
  async recoverOrphanedRuns(options?: {
    onRestored?: (execution: PipelineExecution) => void;
    markFailedIfStale?: boolean;
  }): Promise<{ recovered: number; markedFailed: number; restored: number; errors: string[] }> {
    if (!this.checkpointManager) {
      logger.info('Checkpoint manager not configured, falling back to legacy recovery');
      const legacyResult = await this.recoverRuns();
      return { ...legacyResult, restored: 0 };
    }

    const recoveryResult = await this.checkpointManager.recoverOrphanedRuns(
      {
        getRun: (id) => this.runService.getRun(id),
        completeRun: (id, status) => this.runService.completeRun(id, status),
      },
      {
        onRestored: (execution) => {
          // Re-add to in-memory executions map
          this.executions.set(execution.run.id, execution);
          logger.info(
            { runId: execution.run.id, pendingStages: execution.pendingStages.size },
            'Restored execution to in-memory map'
          );
          // Notify caller for re-enqueue or resume
          options?.onRestored?.(execution);
        },
        markFailedIfStale: options?.markFailedIfStale,
      }
    );

    logger.info(
      { recovered: recoveryResult.recovered, restored: recoveryResult.restored, markedFailed: recoveryResult.markedFailed },
      'Orphaned run recovery complete'
    );

    return recoveryResult;
  }

  /**
   * 恢复中断的 Pipeline Runs
   */
  async recoverRuns(): Promise<{ recovered: number; markedFailed: number; restored: number; errors: string[] }> {
    if (!this.runService) {
      return { recovered: 0, markedFailed: 0, restored: 0, errors: ['RunService not available'] };
    }

    const errors: string[] = [];
    let markedFailed = 0;
    let runningCount = 0;

    try {
      const runningRuns = await this.runService.findRunsByStatus(PipelineRunStatus.RUNNING);
      runningCount = runningRuns.length;

      if (runningRuns.length === 0) {
        logger.info('No running pipeline runs to recover');
        return { recovered: 0, markedFailed: 0, restored: 0, errors: [] };
      }

      logger.info(
        { count: runningRuns.length, runIds: runningRuns.map(r => r.id) },
        'Found running pipeline runs to recover'
      );

      for (const run of runningRuns) {
        try {
          await this.runService.completeRun(run.id, PipelineRunStatus.FAILED);
          await this.eventPublisher.publishRunFailed(run, 'Server restarted, pipeline run interrupted');
          this.sseBridge?.publishRunFailed(run.pipelineId, run, 'Server restarted, pipeline run interrupted');
          markedFailed++;
          logger.info({ runId: run.id }, 'Marked interrupted pipeline run as failed');
        } catch (err) {
          const errMsg = `Failed to recover run ${run.id}: ${err instanceof Error ? err.message : String(err)}`;
          errors.push(errMsg);
          logger.error({ runId: run.id, error: err }, 'Failed to recover pipeline run');
        }
      }
    } catch (err) {
      errors.push(`Recovery scan failed: ${err instanceof Error ? err.message : String(err)}`);
      logger.error({ error: err }, 'Pipeline run recovery scan failed');
    }

    return {
      recovered: runningCount,
      markedFailed,
      restored: 0,
      errors,
    };
  }

  /**
   * 重建执行队列（从数据库加载待执行的 runs）
   */
  async rebuildExecutionQueue(): Promise<number> {
    if (!this.executionQueue) return 0;

    logger.info('Execution queue rebuild: no persistent pending executions to restore');
    return 0;
  }

  /**
   * Get the DebugController instance (for HTTP routes to access).
   */
  getDebugController(): DebugController | null {
    return this.debugController;
  }
}
