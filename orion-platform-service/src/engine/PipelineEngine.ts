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
 * 解耦改进：Engine → Services 直接 import 从 20 个减少到 4 个核心服务。
 * 所有可选服务通过 PipelineServiceRegistry 获取，不再直接 import。
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
import { PipelineEventPublisher } from '../events/PipelineEventPublisher';
import { StageExecutor } from './StageExecutor';
import { MatrixExpander } from './MatrixExpander';
import { DebugController } from './DebugController';
import { YamlPreprocessor } from './YamlPreprocessor';
import { ExpressionEvaluator } from './ExpressionEvaluator';
import { StageInitializer } from './StageInitializer';
import { StageOrchestrator } from './StageOrchestrator';
import { GrayScaleController } from './GrayScaleController';
import { MultiTargetExecutor } from './MultiTargetExecutor';
import { NotificationDispatcher } from './NotificationDispatcher';
import { ScmStatusReporter } from './ScmStatusReporter';
import { PipelineGateController } from './PipelineGateController';
import { PipelineCrashRecovery, RecoveryResult } from './PipelineCrashRecovery';
import { PipelineLifecycleHandler } from './PipelineLifecycleHandler';
import { PipelineServiceRegistry } from './PipelineServiceRegistry';
import type { PipelineEventSSEBridge } from '../services/pipeline/PipelineEventSSEBridge';
import type { PipelineExecutionQueue, QueuePriority } from '../services/pipeline/PipelineExecutionQueue';
import type { PipelineCheckpointManager } from './PipelineCheckpointManager';
import type { SecretsService } from '../services/pipeline/SecretsService';
import type { GlobalParamService } from '../services/pipeline/GlobalParamService';
import type { EnvProfileService } from '../services/pipeline/EnvProfileService';
import type { ScriptVersionService } from '../services/pipeline/ScriptVersionService';
import type { PipelineAuditLogService } from '../services/pipeline/PipelineAuditLogService';
import { createLogger } from '../utils/logger';

const logger = createLogger('PipelineEngine');

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
  private grayscaleController: GrayScaleController;
  private multiTargetExecutor: MultiTargetExecutor;
  private lifecycleHandler: PipelineLifecycleHandler;
  private crashRecovery: PipelineCrashRecovery = null!;
  private notificationDispatcher: NotificationDispatcher;
  private scmStatusReporter: ScmStatusReporter;
  private gateController: PipelineGateController;

  // Core dependencies (4 required - no change)
  private pipelineService: PipelineService;
  private runService: PipelineRunService;
  private eventPublisher: PipelineEventPublisher;
  private stageExecutor: StageExecutor;

  // Service registry (all optional services accessed through here)
  private serviceRegistry: PipelineServiceRegistry;

  // Cached references from registry
  private sseBridge: PipelineEventSSEBridge | null;
  private executionQueue: PipelineExecutionQueue | null;
  private checkpointManager: PipelineCheckpointManager | null;
  private debugController: DebugController | null;
  private yamlPreprocessor: YamlPreprocessor | null;

  private executions = new Map<string, PipelineExecution>();

  constructor(
    pipelineService: PipelineService,
    runService: PipelineRunService,
    eventPublisher: PipelineEventPublisher,
    stageExecutor: StageExecutor,
    serviceRegistry: PipelineServiceRegistry,
    checkpointManager?: PipelineCheckpointManager,
    yamlPreprocessor?: YamlPreprocessor | null,
    debugController?: DebugController | null
  ) {
    this.pipelineService = pipelineService;
    this.runService = runService;
    this.eventPublisher = eventPublisher;
    this.stageExecutor = stageExecutor;
    this.serviceRegistry = serviceRegistry;
    this.checkpointManager = checkpointManager || null;
    this.debugController = debugController || null;
    this.yamlPreprocessor = yamlPreprocessor || null;

    // Cached references from registry
    this.sseBridge = this.serviceRegistry.getSseBridge();
    this.executionQueue = this.serviceRegistry.getExecutionQueue();

    this.stageInitializer = new StageInitializer();

    this.grayscaleController = new GrayScaleController();
    this.multiTargetExecutor = new MultiTargetExecutor(
      this.grayscaleController,
      stageExecutor
    );

    this.stageOrchestrator = new StageOrchestrator({
      pipelineService, runService, eventPublisher,
      sseBridge: this.sseBridge, stageExecutor,
      subPipelineService: this.serviceRegistry.getSubPipelineService(),
      artifactService: this.serviceRegistry.getArtifactService(),
      autoRetryService: this.serviceRegistry.getAutoRetryService(),
      expressionEvaluator: new ExpressionEvaluator(),
      checkpointManager: this.checkpointManager,
      debugController: this.debugController,
      secretsService: this.serviceRegistry.getSecretsService(),
      globalParamService: this.serviceRegistry.getGlobalParamService(),
      envProfileService: this.serviceRegistry.getEnvProfileService(),
      scriptVersionService: this.serviceRegistry.getScriptVersionService(),
      pipelineAuditLogService: this.serviceRegistry.getPipelineAuditLogService(),
      grayscaleController: this.grayscaleController,
      multiTargetExecutor: this.multiTargetExecutor,
    });

    this.notificationDispatcher = new NotificationDispatcher({
      pipelineService, runService,
      imNotifier: this.serviceRegistry.getImNotifier(),
      imNotificationConfigs: this.serviceRegistry.getImNotificationConfigs(),
      webhookNotifier: this.serviceRegistry.getWebhookNotifier(),
      webhookConfigRepo: this.serviceRegistry.getWebhookConfigRepo(),
    });

    this.scmStatusReporter = new ScmStatusReporter({
      pipelineService, runService,
      scmStatusService: this.serviceRegistry.getScmStatusService(),
    });

    this.gateController = new PipelineGateController({
      runService, eventPublisher,
      sseBridge: this.sseBridge,
      approvalGateService: this.serviceRegistry.getApprovalGateService(),
      qualityGateService: this.serviceRegistry.getQualityGateService(),
      deploymentStrategyService: this.serviceRegistry.getDeploymentStrategyService(),
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
      onRunComplete: null,
    });
  }

  initializeSecrets(database: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }, masterKey?: string): void {
    this.serviceRegistry.initializeSecrets(database, masterKey);
  }

  getSecretsService(): SecretsService | null {
    return this.serviceRegistry.getSecretsService();
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

  getGlobalParamService(): GlobalParamService | null {
    return this.serviceRegistry.getGlobalParamService();
  }

  getEnvProfileService(): EnvProfileService | null {
    return this.serviceRegistry.getEnvProfileService();
  }

  getScriptVersionService(): ScriptVersionService | null {
    return this.serviceRegistry.getScriptVersionService();
  }

  getPipelineAuditLogService(): PipelineAuditLogService | null {
    return this.serviceRegistry.getPipelineAuditLogService();
  }
}
