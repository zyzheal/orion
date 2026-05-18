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
import { SubPipelineInvocation, SubPipelineStatus } from '../models/SubPipeline';
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
import { ExpressionEvaluator, ExpressionContext, EvaluationError } from './ExpressionEvaluator';
import { PipelineCheckpointManager } from './PipelineCheckpointManager';
import { IMNotifier, IMNotificationConfig } from '../services/pipeline/IMNotifier';
import { WebhookNotifier, WebhookConfig as WebhookNotifierConfig, WebhookPayload, WebhookEventType, StageSummary } from '../services/pipeline/WebhookNotifier';
import { WebhookConfigRepository, WebhookConfigEntity } from '../repositories/WebhookConfigRepository';
import { QualityGateService } from '../services/pipeline/QualityGateService';
import { QualityGateResult } from '../models/QualityGate';
import { DeploymentStrategyService, CanaryConfig, BlueGreenConfig, RollingConfig } from '../services/pipeline/DeploymentStrategyService';
import { MatrixExpander } from './MatrixExpander';
import { VariableContext } from './VariableContext';
import { DebugController } from './DebugController';
import { YamlPreprocessor } from './YamlPreprocessor';
import { SharedActionService } from '../services/pipeline/SharedActionService';
import { SecretsService, SecretsServiceConfig } from '../services/pipeline/SecretsService';
import { SecretRepository } from '../repositories/SecretRepository';
import { getGlobalSecretsService } from '../api/secret-routes';
import { CommitStatusService, CommitStatus, GitProvider, StageSummaryItem } from '../services/code-repo/CommitStatusService';
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
  private pipelineService: PipelineService;
  private runService: PipelineRunService;
  private eventPublisher: PipelineEventPublisher;
  private sseBridge: PipelineEventSSEBridge | null;
  private stageExecutor: StageExecutor;
  private subPipelineService: SubPipelineService | null;
  private artifactService: ArtifactService | null;
  private approvalGateService: ApprovalGateService | null;
  private executionQueue: PipelineExecutionQueue | null;
  private autoRetryService: AutoRetryService | null;
  private onRunComplete: RunCompletionCallback | null;
  private expressionEvaluator: ExpressionEvaluator;
  private checkpointManager: PipelineCheckpointManager | null;
  private imNotifier: IMNotifier | null;
  private imNotificationConfigs: IMNotificationConfig[];
  private debugController: DebugController | null;
  private webhookNotifier: WebhookNotifier | null;
  private webhookConfigRepo: WebhookConfigRepository | null;
  private qualityGateService: QualityGateService | null;
  private deploymentStrategyService: DeploymentStrategyService | null;
  private yamlPreprocessor: YamlPreprocessor | null;
  private secretsService: SecretsService | null;
  private scmStatusService: CommitStatusService | null;

  // 内存存储执行中的 Pipeline
  private executions = new Map<string, PipelineExecution>();

  // Per-run variable contexts for task output propagation
  private variableContexts = new Map<string, VariableContext>();

  // 防止 checkNextStages 并发调用导致重复执行
  private nextStageCheckLocks = new Map<string, Promise<void>>();

  // 需要恢复的 pipeline runs（审批通过后重新触发）
  private resumeQueue = new Set<string>();

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
    this.stageExecutor = stageExecutor;
    this.subPipelineService = subPipelineService || null;
    this.artifactService = artifactService || null;
    this.approvalGateService = approvalGateService || null;
    this.executionQueue = executionQueue || null;
    this.autoRetryService = autoRetryService || null;
    this.onRunComplete = onRunComplete || null;
    this.expressionEvaluator = new ExpressionEvaluator();
    this.checkpointManager = checkpointManager || null;
    this.imNotifier = imNotifier || null;
    this.imNotificationConfigs = imNotificationConfigs || [];
    this.debugController = debugController || null;
    this.webhookNotifier = webhookNotifier || null;
    this.webhookConfigRepo = webhookConfigRepo || null;
    this.qualityGateService = qualityGateService || null;
    this.deploymentStrategyService = deploymentStrategyService || null;
    this.yamlPreprocessor = yamlPreprocessor || null;
    this.secretsService = secretsService || null;
    this.scmStatusService = scmStatusService || null;
  }

  /**
   * Initialize SecretsService from database connection.
   * Called during route registration to share the same instance.
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
      throw new Error(`Pipeline '${pipelineId}' not found`);
    }

    // 2. 解析 YAML
    let spec: { stages: PipelineYamlStage[] };
    try {
      if (!pipeline.yamlDefinition) {
        throw new Error('Pipeline has no YAML definition');
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
      throw new Error(`Failed to parse pipeline YAML: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

    // 4. 初始化 Stages (use expanded stages for matrix support)
    const stages = this.initializeStagesFromExpanded(run.id, expandedStages);
    for (const stage of stages) {
      await this.runService.addStage(run.id, stage);
    }

    // 5. 初始化 Tasks (use expanded stages for matrix support)
    for (const expanded of expandedStages) {
      const stage = stages.find(s => s.name === expanded.name)!;
      const tasks = this.initializeTasks(stage.id, expanded.stage.steps, expanded.stage.runsOn);
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

    // 6.1. Create VariableContext for this run
    const variableCtx = new VariableContext(run.id);
    // Initialize with context variables (branch, triggerBy, etc.)
    if (context) {
      for (const [key, value] of Object.entries(context)) {
        if (typeof value === 'string') {
          variableCtx.setVariable(key, value);
        }
      }
    }
    this.variableContexts.set(run.id, variableCtx);
    // Set variable context on StageExecutor for this run
    this.stageExecutor.setVariableContext(variableCtx);

    // 6.2. Register debug session if DebugController is available
    if (this.debugController) {
      this.debugController.registerRun(run.id, { status: 'running' });
      logger.debug({ runId: run.id }, 'Debug session registered for pipeline run');
    }

    // 6.5. GAP-06: Handle retry from specific stage / only failed stages
    // If the run context contains retry metadata, pre-mark skipped stages as SUCCESS
    this.applyRetrySkipMetadata(execution);

    // 7. 开始执行（使用队列或直接执行）
    await this.runService.startRun(run.id);

    // 7.1. Publish SSE run started event
    this.sseBridge?.publishRunStarted(pipelineId, run);

    // 7.2. Report SCM commit status as pending (write-back to PR/commit)
    this.reportScmStatus(run, 'pending').catch(err => {
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
    // 事件触发（如部署失败回滚）通常为高优先级
    if (triggerType === TriggerType.EVENT) {
      return 'HIGH';
    }
    // 手动触发且有紧急标记时为高优先级
    if (triggerType === TriggerType.MANUAL && (context as any)?.priority === 'high') {
      return 'HIGH';
    }
    // API 触发为普通优先级
    if (triggerType === TriggerType.API) {
      return 'NORMAL';
    }
    // 定时任务为低优先级
    if (triggerType === TriggerType.SCHEDULE) {
      return 'LOW';
    }
    return 'NORMAL';
  }

  /**
   * 初始化 Stages
   */
  private initializeStages(runId: string, yamlStages: PipelineYamlStage[]): Stage[] {
    return yamlStages.map((yamlStage, index) => {
      const stage = createStage({
        runId,
        name: yamlStage.name,
        sequence: index,
        dependsOn: yamlStage.dependsOn || [],
        condition: yamlStage.if,
        timeoutSeconds: yamlStage.timeout || 3600,
        maxRetries: yamlStage.retries || 0,
      });
      // Store stage outputs declaration for later registration
      if (yamlStage.outputs) {
        stage.result = { outputs: yamlStage.outputs };
      }
      return stage;
    });
  }

  /**
   * 初始化 Stages (from expanded matrix stages) — GAP-02
   */
  private initializeStagesFromExpanded(
    runId: string,
    expandedStages: Array<{ stage: PipelineYamlStage; name: string }>
  ): Stage[] {
    return expandedStages.map((expanded, index) =>
      createStage({
        runId,
        name: expanded.name,
        sequence: index,
        dependsOn: expanded.stage.dependsOn || [],
        condition: expanded.stage.if,
        timeoutSeconds: expanded.stage.timeout || 3600,
        maxRetries: expanded.stage.retries || 0,
      })
    );
  }

  /**
   * 初始化 Tasks
   */
  private initializeTasks(stageId: string, steps: { name: string; uses: string; with?: Record<string, unknown> }[], runsOn?: string): Task[] {
    const runnerLabels = runsOn ? runsOn.split(',').map(l => l.trim()).filter(Boolean) : [];
    return steps.map((step, index) => {
      const [type] = step.uses.split('@');
      const parameters: Record<string, unknown> = {
        ...(step.with || {}),
      };
      // GAP-CN-07: Pass runner labels for remote runner selection
      if (runnerLabels.length > 0) {
        parameters.__runnerLabels = runnerLabels;
      }
      return createTask({
        stageId,
        name: step.name,
        type,
        sequence: index,
        config: { uses: step.uses } as Record<string, unknown>,
        parameters,
        timeoutSeconds: 600,
      });
    });
  }

  /**
   * GAP-06: Apply retry skip metadata to pre-mark stages as SUCCESS.
   *
   * When a run is retried with `fromStage` or `onlyFailed`, the config_snapshot
   * contains `skippedStages` — stages that were already completed in the original run
   * and should not be re-executed. These stages are pre-marked as SUCCESS so the
   * engine treats them as completed and skips execution.
   */
  private applyRetrySkipMetadata(execution: PipelineExecution): void {
    const skippedStages = (execution.run.context as any)?.skippedStages;
    if (!skippedStages || !Array.isArray(skippedStages) || skippedStages.length === 0) {
      return;
    }

    const skippedStageNames = new Set(skippedStages);
    let skipCount = 0;

    for (const [stageId, stage] of execution.stages.entries()) {
      if (skippedStageNames.has(stage.name)) {
        // Pre-mark stage as SUCCESS (reuse original duration if available)
        const completedStage = {
          ...stage,
          status: StageStatus.SUCCESS,
          startedAt: stage.startedAt || new Date(),
          completedAt: new Date(),
          durationMs: stage.durationMs || 0,
        };
        execution.stages.set(stageId, completedStage);
        execution.pendingStages.delete(stageId);
        execution.completedStages.add(stageId);
        skipCount++;
      }
    }

    if (skipCount > 0) {
      logger.info(
        { runId: execution.run.id, skippedCount: skipCount, skippedStages },
        'GAP-06: Pre-marked stages as SUCCESS (retry from stage / only failed)'
      );
    }
  }

  /**
   * 执行待处理的 Stages
   * 改进：支持并行执行 — 检测无依赖关系的 stages，使用 Promise.allSettled 并发执行
   * Phase 2: 新增审批网关检查
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
        this.sseBridge?.publishStageSkipped(execution.run.pipelineId, execution.run.id, skippedStage);

        execution.pendingStages.delete(stageId);
        execution.completedStages.add(stageId);
        // Checkpoint: stage skipped due to condition
        await this.saveCheckpoint(execution, stage.name);
        continue;
      }

      // Phase 2: 检查审批网关
      const approvalCheck = await this.checkApprovalGate(execution, stage);
      if (approvalCheck === 'pending') {
        // 审批尚未通过，从待处理中移除但标记为等待审批
        execution.pendingStages.delete(stageId);
        // 不加入 eligibleStageIds，等待审批通过后再执行
        continue;
      } else if (approvalCheck === 'rejected') {
        // 审批被拒绝，跳过此 stage
        const skippedStage = {
          ...stage,
          status: StageStatus.SKIPPED,
          completedAt: new Date(),
          error: 'Approval rejected',
        };
        execution.stages.set(stageId, skippedStage);
        await this.runService.updateStage(skippedStage);
        await this.eventPublisher.publishStageSkipped(execution.run.id, skippedStage);
        this.sseBridge?.publishStageSkipped(execution.run.pipelineId, execution.run.id, skippedStage);

        execution.pendingStages.delete(stageId);
        execution.completedStages.add(stageId);
        continue;
      }

      // 审批通过或不需要审批，加入可执行列表
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
    this.sseBridge?.publishStageStarted(execution.run.pipelineId, execution.run.id, runningStage);
    // Checkpoint: stage started
    await this.saveCheckpoint(execution, stage.name);

    try {
      // 获取 Stage 的 Tasks
      const tasks = await this.runService.getTasks(stage.id);

      // Resolve variable references in task parameters before execution
      const variableCtx = this.variableContexts.get(execution.run.id);
      const resolvedTasks = variableCtx
        ? tasks.map(t => {
            const resolvedParams = variableCtx.resolveObject(
              t.parameters as Record<string, unknown>
            );
            return { ...t, parameters: resolvedParams as Record<string, unknown> };
          })
        : tasks;

      // GAP-03: Check if this is a sub-pipeline stage type
      const isSubPipelineStage = resolvedTasks.length > 0 &&
        resolvedTasks[0].type === 'sub-pipeline';

      if (isSubPipelineStage) {
        const taskObjects = resolvedTasks.map(t => ({
          id: t.id,
          name: t.name,
          type: t.type,
          parameters: t.parameters,
          // Spread remaining Task properties for index signature compatibility
          ...t as unknown as Record<string, unknown>,
        }));
        await this.executeSubPipelineStage(execution, stage, taskObjects);
        return;
      }

      // GAP-CN-03: Check if this stage has a deployment strategy configured
      const deploymentResult = await this.checkAndExecuteDeploymentStrategy(execution, stage, resolvedTasks);
      if (deploymentResult !== null) {
        // deployment strategy handled stage completion/failure
        execution.runningStages.delete(stage.id);
        execution.completedStages.add(stage.id);
        this.checkNextStages(execution);
        return;
      }

      // 按顺序执行 Tasks
      for (const task of resolvedTasks) {
        if (task.status !== 'pending') continue;

        // Resolve ${secrets.XXX} references in task parameters before execution
        let resolvedTask = task;
        const secretsSvc = this.secretsService || getGlobalSecretsService();
        if (secretsSvc) {
          const tenantId = (execution.run.context as any)?.tenantId || 'default';
          if (tenantId) {
            try {
              const secretResult = await secretsSvc.resolveTaskSecrets(tenantId, task.parameters);
              if (secretResult.secretValues.length > 0 || secretResult.unresolved.length > 0) {
                logger.info(
                  { taskId: task.id, resolved: secretResult.secretValues.length, unresolved: secretResult.unresolved.length },
                  'Secret references resolved in task parameters'
                );
              }
              // If there are unresolved references, fail the task instead of silently passing through
              if (secretResult.unresolved.length > 0) {
                throw new Error(`Unresolved secret references: ${secretResult.unresolved.join(', ')}`);
              }
              // Update task parameters with resolved values (merge env into parameters)
              resolvedTask = { ...task, parameters: { ...task.parameters, ...secretResult.env } };
            } catch (error) {
              // Re-throw to fail the task if secrets can't be resolved
              throw error;
            }
          }
        }

        // Debug integration: check if we should pause before this task
        if (this.debugController && this.debugController.shouldPause(execution.run.id)) {
          // Block until resume signal (or step mode allows one task)
          await this.debugController.waitForSignal(execution.run.id);
        }

        const result = await this.stageExecutor.executeTask(
          execution.run.pipelineId,
          execution.run.id,
          stage,
          resolvedTask,
          { stageName: stage.name, taskName: task.name }
        );
        await this.runService.updateTask(result);

        // Debug integration: after task completes in step mode, re-pause
        if (this.debugController) {
          this.debugController.completeStep(execution.run.id, { taskId: task.id, status: result.status });
        }

        // Checkpoint: task completed
        await this.saveCheckpoint(execution, stage.name, task.name);

        if (result.status === 'failed') {
          throw new Error(result.error || `Task '${task.name}' failed`);
        }
      }

      // Register stage-level outputs in VariableContext
      this.registerStageOutputs(execution, stage);

      // GAP-CN-04: Evaluate quality gate if configured
      const gateCheckResult = await this.checkStageQualityGate(execution, stage);
      if (gateCheckResult) {
        throw new Error(gateCheckResult.reason);
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
      this.sseBridge?.publishStageCompleted(execution.run.pipelineId, execution.run.id, completedStage);
      // Checkpoint: stage completed
      await this.saveCheckpoint(execution, stage.name);

      execution.runningStages.delete(stage.id);
      execution.completedStages.add(stage.id);

      // 检查是否有新的 Stages 可以执行
      this.checkNextStages(execution);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Phase 3: 使用 AutoRetryService 进行智能重试
      if (this.autoRetryService) {
        const retryResult = await this.autoRetryService.shouldRetry(
          errorMessage,
          stage.retryCount,
          {
            stageName: stage.name,
            retryCount: stage.retryCount,
            maxRetries: stage.maxRetries,
          }
        );

        if (retryResult.shouldRetry) {
          logger.info(
            { runId: execution.run.id, stageName: stage.name, errorType: retryResult.classification.type, strategy: retryResult.strategy },
            'Auto-retry: retrying stage'
          );
          // 执行带退避的重试
          await this.retryStageWithBackoff(execution, stage, retryResult.strategy, errorMessage);
          this.checkRunCompletion(execution);
          return;
        }

        // 不应重试，继续失败处理
        logger.info(
          { runId: execution.run.id, stageName: stage.name, errorType: retryResult.classification.type },
          'Auto-retry: stage not retryable'
        );
      }

      // Stage 失败
      const failedStage = {
        ...runningStage,
        status: StageStatus.FAILED,
        completedAt: new Date(),
        durationMs: Date.now() - runningStage.startedAt!.getTime(),
        error: errorMessage,
      };
      execution.stages.set(stage.id, failedStage);
      await this.runService.updateStage(failedStage);
      await this.eventPublisher.publishStageFailed(execution.run.id, failedStage, failedStage.error);
      this.sseBridge?.publishStageFailed(execution.run.pipelineId, execution.run.id, failedStage, failedStage.error);
      // Checkpoint: stage failed
      await this.saveCheckpoint(execution, stage.name);

      execution.runningStages.delete(stage.id);
      execution.completedStages.add(stage.id);

      // 检查是否需要重试（旧逻辑，当 AutoRetryService 不可用时使用）
      if (!this.autoRetryService && this.shouldRetry(stage)) {
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
   * 带退避策略的 Stage 重试
   */
  private async retryStageWithBackoff(
    execution: PipelineExecution,
    stage: Stage,
    strategy: 'immediate' | 'backoff' | 'skip',
    error: string
  ): Promise<void> {
    const retryCount = stage.retryCount + 1;

    // 更新重试计数
    const retriedStage = {
      ...stage,
      retryCount,
      status: StageStatus.PENDING,
      startedAt: undefined,
      completedAt: undefined,
      durationMs: undefined,
      error: undefined,
    };
    execution.stages.set(stage.id, retriedStage);
    await this.runService.updateStage(retriedStage);
    // Checkpoint: stage reset for retry
    await this.saveCheckpoint(execution, stage.name);

    // 根据策略计算延迟
    let delayMs = 0;
    if (strategy === 'backoff') {
      delayMs = Math.min(1000 * Math.pow(2, retryCount - 1), 30000);
      // 添加 jitter
      delayMs = Math.round(delayMs * (0.5 + Math.random() * 0.5));
    }

    if (delayMs > 0) {
      logger.info(
        { runId: execution.run.id, stageName: stage.name, retryCount, delayMs },
        'Waiting before retry'
      );
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    // 重新加入待处理队列并执行
    execution.pendingStages.add(stage.id);
    execution.completedStages.delete(stage.id);
    await this.executePendingStages(execution);
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
        this.sseBridge?.publishStageSkipped(execution.run.pipelineId, execution.run.id, skippedStage);
        execution.completedStages.add(stageId);
        // Checkpoint: stage skipped
        await this.saveCheckpoint(execution, stage.name);
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
        this.sseBridge?.publishRunFailed(execution.run.pipelineId, execution.run, 'Pipeline execution failed');
      } else {
        await this.runService.completeRun(execution.run.id, PipelineRunStatus.SUCCESS);
        this.sseBridge?.publishRunCompleted(execution.run.pipelineId, execution.run);
      }

      // 获取更新后的 run 数据并触发回调（用于 metrics 记录）
      const completedRun = await this.runService.getRun(execution.run.id);
      if (completedRun && this.onRunComplete) {
        this.onRunComplete(completedRun);
      }

      // 发送 IM 通知（通知发送失败不影响 pipeline 状态）
      if (completedRun && this.imNotifier && this.imNotificationConfigs.length > 0) {
        this.sendIMNotifications(completedRun).catch(err => {
          logger.warn({ runId: completedRun.id, error: err }, 'IM notification batch sending failed (non-fatal)');
        });
      }

      // 发送 Webhook 通知（通知发送失败不影响 pipeline 状态）
      if (completedRun && this.webhookNotifier) {
        this.sendWebhookNotifications(completedRun).catch(err => {
          logger.warn({ runId: completedRun.id, error: err }, 'Webhook notification batch sending failed (non-fatal)');
        });
      }

      // SCM bidirectional: write pipeline result back to PR/commit
      if (completedRun) {
        const scmOutcome = hasFailure ? 'failure' as const : 'success' as const;
        this.reportScmStatus(completedRun, scmOutcome).catch(err => {
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
      // Clean up variable context
      this.variableContexts.delete(execution.run.id);
    }
  }

  /**
   * 发送 IM 通知（根据 Pipeline 最终状态分发到不同 IM 渠道）
   * 此方法异步执行，失败不影响 Pipeline 状态
   */
  private async sendIMNotifications(run: PipelineRun): Promise<void> {
    if (!this.imNotifier) return;

    // 从 PipelineService 获取 Pipeline 名称
    const pipeline = await this.pipelineService.getById(run.pipelineId);
    const pipelineName = pipeline?.name || run.pipelineId;

    try {
      if (run.status === PipelineRunStatus.SUCCESS) {
        for (const config of this.imNotificationConfigs) {
          await this.imNotifier.notifyOnPipelineComplete(run, config, pipelineName);
        }
      } else if (run.status === PipelineRunStatus.FAILED) {
        for (const config of this.imNotificationConfigs) {
          await this.imNotifier.notifyOnPipelineFailure(run, config, pipelineName);
        }
      } else if (run.status === PipelineRunStatus.CANCELLED) {
        for (const config of this.imNotificationConfigs) {
          await this.imNotifier.notifyOnPipelineCancelled(run, config, pipelineName);
        }
      }
    } catch (error) {
      // IM 通知失败不应影响 pipeline 状态，仅记录日志
      logger.warn(
        { runId: run.id, error: error instanceof Error ? error.message : String(error) },
        'IM notification sending failed (non-fatal)'
      );
    }
  }

  /**
   * 发送 Webhook 通知（根据 Pipeline 最终状态向外部系统推送事件）
   * 此方法异步执行，失败不影响 Pipeline 状态
   */
  private async sendWebhookNotifications(run: PipelineRun): Promise<void> {
    if (!this.webhookNotifier) return;

    // 从 PipelineService 获取 Pipeline 名称
    const pipeline = await this.pipelineService.getById(run.pipelineId);
    const pipelineName = pipeline?.name || run.pipelineId;

    // 确定事件类型
    const eventType: WebhookEventType | undefined =
      run.status === PipelineRunStatus.SUCCESS ? 'pipeline.complete' :
      run.status === PipelineRunStatus.FAILED ? 'pipeline.failed' :
      run.status === PipelineRunStatus.CANCELLED ? 'pipeline.cancelled' :
      undefined;

    if (!eventType) {
      logger.debug({ runId: run.id, status: run.status }, 'No webhook event type for pipeline status, skipping');
      return;
    }

    // 从仓库获取该 Pipeline 的 Webhook 配置
    const webhookConfigs = this.webhookConfigRepo
      ? await this.webhookConfigRepo.findByEvent(run.pipelineId, eventType)
      : [];

    if (webhookConfigs.length === 0) {
      logger.debug({ pipelineId: run.pipelineId, eventType }, 'No matching webhook configs, skipping');
      return;
    }

    // 构建 stages summary（从执行上下文或数据库获取）
    const stagesSummary: StageSummary[] = await this.buildStagesSummary(run.id);

    // 构建 Webhook payload
    const payload: WebhookPayload = {
      eventType,
      runId: run.id,
      pipelineId: run.pipelineId,
      status: run.status === PipelineRunStatus.SUCCESS ? 'success' :
              run.status === PipelineRunStatus.FAILED ? 'failed' : 'cancelled',
      timestamp: new Date(),
      durationMs: run.durationMs,
      stagesSummary,
      triggerBy: run.triggerBy,
      metadata: {
        pipelineName,
        pipelineVersion: run.pipelineVersion,
        triggerType: run.triggerType,
        context: run.context,
      },
    };

    // 将 WebhookConfigEntity 转换为 WebhookNotifierConfig
    const notifierConfigs: WebhookNotifierConfig[] = webhookConfigs.map(config => ({
      url: config.url,
      method: config.method,
      headers: config.headers,
      secret: config.secret || undefined,
      events: config.events,
      retries: config.retries,
    }));

    // 并行发送所有匹配的 Webhook
    logger.info(
      { runId: run.id, pipelineId: run.pipelineId, eventType, webhookCount: notifierConfigs.length },
      'Sending webhook notifications'
    );

    await this.webhookNotifier.sendAll(notifierConfigs, payload);
  }

  /**
   * 构建 Stages 摘要信息
   */
  private async buildStagesSummary(runId: string): Promise<StageSummary[]> {
    // 先从内存执行上下文查找（如果还在内存中）
    const execution = this.executions.get(runId);
    if (execution) {
      return Array.from(execution.stages.values()).map(stage => ({
        name: stage.name,
        status: stage.status,
        durationMs: stage.durationMs || 0,
      }));
    }

    // 回退到从数据库查询
    try {
      const stages = await this.runService.getStages(runId);
      return stages.map(stage => ({
        name: stage.name,
        status: stage.status,
        durationMs: stage.durationMs || 0,
      }));
    } catch (error) {
      logger.warn({ runId, error: error instanceof Error ? error.message : String(error) },
        'Failed to build stages summary for webhook');
      return [];
    }
  }

  // ==================== SCM Bidirectional Status Write-Back ====================

  /**
   * Report pipeline status back to the SCM provider (GitHub/GitLab).
   *
   * This writes a commit status and, when available, a PR comment with
   * structured results. The pipeline run context must contain SCM metadata
   * in `context.git` or `context.scmProvider`/`context.repository`.
   *
   * @param run - The completed (or starting) pipeline run
   * @param outcome - The outcome to report: 'pending', 'success', 'failure', 'cancelled'
   */
  private async reportScmStatus(
    run: PipelineRun,
    outcome: 'pending' | 'success' | 'failure' | 'cancelled'
  ): Promise<void> {
    if (!this.scmStatusService) return;

    // Extract SCM context from the run
    const gitCtx = (run.context as any)?.git || {};
    const commitSha = gitCtx.sha || (run.context as any)?.commitSha || gitCtx.commitSha;
    const repository = gitCtx.repo || (run.context as any)?.repository || (run.context as any)?.scmProvider;

    if (!commitSha) {
      logger.debug({ runId: run.id }, 'No commit SHA in run context, skipping SCM status');
      return;
    }

    // Determine provider from repository string or explicit context
    const provider = this.resolveGitProvider(repository, run);
    if (!provider) {
      logger.debug({ runId: run.id, repository }, 'Could not resolve Git provider, skipping SCM status');
      return;
    }

    const statusState = this.mapOutcomeToCommitStatus(outcome);
    const pipelineName = await this.getPipelineName(run.pipelineId);
    const targetUrl = `${process.env.ORION_BASE_URL || 'http://localhost:3000'}/pipelines/${run.pipelineId}/runs/${run.id}`;

    // Build description based on outcome
    const description = outcome === 'pending'
      ? `Pipeline "${pipelineName}" is running...`
      : outcome === 'success'
        ? `Pipeline "${pipelineName}" completed successfully`
        : outcome === 'failure'
          ? `Pipeline "${pipelineName}" failed`
          : `Pipeline "${pipelineName}" was cancelled`;

    try {
      await this.scmStatusService.createStatus({
        repositoryId: repository || 'unknown',
        commitSha,
        state: statusState,
        targetUrl,
        description,
        context: `orion/${pipelineName}`,
      });

      logger.info(
        { runId: run.id, provider, commitSha, state: statusState, context: `orion/${pipelineName}` },
        'SCM commit status reported'
      );

      // Post PR comment on completion (not for pending)
      if (outcome !== 'pending') {
        await this.reportPrCommentIfNeeded(run, outcome, pipelineName, targetUrl);
      }
    } catch (error) {
      logger.error(
        { runId: run.id, error: error instanceof Error ? error.message : String(error) },
        'SCM status reporting failed'
      );
    }
  }

  /**
   * Post a PR comment with pipeline results if the run is associated with a PR.
   */
  private async reportPrCommentIfNeeded(
    run: PipelineRun,
    outcome: 'success' | 'failure' | 'cancelled',
    pipelineName: string,
    targetUrl: string
  ): Promise<void> {
    if (!this.scmStatusService) return;

    const gitCtx = (run.context as any)?.git || {};
    const prNumber = (run.context as any)?.prNumber || gitCtx.prNumber || (run.context as any)?.pullRequest?.number;

    if (!prNumber) {
      return;
    }

    const repository = gitCtx.repo || (run.context as any)?.repository || 'unknown';
    const provider = this.resolveGitProvider(repository, run);
    if (!provider) return;

    // Build stages summary
    const stagesSummary: StageSummaryItem[] = await this.buildStagesSummary(run.id);

    // PR number must be a number
    const prNum = typeof prNumber === 'number' ? prNumber : parseInt(prNumber, 10);
    if (isNaN(prNum)) return;

    await this.scmStatusService.postPrComment(
      provider,
      repository,
      prNum,
      run.id,
      pipelineName,
      outcome,
      targetUrl,
      stagesSummary
    );
  }

  /**
   * Resolve the Git provider from repository string or run context.
   */
  private resolveGitProvider(
    repository: string | undefined,
    run: PipelineRun
  ): GitProvider | null {
    const explicitProvider = (run.context as any)?.scmProvider;
    if (explicitProvider === 'github' || explicitProvider === 'gitlab') {
      return explicitProvider as GitProvider;
    }

    if (!repository) return null;

    // Infer from repository string format
    const lower = repository.toLowerCase();
    if (lower.startsWith('github:') || lower.includes('github.com')) {
      return GitProvider.GITHUB;
    }
    if (lower.startsWith('gitlab:') || lower.includes('gitlab.com')) {
      return GitProvider.GITLAB;
    }

    // Detect provider from repository ID pattern (matches CommitStatusService.detectProvider)
    if (repository.includes('gitlab') || repository.includes('gl-')) {
      return GitProvider.GITLAB;
    }
    if (repository.includes('github') || repository.includes('gh-')) {
      return GitProvider.GITHUB;
    }

    // Default to GitLab
    return GitProvider.GITLAB;
  }

  /**
   * Map pipeline outcome to CommitStatus enum.
   */
  private mapOutcomeToCommitStatus(
    outcome: 'pending' | 'success' | 'failure' | 'cancelled'
  ): CommitStatus {
    switch (outcome) {
      case 'pending': return CommitStatus.PENDING;
      case 'success': return CommitStatus.SUCCESS;
      case 'failure': return CommitStatus.FAILED;
      case 'cancelled': return CommitStatus.CANCELLED;
      default: return CommitStatus.PENDING;
    }
  }

  /**
   * Get pipeline name from PipelineService.
   */
  private async getPipelineName(pipelineId: string): Promise<string> {
    try {
      const pipeline = await this.pipelineService.getById(pipelineId);
      return pipeline?.name || pipelineId;
    } catch {
      return pipelineId;
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
    // Checkpoint: stage reset for retry
    await this.saveCheckpoint(execution, stage.name);
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
   * Register stage-level outputs in the VariableContext.
   *
   * If the stage declares outputs (via yamlStage.outputs), those values are
   * resolved against the current variable context and registered under the
   * stage name. This enables downstream stages to reference them via
   * ${tasks.<stageName>.outputs.<key>} syntax.
   */
  private registerStageOutputs(execution: PipelineExecution, stage: Stage): void {
    const variableCtx = this.variableContexts.get(execution.run.id);
    if (!variableCtx) return;

    // Find the original YAML stage definition to check for outputs declaration
    const stageEntry = Array.from(execution.stages.entries()).find(
      ([, s]) => s.id === stage.id
    );
    if (!stageEntry) return;

    // Stage outputs are stored in the stage's result field during initialization
    const stageOutputs = (stage.result as { outputs?: Record<string, string> } | undefined)?.outputs;
    if (!stageOutputs) return;

    for (const [key, valueTemplate] of Object.entries(stageOutputs)) {
      const resolvedValue = variableCtx.resolve(valueTemplate);
      variableCtx.setTaskOutput(stage.name, key, resolvedValue);
      logger.info(
        { runId: execution.run.id, stageName: stage.name, key, value: resolvedValue },
        'Stage output registered'
      );
    }
  }

  /**
   * GAP-03: Execute a sub-pipeline stage.
   *
   * When a stage's first task has type 'sub-pipeline', this method:
   * 1. Extracts child pipeline ID and input params from the task config
   * 2. Invokes the child pipeline via SubPipelineService
   * 3. Waits for child completion (with timeout)
   * 4. Maps child outputs to parent stage outputs and VariableContext
   * 5. Propagates child failures to parent stage failure
   */
  private async executeSubPipelineStage(
    execution: PipelineExecution,
    stage: Stage,
    tasks: Array<{ id: string; name: string; type: string; parameters: Record<string, unknown>; [key: string]: unknown }>
  ): Promise<void> {
    if (!this.subPipelineService) {
      throw new Error(
        `SubPipelineService not configured. ` +
        `Stage '${stage.name}' uses sub-pipeline type but SubPipelineService is not available.`
      );
    }

    const subPipelineTask = tasks[0];
    const params = subPipelineTask.parameters || {};
    const childPipelineId = params.pipelineId as string;

    if (!childPipelineId) {
      throw new Error(
        `Sub-pipeline stage '${stage.name}' missing required parameter: pipelineId`
      );
    }

    // Extract input parameters (params other than 'pipelineId' and 'outputMapping')
    const inputParams: Record<string, string> = {};
    for (const [key, value] of Object.entries(params)) {
      if (key !== 'pipelineId' && key !== 'outputMapping') {
        inputParams[key] = typeof value === 'string' ? value : String(value);
      }
    }

    // Extract output mapping
    const outputMapping = params.outputMapping as Record<string, string> | undefined;

    logger.info(
      {
        runId: execution.run.id,
        stageName: stage.name,
        childPipelineId,
        inputParams,
        outputMapping,
      },
      'GAP-03: Executing sub-pipeline stage'
    );

    // Invoke the child pipeline
    const { invocation, childRunId } = await this.subPipelineService.invoke({
      childPipelineId,
      parentRunId: execution.run.id,
      inputParams,
      stageName: stage.name,
      outputMapping,
    });

    // Wait for child pipeline to complete (default timeout: 1 hour)
    const timeoutMs = (params.timeoutMs as number) || 3600000;
    try {
      await this.subPipelineService.waitForCompletion(childRunId, timeoutMs);

      // Get results from child pipeline
      const results = await this.subPipelineService.getResults(childRunId);

      // Register results as stage outputs in VariableContext
      const variableCtx = this.variableContexts.get(execution.run.id);
      if (variableCtx) {
        for (const [key, value] of Object.entries(results)) {
          variableCtx.setTaskOutput(stage.name, key, value);
        }
      }

      // Stage 成功完成
      const completedStage = {
        ...execution.stages.get(stage.id)!,
        status: StageStatus.SUCCESS,
        completedAt: new Date(),
        result: { subPipeline: { childRunId, results }, outputs: outputMapping },
        durationMs: Date.now() - execution.stages.get(stage.id)!.startedAt!.getTime(),
      };
      execution.stages.set(stage.id, completedStage);
      await this.runService.updateStage(completedStage);
      await this.eventPublisher.publishStageCompleted(execution.run.id, completedStage);
      this.sseBridge?.publishStageCompleted(execution.run.pipelineId, execution.run.id, completedStage);
      await this.saveCheckpoint(execution, stage.name);

      execution.runningStages.delete(stage.id);
      execution.completedStages.add(stage.id);

      // 检查是否有新的 Stages 可以执行
      this.checkNextStages(execution);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Mark sub-pipeline as failed
      try {
        await this.subPipelineService.markFailed(childRunId, errorMessage);
      } catch (markError) {
        logger.warn(
          { childRunId, error: markError },
          'Failed to mark sub-pipeline as failed (non-fatal)'
        );
      }

      // Sub-pipeline failure propagates to parent stage failure
      throw new Error(`Sub-pipeline '${stage.name}' failed: ${errorMessage}`);
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
        this.sseBridge?.publishStageSkipped(execution.run.pipelineId, execution.run.id, skippedStage);
        execution.completedStages.add(stageId);
        // Checkpoint: dependent stage skipped
        await this.saveCheckpoint(execution, stage.name);
      }
    }
  }

  /**
   * 评估 Stage 条件表达式
   *
   * 使用 ExpressionEvaluator 进行安全的表达式求值，支持：
   * - 比较运算符: ==, !=, >, <, >=, <=
   * - 逻辑运算符: &&, ||, !
   * - 字符串函数: startsWith(), endsWith(), contains()
   * - 状态函数: success(), failure(), cancelled(), always()
   * - 上下文变量: branch, tags, changedFiles, triggerBy
   *
   * 示例:
   *   "branch == 'refs/heads/main' && success() && contains(changedFiles, 'Dockerfile')"
   */
  private evaluateCondition(condition: string, execution: PipelineExecution): boolean {
    try {
      // Build expression context from execution data
      const context: ExpressionContext = {
        branch: execution.run.context?.git?.ref ?? '',
        tags: (execution.run.context?.tags as string[]) ?? [],
        changedFiles: (execution.run.context?.changedFiles as string[]) ?? [],
        triggerBy: execution.run.triggerBy ?? '',
        // Map current pipeline status for status functions
        executionStatus: this.mapRunStatusToExpression(execution),
      };

      // Merge task outputs from VariableContext as flat variables for expression access
      const variableCtx = this.variableContexts.get(execution.run.id);
      if (variableCtx) {
        const varCtxObj = variableCtx.toExpressionContext();
        // Merge pipeline-level variables (skip 'tasks' as dot notation is blocked)
        for (const [key, value] of Object.entries(varCtxObj)) {
          if (key === 'tasks') continue;
          if (!(key in context)) {
            (context as Record<string, unknown>)[key] = value;
          }
        }
        // Merge task outputs as flat variables: <taskName><KeyName>
        const tasksObj = varCtxObj.tasks as Record<string, { outputs: Record<string, string> }> | undefined;
        if (tasksObj) {
          for (const [taskName, taskData] of Object.entries(tasksObj)) {
            if (taskData?.outputs) {
              for (const [key, value] of Object.entries(taskData.outputs)) {
                const flatKey = taskName + key.charAt(0).toUpperCase() + key.slice(1);
                (context as Record<string, unknown>)[flatKey] = value;
              }
            }
          }
        }
      }

      return this.expressionEvaluator.evaluate(condition, context);
    } catch (error) {
      // Log evaluation error but return false (condition not met) for safety
      logger.warn(
        { runId: execution.run.id, condition, error: error instanceof Error ? error.message : String(error) },
        'Condition evaluation failed, treating as false'
      );
      return false;
    }
  }

  /**
   * Map the current pipeline run status to the expression's executionStatus value
   * Used by success(), failure(), cancelled() status functions
   */
  private mapRunStatusToExpression(execution: PipelineExecution): string {
    // During execution, check if any completed stages have failed
    for (const stageId of execution.completedStages) {
      const stage = execution.stages.get(stageId);
      if (stage?.status === StageStatus.FAILED) {
        return 'failed';
      }
    }
    // If currently running and no failures detected, consider it as 'success' so far
    if (execution.run.status === PipelineRunStatus.RUNNING) {
      return 'success';
    }
    return execution.run.status;
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

    // SCM bidirectional: write cancellation back to PR/commit
    this.reportScmStatus(execution.run, 'cancelled').catch(err => {
      logger.warn({ runId: execution.run.id, error: err }, 'SCM status reporting failed (non-fatal)');
    });

    // Cleanup checkpoint on cancellation
    if (this.checkpointManager) {
      await this.checkpointManager.cleanupCompleted(runId);
    }

    // 清理执行上下文
    this.executions.delete(runId);
    // Clean up variable context
    this.variableContexts.delete(runId);

    return true;
  }

  // ==================== Deployment Strategy Methods (GAP-CN-03) ====================

  /**
   * Check if the stage has a deployment strategy and execute it.
   *
   * Returns:
   * - 'success' if deployment strategy executed successfully
   * - 'failed' if deployment strategy failed
   * - null if no deployment strategy is configured (proceed with normal execution)
   */
  private async checkAndExecuteDeploymentStrategy(
    execution: PipelineExecution,
    stage: Stage,
    tasks: Array<{ id: string; name: string; type: string; parameters: Record<string, unknown>; status?: string }>
  ): Promise<'success' | 'failed' | null> {
    // Check if stage has deploymentStrategy config
    const dsConfig = (stage.result as any)?.deploymentStrategy;
    if (!dsConfig) return null;

    if (!this.deploymentStrategyService) {
      logger.warn(
        { runId: execution.run.id, stageName: stage.name },
        'GAP-CN-03: Stage has deployment strategy config but DeploymentStrategyService is not available'
      );
      return null; // Proceed with normal task execution
    }

    const { strategyId, strategyName, healthCheckEndpoint, inline } = dsConfig;

    try {
      logger.info(
        { runId: execution.run.id, stageName: stage.name, strategyId, strategyName },
        'GAP-CN-03: Executing deployment strategy'
      );

      if (inline) {
        // Use inline strategy config
        return await this.executeInlineStrategy(execution, stage, inline, healthCheckEndpoint);
      }

      // Use referenced strategy
      const strategy = await this.deploymentStrategyService.getStrategy(strategyId || '');
      if (!strategy) {
        throw new Error(`Deployment strategy not found: ${strategyId || strategyName}`);
      }

      return await this.executeReferencedStrategy(execution, stage, strategy, healthCheckEndpoint);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        { runId: execution.run.id, stageName: stage.name, error: errorMessage },
        'GAP-CN-03: Deployment strategy execution failed'
      );

      // Mark stage as failed
      const failedStage = {
        ...execution.stages.get(stage.id)!,
        status: StageStatus.FAILED,
        completedAt: new Date(),
        durationMs: Date.now() - execution.stages.get(stage.id)!.startedAt!.getTime(),
        error: `Deployment strategy failed: ${errorMessage}`,
      };
      execution.stages.set(stage.id, failedStage);
      await this.runService.updateStage(failedStage);
      await this.eventPublisher.publishStageFailed(execution.run.id, failedStage, failedStage.error);
      this.sseBridge?.publishStageFailed(execution.run.pipelineId, execution.run.id, failedStage, failedStage.error);
      await this.saveCheckpoint(execution, stage.name);

      return 'failed';
    }
  }

  /**
   * Execute an inline deployment strategy (config embedded in stage YAML)
   */
  private async executeInlineStrategy(
    execution: PipelineExecution,
    stage: Stage,
    inline: { type: string; config: Record<string, unknown> },
    healthCheckEndpoint?: string
  ): Promise<'success' | 'failed'> {
    if (!this.deploymentStrategyService) return 'failed';

    switch (inline.type) {
      case 'canary': {
        const canaryConfig = inline.config as unknown as CanaryConfig;
        const status = await this.deploymentStrategyService.executeCanary({
          runId: execution.run.id,
          strategyId: 'inline',
          config: canaryConfig,
          healthCheckEndpoint,
        });
        return status.status === 'completed' || status.status === 'rolledback' ? 'success' : 'failed';
      }
      case 'bluegreen': {
        const bgConfig = inline.config as unknown as BlueGreenConfig;
        const status = await this.deploymentStrategyService.executeBlueGreen({
          runId: execution.run.id,
          strategyId: 'inline',
          config: bgConfig,
          healthCheckEndpoint,
        });
        return status.status === 'completed' ? 'success' : 'failed';
      }
      case 'rolling': {
        const rollingConfig = inline.config as unknown as RollingConfig;
        // Default to 6 instances if not specified
        const totalInstances = (inline.config as any).totalInstances || 6;
        const status = await this.deploymentStrategyService.executeRolling({
          runId: execution.run.id,
          strategyId: 'inline',
          config: rollingConfig,
          totalInstances,
          healthCheckEndpoint,
        });
        return status.status === 'completed' ? 'success' : 'failed';
      }
      default:
        throw new Error(`Unknown deployment strategy type: ${inline.type}`);
    }
  }

  /**
   * Execute a referenced deployment strategy (from DeploymentStrategyRepository)
   */
  private async executeReferencedStrategy(
    execution: PipelineExecution,
    stage: Stage,
    strategy: any,
    healthCheckEndpoint?: string
  ): Promise<'success' | 'failed'> {
    if (!this.deploymentStrategyService) return 'failed';

    switch (strategy.type) {
      case 'canary': {
        const status = await this.deploymentStrategyService.executeCanary({
          runId: execution.run.id,
          strategyId: strategy.id,
          config: strategy.config as unknown as CanaryConfig,
          healthCheckEndpoint,
        });
        return status.status === 'completed' ? 'success' : 'failed';
      }
      case 'bluegreen': {
        const status = await this.deploymentStrategyService.executeBlueGreen({
          runId: execution.run.id,
          strategyId: strategy.id,
          config: strategy.config as unknown as BlueGreenConfig,
          healthCheckEndpoint,
        });
        return status.status === 'completed' ? 'success' : 'failed';
      }
      case 'rolling': {
        const totalInstances = (stage.result as any)?.totalInstances || 6;
        const status = await this.deploymentStrategyService.executeRolling({
          runId: execution.run.id,
          strategyId: strategy.id,
          config: strategy.config as unknown as RollingConfig,
          totalInstances,
          healthCheckEndpoint,
        });
        return status.status === 'completed' ? 'success' : 'failed';
      }
      default:
        throw new Error(`Unknown deployment strategy type: ${strategy.type}`);
    }
  }

  // ==================== Quality Gate Methods (GAP-CN-04) ====================

  /**
   * 检查 Stage 的质量门禁
   *
   * 在 Stage 执行成功后调用，评估代码质量指标：
   * - 如果质量门禁配置存在且评估通过，返回 undefined（继续）
   * - 如果评估不通过且有阻断规则失败，返回失败原因
   * - 如果评估不通过但只有警告规则，返回 undefined（警告不阻断）
   *
   * @returns { reason?: string; result?: QualityGateResult } | undefined
   *   - reason: 阻断原因（当门禁被阻断时）
   *   - result: 评估结果详情
   */
  private async checkStageQualityGate(
    execution: PipelineExecution,
    stage: Stage
  ): Promise<{ reason: string; result: QualityGateResult } | undefined> {
    if (!this.qualityGateService) {
      return undefined;
    }

    // 从 stage 配置中获取质量门禁 ID
    // 支持两种配置方式：
    // 1. stage.result.qualityGateId - 直接使用门禁 ID
    // 2. stage.result.qualityGateName - 按名称查找门禁
    const qualityGateId = (stage.result as any)?.qualityGateId;
    const qualityGateName = (stage.result as any)?.qualityGateName;

    if (!qualityGateId && !qualityGateName) {
      return undefined; // 此 stage 不需要质量门禁
    }

    try {
      // 收集阶段指标（从任务输出、环境变量等获取）
      const metrics = this.collectStageQualityMetrics(execution, stage);

      // 如果指定了 gateId，直接使用
      if (qualityGateId) {
        const result = await this.qualityGateService.evaluateAndStore({
          gateId: qualityGateId,
          runId: execution.run.id,
          stageName: stage.name,
          metrics,
        });

        if (this.qualityGateService.isBlocking(result)) {
          const reason = this.qualityGateService.getBlockingReason(result);
          return { reason: reason || 'Quality gate check failed', result };
        }
      }

      // 如果指定了 gateName，按名称查找（需要 tenantId）
      if (qualityGateName) {
        const tenantId = (execution.run.context as any)?.tenantId;
        if (!tenantId) {
          logger.warn(
            { runId: execution.run.id, stageName: stage.name, gateName: qualityGateName },
            'Quality gate lookup requires tenantId, skipping'
          );
          return undefined;
        }

        const gate = await this.qualityGateService.findByName(tenantId, qualityGateName);
        if (!gate) {
          logger.warn(
            { runId: execution.run.id, stageName: stage.name, gateName: qualityGateName },
            'Quality gate not found by name, skipping'
          );
          return undefined;
        }

        const evaluation = this.qualityGateService.evaluate(gate, { metrics });
        const result: QualityGateResult = {
          ...evaluation,
          id: `qgr-${Date.now()}`,
          runId: execution.run.id,
          stageName: stage.name,
          evaluatedAt: new Date(),
        };

        if (this.qualityGateService.isBlocking(result)) {
          const reason = this.qualityGateService.getBlockingReason(result);
          return { reason: reason || 'Quality gate check failed', result };
        }
      }

      return undefined; // 通过或仅警告
    } catch (error) {
      logger.warn(
        { runId: execution.run.id, stageName: stage.name, error: error instanceof Error ? error.message : String(error) },
        'Quality gate evaluation failed (non-fatal, stage continues)'
      );
      return undefined; // 评估失败不阻断 stage 执行
    }
  }

  /**
   * 收集 Stage 的质量指标
   *
   * 从任务输出和 stage 配置中收集质量相关指标：
   * - coverage: 代码覆盖率（从测试任务输出获取）
   * - complexity: 圈复杂度（从代码分析任务获取）
   * - duplication: 代码重复率
   * - security_hotspots: 安全热点
   * - bugs: 潜在 Bug 数量
   * - vulnerabilities: 漏洞数量
   */
  private collectStageQualityMetrics(
    execution: PipelineExecution,
    stage: Stage
  ): Record<string, number> {
    const metrics: Record<string, number> = {};

    // 从 VariableContext 收集任务输出指标
    const variableCtx = this.variableContexts.get(execution.run.id);
    if (variableCtx) {
      const ctx = variableCtx.toExpressionContext();
      const tasksObj = ctx.tasks as Record<string, { outputs?: Record<string, string> }> | undefined;

      if (tasksObj) {
        for (const [taskName, taskData] of Object.entries(tasksObj)) {
          if (!taskData?.outputs) continue;
          for (const [key, value] of Object.entries(taskData.outputs)) {
            const numValue = parseFloat(value);
            if (!isNaN(numValue)) {
              // Map known metric keys
              const metricKeys = [
                'coverage', 'complexity', 'duplication',
                'security_hotspots', 'bugs', 'vulnerabilities',
              ];
              if (metricKeys.includes(key)) {
                metrics[key] = numValue;
              }
            }
          }
        }
      }
    }

    // 从 stage 配置中读取默认指标（如果有）
    const defaultMetrics = (stage.result as any)?.defaultMetrics;
    if (defaultMetrics && typeof defaultMetrics === 'object') {
      for (const [key, value] of Object.entries(defaultMetrics)) {
        if (typeof value === 'number') {
          metrics[key] = value;
        }
      }
    }

    return metrics;
  }

  // ==================== Approval Gate Methods ====================

  /**
   * 检查 Stage 的审批网关
   * @returns 'proceed' - 可以继续执行 | 'pending' - 等待审批 | 'rejected' - 审批被拒绝
   */
  private async checkApprovalGate(
    execution: PipelineExecution,
    stage: Stage
  ): Promise<'proceed' | 'pending' | 'rejected'> {
    if (!this.approvalGateService) {
      return 'proceed';
    }

    // 从 stage 配置中获取审批人（这里从 YAML 定义中解析）
    const approvers = this.extractApproversFromStage(stage);
    if (!approvers || approvers.length === 0) {
      return 'proceed';
    }

    // 检查是否已有审批记录
    const existingStatus = await this.approvalGateService.getStatus(execution.run.id, stage.id);
    if (existingStatus) {
      if (existingStatus.status === 'approved') {
        return 'proceed';
      } else if (existingStatus.status === 'pending') {
        return 'pending';
      } else if (existingStatus.status === 'rejected') {
        return 'rejected';
      }
    }

    // 需要审批但尚未请求，创建审批请求
    await this.approvalGateService.requestApproval({
      runId: execution.run.id,
      stageId: stage.id,
      stageName: stage.name,
      approvers,
      reason: `Approval required before executing stage '${stage.name}'`,
      tenantId: (execution.run.context as any)?.tenantId,
    });

    // 更新 stage 状态为 waiting_approval
    const waitingStage = {
      ...stage,
      status: StageStatus.PENDING, // 保持 pending 但不在待处理队列中
    };
    execution.stages.set(stage.id, waitingStage);

    logger.info(
      { runId: execution.run.id, stageName: stage.name, approvers },
      'Stage requires approval'
    );

    return 'pending';
  }

  /**
   * 从 Stage 配置中提取审批人列表
   */
  private extractApproversFromStage(stage: Stage): string[] | null {
    // 从 result 字段中读取 approvers（在 YAML 解析时注入）
    if (stage.result && (stage.result as any).approvers) {
      const approvers = (stage.result as any).approvers;
      if (Array.isArray(approvers)) return approvers;
    }
    return null;
  }

  /**
   * 审批通过一个 stage
   */
  async approveStage(
    runId: string,
    stageId: string,
    userId: string,
    comment?: string
  ): Promise<void> {
    if (!this.approvalGateService) {
      throw new Error('Approval gate service not configured');
    }

    // 更新审批状态
    await this.approvalGateService.approve(runId, stageId, userId, comment);

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
    if (!this.approvalGateService) {
      throw new Error('Approval gate service not configured');
    }

    await this.approvalGateService.reject(runId, stageId, userId, comment);

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
        await this.saveCheckpoint(execution, stage.name);

        // 标记依赖于此 stage 的其他 stages 为失败
        this.failDependentStages(execution, rejectedStage);
        await this.checkRunCompletion(execution);
      }
    }
  }

  /**
   * 审批通过后恢复 stage 执行
   */
  private async resumeAfterApproval(runId: string, stageId: string): Promise<void> {
    const execution = this.executions.get(runId);
    if (!execution) return;

    const stage = execution.stages.get(stageId);
    if (!stage) return;

    // 将 stage 重新加入待处理队列
    execution.pendingStages.add(stageId);

    // 触发执行
    await this.executePendingStages(execution);
  }

  /**
   * 获取审批状态
   */
  async getApprovalStatus(runId: string, stageId: string) {
    if (!this.approvalGateService) return null;
    return this.approvalGateService.getStatus(runId, stageId);
  }

  /**
   * 获取 run 的所有审批请求
   */
  async getApprovalRequestsByRun(runId: string) {
    if (!this.approvalGateService) return [];
    return this.approvalGateService.getByRun(runId);
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
   * Save a checkpoint for the current execution state.
   * Delegates to PipelineCheckpointManager if configured.
   */
  private async saveCheckpoint(
    execution: PipelineExecution,
    lastStageName?: string,
    lastTaskName?: string
  ): Promise<void> {
    if (!this.checkpointManager) return;

    try {
      await this.checkpointManager.saveCheckpoint(execution, lastStageName, lastTaskName);
    } catch (error) {
      // Log but don't fail the pipeline execution due to checkpoint issues
      logger.warn(
        { runId: execution.run.id, error: error instanceof Error ? error.message : String(error) },
        'Failed to save checkpoint (non-fatal)'
      );
    }
  }

  /**
   * Recover orphaned runs during startup using checkpoint data.
   *
   * Finds all checkpoints with 'running' status and attempts to:
   * 1. Restore the execution state if the run is still RUNNING in DB
   * 2. Mark as failed if the run is stale and cannot be restored
   * 3. Clean up if the run was completed elsewhere
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
   *
   * 在服务启动时调用，查找数据库中状态为 'RUNNING' 的 runs，
   * 将它们标记为失败（因为服务重启意味着执行中断）。
   *
   * 未来可扩展为真正重新执行未完成的部分。
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
          // 标记为失败（因为服务重启意味着执行中断）
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
   *
   * 注意：当前实现依赖数据库中有 pending 状态的 runs，
   * 实际上 pipeline 执行一旦开始就在内存中。
   * 此方法为未来持久化执行进度做准备。
   */
  async rebuildExecutionQueue(): Promise<number> {
    if (!this.executionQueue) return 0;

    // 当前没有独立的 "pending execution" 状态存储在 DB 中
    // 未来可以在 stage 级别持久化执行进度，然后从这里恢复
    logger.info('Execution queue rebuild: no persistent pending executions to restore');
    return 0;
  }

  /**
   * Get the DebugController instance (for HTTP routes to access).
   * Returns null if debugging is not enabled.
   */
  getDebugController(): DebugController | null {
    return this.debugController;
  }
}
