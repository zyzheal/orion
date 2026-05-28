/**
 * Pipeline Engine - Pipeline 执行编排引擎 (Facade)
 *
 * 作为 Facade 委托给提取的类：
 * - StageInitializer: Stage/Task 工厂
 * - StageOrchestrator: Stage 执行编排
 * - NotificationDispatcher: IM/Webhook 通知
 * - ScmStatusReporter: SCM 状态回写
 * - PipelineGateController: 质量门禁/审批网关/部署策略
 * - PipelineCrashRecovery: 崩溃恢复
 * - PipelineLifecycleHandler: 生命周期（完成/取消/审批）
 *
 * 负责：
 * - 解析 Pipeline YAML 定义
 * - 创建 PipelineRun 实例
 * - 协调 Stage 执行顺序
 * - 发布执行事件
 */

import { parsePipelineYaml, PipelineStage as PipelineYamlStage } from '../models/Pipeline';
import { OrionError, ErrorCode } from '../errors';
import { PipelineRun, PipelineRunStatus, TriggerType } from '../models/PipelineRun';
import { Stage } from '../models/Stage';
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
import { ExpressionEvaluator } from './ExpressionEvaluator';
import { StageInitializer } from './StageInitializer';
import { StageOrchestrator } from './StageOrchestrator';
import { NotificationDispatcher } from './NotificationDispatcher';
import { ScmStatusReporter } from './ScmStatusReporter';
import { PipelineGateController } from './PipelineGateController';
import { PipelineCrashRecovery, RecoveryResult } from './PipelineCrashRecovery';
import { PipelineLifecycleHandler } from './PipelineLifecycleHandler';

import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export type RunCompletionCallback = (run: PipelineRun) => void;

export interface PipelineExecution {
  run: PipelineRun;
  stages: Map<string, Stage>;
  pendingStages: Set<string>;
  runningStages: Set<string>;
  completedStages: Set<string>;
}

export class PipelineEngine {
  // Extracted collaborators
  private stageInitializer: StageInitializer;
  private stageOrchestrator: StageOrchestrator;
  private lifecycleHandler: PipelineLifecycleHandler;
  private crashRecovery: PipelineCrashRecovery;
  private notificationDispatcher: NotificationDispatcher;
  private scmStatusReporter: ScmStatusReporter;
  private gateController: PipelineGateController;

  // Core dependencies
  private pipelineService: PipelineService;
  private runService: PipelineRunService;
  private eventPublisher: PipelineEventPublisher;
  private sseBridge: PipelineEventSSEBridge | null;
  private executionQueue: PipelineExecutionQueue | null;
  private checkpointManager: PipelineCheckpointManager | null;
  private debugController: DebugController | null;
  private yamlPreprocessor: YamlPreprocessor | null;
  private secretsService: SecretsService | null;
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
    this.checkpointManager = checkpointManager || null;
    this.debugController = debugController || null;
    this.yamlPreprocessor = yamlPreprocessor || null;
    this.secretsService = secretsService || null;

    this.stageInitializer = new StageInitializer();

    this.stageOrchestrator = new StageOrchestrator({
      pipelineService, runService, eventPublisher,
      sseBridge: this.sseBridge, stageExecutor,
      subPipelineService: subPipelineService || null,
      artifactService: artifactService || null,
      autoRetryService: autoRetryService || null,
      expressionEvaluator: new ExpressionEvaluator(),
      checkpointManager: this.checkpointManager,
      debugController: this.debugController,
      secretsService: this.secretsService,
    });

    this.notificationDispatcher = new NotificationDispatcher({
      pipelineService, runService,
      imNotifier: imNotifier || null,
      imNotificationConfigs: imNotificationConfigs || [],
      webhookNotifier: webhookNotifier || null,
      webhookConfigRepo: webhookConfigRepo || null,
    });

    this.scmStatusReporter = new ScmStatusReporter({
      pipelineService, runService,
      scmStatusService: scmStatusService || null,
    });

    this.gateController = new PipelineGateController({
      runService, eventPublisher,
      sseBridge: this.sseBridge,
      approvalGateService: approvalGateService || null,
      qualityGateService: qualityGateService || null,
      deploymentStrategyService: deploymentStrategyService || null,
    });

    this.lifecycleHandler = new PipelineLifecycleHandler({
      runService, eventPublisher,
      sseBridge: this.sseBridge,
      checkpointManager: this.checkpointManager,
      debugController: this.debugController,
      stageOrchestrator: this.stageOrchestrator,
      notificationDispatcher: this.notificationDispatcher,
      scmStatusReporter: this.scmStatusReporter,
      gateController: this.gateController,
      executions: this.executions,
      onRunComplete: onRunComplete || null,
    });

    this.crashRecovery = new PipelineCrashRecovery({
      runService, eventPublisher,
      sseBridge: this.sseBridge,
      checkpointManager: this.checkpointManager,
      executionQueue: this.executionQueue,
      executions: this.executions,
    });
  }

  initializeSecrets(database: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }, masterKey?: string): void {
    if (!database) return;
    const repo = new SecretRepository(database);
    const config: SecretsServiceConfig | undefined = masterKey ? { encryptionKey: masterKey } : undefined;
    this.secretsService = new SecretsService(repo, config);
  }

  getSecretsService(): SecretsService | null {
    return this.secretsService;
  }

  async execute(
    pipelineId: string,
    triggerType: TriggerType,
    triggerBy?: string,
    context?: Record<string, unknown>
  ): Promise<PipelineRun | null> {
    const pipeline = await this.pipelineService.getById(pipelineId);
    if (!pipeline) {
      throw new OrionError(`Pipeline '${pipelineId}' not found`, ErrorCode.NOT_FOUND);
    }

    // Parse YAML
    let spec: { stages: PipelineYamlStage[] };
    try {
      if (!pipeline.yamlDefinition) {
        throw new OrionError('Pipeline has no YAML definition', ErrorCode.VALIDATION_ERROR);
      }
      let yamlDefinition = pipeline.yamlDefinition;
      if (this.yamlPreprocessor) {
        try {
          yamlDefinition = await this.yamlPreprocessor.preprocess(yamlDefinition);
          logger.info({ pipelineId }, 'YAML preprocessed');
        } catch (error) {
          logger.warn({ error }, 'YAML preprocessing failed, using original YAML');
        }
      }
      spec = parsePipelineYaml(yamlDefinition).spec;
    } catch (error) {
      throw new OrionError(`Failed to parse pipeline YAML: ${error instanceof Error ? error.message : 'Unknown error'}`, ErrorCode.VALIDATION_ERROR);
    }

    // Expand matrix stages
    const expandedStages = MatrixExpander.expandAll(spec.stages);
    const hasMatrixExpansion = expandedStages.some(e => e.originalName !== e.name);
    if (hasMatrixExpansion) {
      logger.info(
        { originalCount: spec.stages.length, expandedCount: expandedStages.length },
        'Matrix expansion: stages expanded'
      );
    }

    // Create PipelineRun
    const run = await this.runService.createRun({
      pipelineId,
      pipelineVersion: String(pipeline.version || 1),
      triggerType, triggerBy, context,
    });

    // Initialize Stages and Tasks
    const stages = this.stageInitializer.initializeStagesFromExpanded(run.id, expandedStages);
    for (const stage of stages) {
      await this.runService.addStage(run.id, stage);
    }
    for (const expanded of expandedStages) {
      const stage = stages.find(s => s.name === expanded.name)!;
      const tasks = this.stageInitializer.initializeTasks(stage.id, expanded.stage.steps, expanded.stage.runsOn);
      for (const task of tasks) {
        await this.runService.addTask(stage.id, task);
      }
    }

    // Create execution context
    const execution: PipelineExecution = {
      run,
      stages: new Map(stages.map(s => [s.id, s])),
      pendingStages: new Set(stages.filter(s => s.dependsOn.length === 0).map(s => s.id)),
      runningStages: new Set(),
      completedStages: new Set(),
    };
    this.executions.set(run.id, execution);

    this.stageOrchestrator.createVariableContext(run.id, context);
    if (this.debugController) {
      this.debugController.registerRun(run.id, { status: 'running' });
    }
    this.stageOrchestrator.applyRetrySkipMetadata(execution);

    // Start execution
    await this.runService.startRun(run.id);
    this.sseBridge?.publishRunStarted(pipelineId, run);
    this.scmStatusReporter.reportScmStatus(run, 'pending', this.executions).catch(err => {
      logger.warn({ runId: run.id, error: err }, 'SCM status reporting failed (non-fatal)');
    });

    if (this.executionQueue) {
      const priority = this.determinePriority(triggerType, context);
      logger.info({ runId: run.id, priority }, 'Enqueueing pipeline run');
      this.executionQueue.enqueue({
        runId: run.id, pipelineId, priority,
        executeFn: async () => {
          logger.info({ runId: run.id }, 'Executing dequeued pipeline run');
          this.executePendingStages(execution);
        },
        resolve: () => {},
        reject: () => {},
      }).catch(err => {
        logger.error({ runId: run.id, error: err }, 'Failed to enqueue pipeline run');
      });
    } else {
      this.executePendingStages(execution);
    }

    return run;
  }

  private determinePriority(triggerType: TriggerType, context?: Record<string, unknown>): QueuePriority {
    if (triggerType === TriggerType.EVENT) return 'HIGH';
    if (triggerType === TriggerType.MANUAL && (context as any)?.priority === 'high') return 'HIGH';
    if (triggerType === TriggerType.API) return 'NORMAL';
    if (triggerType === TriggerType.SCHEDULE) return 'LOW';
    return 'NORMAL';
  }

  private executePendingStages(execution: PipelineExecution): void {
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
        this.lifecycleHandler.checkRunCompletion(exec),
    };

    this.stageOrchestrator.executePendingStages(execution, callbacks).catch(err => {
      logger.error({ runId: execution.run.id, error: err }, 'executePendingStages failed');
    });
  }

  getExecution(runId: string): PipelineExecution | undefined {
    return this.executions.get(runId);
  }

  // ==================== Delegated Methods ====================

  async cancelExecution(runId: string): Promise<boolean> {
    return this.lifecycleHandler.cancelExecution(runId);
  }

  async approveStage(runId: string, stageId: string, userId: string, comment?: string): Promise<void> {
    await this.lifecycleHandler.approveStage(runId, stageId, userId, comment);
    const execution = this.executions.get(runId);
    if (execution) {
      execution.pendingStages.add(stageId);
      this.executePendingStages(execution);
    }
  }

  async rejectStage(runId: string, stageId: string, userId: string, comment?: string): Promise<void> {
    return this.lifecycleHandler.rejectStage(runId, stageId, userId, comment);
  }

  async getApprovalStatus(runId: string, stageId: string) {
    return this.lifecycleHandler.getApprovalStatus(runId, stageId);
  }

  async getApprovalRequestsByRun(runId: string) {
    return this.lifecycleHandler.getApprovalRequestsByRun(runId);
  }

  // ==================== Execution Queue ====================

  getExecutionQueue(): PipelineExecutionQueue | null {
    return this.executionQueue;
  }

  getQueueStats() {
    return this.executionQueue?.getStats() || null;
  }

  getQueuedRuns() {
    return this.executionQueue?.getQueuedRuns() || [];
  }

  cancelQueuedRun(runId: string): boolean {
    if (!this.executionQueue) return false;
    return this.executionQueue.remove(runId);
  }

  // ==================== Crash Recovery ====================

  async recoverOrphanedRuns(options?: {
    onRestored?: (execution: PipelineExecution) => void;
    markFailedIfStale?: boolean;
  }): Promise<RecoveryResult> {
    return this.crashRecovery.recoverOrphanedRuns(options);
  }

  async recoverRuns(): Promise<RecoveryResult> {
    return this.crashRecovery.recoverRuns();
  }

  async rebuildExecutionQueue(): Promise<number> {
    return this.crashRecovery.rebuildExecutionQueue();
  }

  getDebugController(): DebugController | null {
    return this.debugController;
  }
}
