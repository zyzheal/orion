/**
 * StageOrchestrator - Stage 编排器
 *
 * 负责：
 * - Stage 并行/串行执行
 * - Task 逐个执行（含 secrets 解析、debug 暂停）
 * - 依赖检查与 fan-in 模式
 * - Stage 重试（手动 + AutoRetry 带退避）
 * - Sub-pipeline stage 执行
 * - 条件表达式评估
 * - Artifact 传递
 * - Stage 输出注册
 * - 失败依赖传播
 */

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
import { AutoRetryService } from '../services/pipeline/AutoRetryService';
import { ExpressionEvaluator, ExpressionContext } from './ExpressionEvaluator';
import { StageParameterResolver } from './StageParameterResolver';
import { ConditionRouter } from './ConditionRouter';
import { PipelineCheckpointManager } from './PipelineCheckpointManager';
import { DebugController } from './DebugController';
import { SecretsService } from '../services/pipeline/SecretsService';
import { GlobalParamService } from '../services/pipeline/GlobalParamService';
import { EnvProfileService } from '../services/pipeline/EnvProfileService';
import { ScriptVersionService } from '../services/pipeline/ScriptVersionService';
import { PipelineAuditLogService } from '../services/pipeline/PipelineAuditLogService';
import { PipelineExecution } from './PipelineEngine';
import { VariableContext } from './VariableContext';
import { GrayScaleController } from './GrayScaleController';
import { MultiTargetExecutor, MultiTargetResult } from './MultiTargetExecutor';
import { createLogger } from '../utils/logger';
import { getCurrentTenantId } from '../db/tenant-context-storage';

const logger = createLogger('StageOrchestrator');

export interface StageOrchestratorDeps {
  pipelineService: PipelineService;
  runService: PipelineRunService;
  eventPublisher: PipelineEventPublisher;
  sseBridge: PipelineEventSSEBridge | null;
  stageExecutor: StageExecutor;
  subPipelineService: SubPipelineService | null;
  artifactService: ArtifactService | null;
  autoRetryService: AutoRetryService | null;
  expressionEvaluator: ExpressionEvaluator;
  checkpointManager: PipelineCheckpointManager | null;
  debugController: DebugController | null;
  secretsService: SecretsService | null;
  globalParamService: GlobalParamService | null;
  envProfileService: EnvProfileService | null;
  scriptVersionService: ScriptVersionService | null;
  pipelineAuditLogService: PipelineAuditLogService | null;
  grayscaleController: GrayScaleController;
  multiTargetExecutor: MultiTargetExecutor;
}

export class StageOrchestrator {
  private pipelineService: PipelineService;
  private runService: PipelineRunService;
  private eventPublisher: PipelineEventPublisher;
  private sseBridge: PipelineEventSSEBridge | null;
  private stageExecutor: StageExecutor;
  private subPipelineService: SubPipelineService | null;
  private artifactService: ArtifactService | null;
  private autoRetryService: AutoRetryService | null;
  private expressionEvaluator: ExpressionEvaluator;
  private checkpointManager: PipelineCheckpointManager | null;
  private debugController: DebugController | null;
  private secretsService: SecretsService | null;
  private globalParamService: GlobalParamService | null;
  private envProfileService: EnvProfileService | null;
  private scriptVersionService: ScriptVersionService | null;
  private pipelineAuditLogService: PipelineAuditLogService | null;
  private grayscaleController: GrayScaleController;
  private multiTargetExecutor: MultiTargetExecutor;

  // Per-run variable contexts for task output propagation
  private variableContexts = new Map<string, VariableContext>();
  // Per-run parameter resolvers (needs per-run VariableContext)
  private parameterResolvers = new Map<string, StageParameterResolver>();
  // Per-run condition routers (needs per-run VariableContext)
  private conditionRouters = new Map<string, ConditionRouter>();

  // 防止 checkNextStages 并发调用导致重复执行
  private nextStageCheckLocks = new Map<string, Promise<void>>();

  constructor(deps: StageOrchestratorDeps) {
    this.pipelineService = deps.pipelineService;
    this.runService = deps.runService;
    this.eventPublisher = deps.eventPublisher;
    this.sseBridge = deps.sseBridge;
    this.stageExecutor = deps.stageExecutor;
    this.subPipelineService = deps.subPipelineService;
    this.artifactService = deps.artifactService;
    this.autoRetryService = deps.autoRetryService;
    this.expressionEvaluator = deps.expressionEvaluator;
    this.checkpointManager = deps.checkpointManager;
    this.debugController = deps.debugController;
    this.secretsService = deps.secretsService;
    this.globalParamService = deps.globalParamService;
    this.envProfileService = deps.envProfileService;
    this.scriptVersionService = deps.scriptVersionService;
    this.pipelineAuditLogService = deps.pipelineAuditLogService;
    this.grayscaleController = deps.grayscaleController;
    this.multiTargetExecutor = deps.multiTargetExecutor;
  }

  getVariableContexts(): Map<string, VariableContext> {
    return this.variableContexts;
  }

  /**
   * 创建并注册 VariableContext
   */
  createVariableContext(runId: string, context?: Record<string, unknown>): VariableContext {
    const variableCtx = new VariableContext(runId);
    if (context) {
      for (const [key, value] of Object.entries(context)) {
        if (typeof value === 'string') {
          variableCtx.setVariable(key, value);
        }
      }
    }
    this.variableContexts.set(runId, variableCtx);
    // Create per-run parameter resolver and condition router
    this.parameterResolvers.set(runId, new StageParameterResolver(variableCtx));
    this.conditionRouters.set(runId, new ConditionRouter(variableCtx));
    this.stageExecutor.setVariableContext(variableCtx);
    return variableCtx;
  }

  /**
   * 清理 VariableContext
   */
  cleanupVariableContext(runId: string): void {
    this.variableContexts.delete(runId);
    this.parameterResolvers.delete(runId);
    this.conditionRouters.delete(runId);
  }

  /**
   * GAP-06: Apply retry skip metadata to pre-mark stages as SUCCESS.
   */
  applyRetrySkipMetadata(execution: PipelineExecution): void {
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
   * Serialize the orchestrator runtime state for a given run.
   * Used for crash recovery persistence.
   */
  serializeState(runId: string): Record<string, unknown> {
    const variableCtx = this.variableContexts.get(runId);
    return {
      variableContexts: {
        [runId]: variableCtx
          ? {
              taskOutputs: { ...(variableCtx as any).taskOutputs },
              variables: { ...(variableCtx as any).variables },
            }
          : { taskOutputs: {}, variables: {} },
      },
    };
  }

  /**
   * Restore the orchestrator runtime state from a previously serialized snapshot.
   */
  restoreState(runId: string, state: Record<string, unknown>): void {
    const orchestratorState = state as {
      variableContexts: Record<
        string,
        {
          taskOutputs: Record<string, Record<string, string>>;
          variables: Record<string, string>;
        }
      >;
    };

    const ctxData = orchestratorState.variableContexts?.[runId];
    if (!ctxData) return;

    const variableCtx = new VariableContext(runId);
    // Restore task outputs
    for (const [taskName, outputs] of Object.entries(ctxData.taskOutputs)) {
      for (const [key, value] of Object.entries(outputs)) {
        variableCtx.setTaskOutput(taskName, key, value);
      }
    }
    // Restore pipeline variables via internal map
    (variableCtx as any).variables = { ...ctxData.variables };

    this.variableContexts.set(runId, variableCtx);
    this.parameterResolvers.set(runId, new StageParameterResolver(variableCtx));
    this.conditionRouters.set(runId, new ConditionRouter(variableCtx));
  }

  /**
   * 执行待处理的 Stages
   * 改进：支持并行执行 — 检测无依赖关系的 stages，使用 Promise.allSettled 并发执行
   * Phase 2: 新增审批网关检查
   */
  async executePendingStages(
    execution: PipelineExecution,
    callbacks: {
      evaluateCondition: (condition: string, execution: PipelineExecution) => boolean;
      checkApprovalGate: (execution: PipelineExecution, stage: Stage) => Promise<'proceed' | 'pending' | 'rejected'>;
      checkAndExecuteDeploymentStrategy: (execution: PipelineExecution, stage: Stage, tasks: Array<{ id: string; name: string; type: string; parameters: Record<string, unknown>; status?: string }>) => Promise<'success' | 'failed' | null>;
      checkStageQualityGate: (execution: PipelineExecution, stage: Stage) => Promise<{ reason: string } | undefined>;
      checkRunCompletion: (execution: PipelineExecution) => void;
    }
  ): Promise<void> {
    const stagesToExecute = Array.from(execution.pendingStages);

    // 过滤出条件满足的 stages（跳过不满足条件的）
    const eligibleStageIds: string[] = [];
    for (const stageId of stagesToExecute) {
      const stage = execution.stages.get(stageId);
      if (!stage) continue;

      if (stage.condition && !callbacks.evaluateCondition(stage.condition, execution)) {
        const skippedStage = { ...stage, status: StageStatus.SKIPPED, completedAt: new Date() };
        execution.stages.set(stageId, skippedStage);
        await this.runService.updateStage(skippedStage);
        await this.eventPublisher.publishStageSkipped(execution.run.id, skippedStage);
        this.sseBridge?.publishStageSkipped(execution.run.pipelineId, execution.run.id, skippedStage);

        execution.pendingStages.delete(stageId);
        execution.completedStages.add(stageId);
        // Checkpoint: stage skipped due to condition
        await this.saveCheckpoint(execution, stage.name);
        // Audit: record stage skip event (condition not met)
        this.recordStageAudit(execution, skippedStage, 'skip', 'failure', undefined, 'Condition not met').catch(() => {});
        continue;
      }

      // Phase 2: 检查审批网关
      const approvalCheck = await callbacks.checkApprovalGate(execution, stage);
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
        // Audit: record stage skip event (approval rejected)
        this.recordStageAudit(execution, skippedStage, 'skip', 'failure', undefined, 'Approval rejected').catch(() => {});
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

    // Separate multi-target stages from single-target stages
    const multiTargetStageIds: string[] = [];
    const singleTargetStageIds: string[] = [];

    for (const stageId of eligibleStageIds) {
      const stage = execution.stages.get(stageId);
      if (stage && stage.targets && stage.targets.length > 0) {
        multiTargetStageIds.push(stageId);
      } else {
        singleTargetStageIds.push(stageId);
      }
    }

    if (multiTargetStageIds.length > 0) {
      logger.info(
        { runId: execution.run.id, multiTargetCount: multiTargetStageIds.length },
        'Executing multi-target stages sequentially'
      );
    }

    // Execute multi-target stages sequentially (each one handles its own parallelism)
    for (const stageId of multiTargetStageIds) {
      const stage = execution.stages.get(stageId);
      if (!stage) continue;
      try {
        const result: MultiTargetResult = await this.multiTargetExecutor.execute(
          execution.run,
          execution,
          {
            ...stage,
            targets: stage.targets,
            executionMode: stage.executionMode,
            batchSize: stage.batchSize,
          } as any
        );

        if (result.overallSuccess) {
          const completedStage = {
            ...stage,
            status: StageStatus.SUCCESS,
            completedAt: new Date(),
            durationMs: result.batchResults.reduce((sum, b) => sum + b.targetResults.reduce((s, t) => s + t.durationMs, 0), 0),
            result: { multiTarget: result } as Record<string, unknown>,
          };
          execution.stages.set(stageId, completedStage);
          await this.runService.updateStage(completedStage);
          await this.eventPublisher.publishStageCompleted(execution.run.id, completedStage);
          this.sseBridge?.publishStageCompleted(execution.run.pipelineId, execution.run.id, completedStage);
          execution.pendingStages.delete(stageId);
          execution.completedStages.add(stageId);
        } else {
          const failedStage = {
            ...stage,
            status: StageStatus.FAILED,
            completedAt: new Date(),
            error: `Multi-target execution failed: ${result.batchResults.filter(b => !b.batchSuccess).length}/${result.totalBatches} batches failed`,
            durationMs: result.batchResults.reduce((sum, b) => sum + b.targetResults.reduce((s, t) => s + t.durationMs, 0), 0),
            result: { multiTarget: result } as Record<string, unknown>,
          };
          execution.stages.set(stageId, failedStage);
          await this.runService.updateStage(failedStage);
          await this.eventPublisher.publishStageFailed(execution.run.id, failedStage);
          this.sseBridge?.publishStageFailed(execution.run.pipelineId, execution.run.id, failedStage);
          execution.pendingStages.delete(stageId);
          execution.run.status = PipelineRunStatus.FAILED;
          execution.run.updatedAt = new Date();
          await this.runService.completeRun(execution.run.id, PipelineRunStatus.FAILED);
          return; // Stop execution on failure
        }
      } catch (error) {
        logger.error({ stageName: stage.name, error }, 'Multi-target stage execution threw');
        const failedStage = {
          ...stage,
          status: StageStatus.FAILED,
          completedAt: new Date(),
          error: error instanceof Error ? error.message : 'Unknown error',
        };
        execution.stages.set(stageId, failedStage);
        await this.runService.updateStage(failedStage);
        execution.pendingStages.delete(stageId);
        execution.run.status = PipelineRunStatus.FAILED;
        execution.run.updatedAt = new Date();
        await this.runService.completeRun(execution.run.id, PipelineRunStatus.FAILED);
        return;
      }
    }

    // Execute single-target stages in parallel (original behavior, unchanged)
    if (singleTargetStageIds.length > 0) {
      const executionPromises = singleTargetStageIds.map(async (stageId) => {
        const stage = execution.stages.get(stageId);
        if (!stage) return;
        try {
          await this.executeStage(execution, stage, callbacks);
        } catch (error) {
          logger.error({ stageName: stage.name, error }, 'Failed to execute stage');
        }
      });

      await Promise.allSettled(executionPromises);
    }
  }

  /**
   * 执行单个 Stage
   */
  async executeStage(
    execution: PipelineExecution,
    stage: Stage,
    callbacks: any
  ): Promise<void> {
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
    // Audit: record stage start event
    this.recordStageAudit(execution, runningStage, 'start', 'success').catch(() => {});

    try {
      // 获取 Stage 的 Tasks
      const tasks = await this.runService.getTasks(stage.id);

      // Resolve variable references in task parameters before execution
      const variableCtx = this.variableContexts.get(execution.run.id);
      const resolver = this.parameterResolvers.get(execution.run.id);
      const resolvedTasks = variableCtx
        ? tasks.map(t => {
            const resolvedParams = variableCtx.resolveObject(
              t.parameters as Record<string, unknown>
            );
            let finalParams = resolvedParams as Record<string, string>;
            // Also resolve ${tasks.<name>.outputs.<key>} references via StageParameterResolver
            if (resolver) {
              finalParams = resolver.resolveStageParameters(stage.name, finalParams);
            }
            return { ...t, parameters: finalParams };
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
          ...t as unknown as Record<string, unknown>,
        }));
        await this.executeSubPipelineStage(execution, stage, taskObjects, callbacks.checkRunCompletion);
        return;
      }

      // GAP-CN-03: Check if this stage has a deployment strategy configured
      const deploymentResult = await callbacks.checkAndExecuteDeploymentStrategy(execution, stage, resolvedTasks);
      if (deploymentResult !== null) {
        // deployment strategy handled stage completion/failure
        execution.runningStages.delete(stage.id);
        execution.completedStages.add(stage.id);
        this.checkNextStages(execution, callbacks);
        return;
      }

      // 按顺序执行 Tasks
      for (const task of resolvedTasks) {
        if (task.status !== 'pending') continue;

        // Resolve ${secrets.XXX} references in task parameters before execution
        let resolvedTask = task;
        const secretsSvc = this.secretsService;
        if (secretsSvc) {
          const tenantId = (execution.run.context as any)?.tenantId || getCurrentTenantId();
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
                throw new OrionError(`Unresolved secret references: ${secretResult.unresolved.join(', ')}`, ErrorCode.VALIDATION_ERROR);
              }
              // Update task parameters with resolved values (merge env into parameters)
              resolvedTask = { ...task, parameters: { ...task.parameters, ...secretResult.env } };
            } catch (error) {
              // Re-throw to fail the task if secrets can't be resolved
              throw error;
            }
          }
        }

        // Resolve GlobalParam and EnvProfile variables for this task
        try {
          const serviceParams = await this.resolveServiceParameters(execution, resolvedTask);
          if (serviceParams.params && Object.keys(serviceParams.params).length > 0) {
            resolvedTask = { ...resolvedTask, parameters: { ...resolvedTask.parameters, ...serviceParams.params } };
          }
          if (serviceParams.env && Object.keys(serviceParams.env).length > 0) {
            resolvedTask = {
              ...resolvedTask,
              parameters: {
                ...resolvedTask.parameters,
                env: { ...((resolvedTask.parameters as Record<string, unknown>).env as Record<string, string> || {}), ...serviceParams.env },
              },
            };
          }
        } catch (error) {
          logger.warn(
            { taskId: task.id, error: error instanceof Error ? error.message : String(error) },
            'Service parameter resolution failed, continuing without service params'
          );
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
          throw new OrionError(result.error || `Task '${task.name}' failed`, ErrorCode.OPERATION_FAILED);
        }
      }

      // Register stage-level outputs in VariableContext
      this.registerStageOutputs(execution, stage);

      // GAP-CN-04: Evaluate quality gate if configured
      const gateCheckResult = await callbacks.checkStageQualityGate(execution, stage);
      if (gateCheckResult) {
        throw new OrionError(gateCheckResult.reason, ErrorCode.OPERATION_FAILED);
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
      // Audit: record stage complete event
      this.recordStageAudit(execution, completedStage, 'complete', 'success', completedStage.durationMs).catch(() => {});

      execution.runningStages.delete(stage.id);
      execution.completedStages.add(stage.id);

      // 检查是否有新的 Stages 可以执行
      this.checkNextStages(execution, callbacks);

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
          await this.retryStageWithBackoff(execution, stage, retryResult.strategy, errorMessage, callbacks);
          callbacks.checkRunCompletion(execution);
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
      // Audit: record stage fail event
      this.recordStageAudit(execution, failedStage, 'fail', 'failure', failedStage.durationMs, failedStage.error || undefined).catch(() => {});

      execution.runningStages.delete(stage.id);
      execution.completedStages.add(stage.id);

      // 检查是否需要重试（旧逻辑，当 AutoRetryService 不可用时使用）
      if (!this.autoRetryService && this.shouldRetry(stage)) {
        this.retryStage(execution, stage, callbacks);
      } else {
        // 标记依赖于此 Stage 的其他 Stages 为失败
        this.failDependentStages(execution, stage);
      }

      // 检查 PipelineRun 是否完成
      callbacks.checkRunCompletion(execution);
    }
  }

  /**
   * 带退避策略的 Stage 重试
   */
  private async retryStageWithBackoff(
    execution: PipelineExecution,
    stage: Stage,
    strategy: 'immediate' | 'backoff' | 'skip',
    error: string,
    callbacks: {
      checkRunCompletion: (execution: PipelineExecution) => void;
    }
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
    // Note: executePendingStages is called from the caller to avoid circular dependency
  }

  /**
   * 检查是否有新的 Stages 可以执行
   * 改进：批量检查所有 pending stages，支持 fan-in 模式
   * 使用锁防止并行阶段完成时并发调用导致重复执行
   */
  checkNextStages(
    execution: PipelineExecution,
    callbacks: {
      evaluateCondition: (condition: string, execution: PipelineExecution) => boolean;
      checkApprovalGate: (execution: PipelineExecution, stage: Stage) => Promise<'proceed' | 'pending' | 'rejected'>;
      checkAndExecuteDeploymentStrategy: (execution: PipelineExecution, stage: Stage, tasks: Array<{ id: string; name: string; type: string; parameters: Record<string, unknown>; status?: string }>) => Promise<'success' | 'failed' | null>;
      checkStageQualityGate: (execution: PipelineExecution, stage: Stage) => Promise<{ reason: string } | undefined>;
      checkRunCompletion: (execution: PipelineExecution) => void;
    }
  ): void {
    const runId = execution.run.id;

    // Fire-and-forget pattern: wrap async logic
    if (this.nextStageCheckLocks.has(runId)) {
      return; // already running
    }

    const checkPromise = this.doCheckNextStages(execution, callbacks).finally(() => {
      this.nextStageCheckLocks.delete(runId);
    });
    this.nextStageCheckLocks.set(runId, checkPromise);
  }

  /**
   * 实际执行 next stages 检查的逻辑
   */
  private async doCheckNextStages(
    execution: PipelineExecution,
    callbacks: {
      evaluateCondition: (condition: string, execution: PipelineExecution) => boolean;
      checkApprovalGate: (execution: PipelineExecution, stage: Stage) => Promise<'proceed' | 'pending' | 'rejected'>;
      checkAndExecuteDeploymentStrategy: (execution: PipelineExecution, stage: Stage, tasks: Array<{ id: string; name: string; type: string; parameters: Record<string, unknown>; status?: string }>) => Promise<'success' | 'failed' | null>;
      checkStageQualityGate: (execution: PipelineExecution, stage: Stage) => Promise<{ reason: string } | undefined>;
      checkRunCompletion: (execution: PipelineExecution) => void;
    }
  ): Promise<void> {
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
        // Audit: record stage skip event (dependency failed)
        this.recordStageAudit(execution, skippedStage, 'skip', 'failure', undefined, 'Dependency failed').catch(() => {});
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
      await this.executePendingStages(execution, callbacks);
    }

    // 检查 PipelineRun 是否完成
    callbacks.checkRunCompletion(execution);
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
  private async retryStage(
    execution: PipelineExecution,
    stage: Stage,
    callbacks: {
      checkRunCompletion: (execution: PipelineExecution) => void;
    }
  ): Promise<void> {
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
   */
  private registerStageOutputs(execution: PipelineExecution, stage: Stage): void {
    const variableCtx = this.variableContexts.get(execution.run.id);
    const resolver = this.parameterResolvers.get(execution.run.id);
    if (!variableCtx || !resolver) return;

    // Stage outputs are stored in the stage's result field during initialization
    const stageOutputs = (stage.result as { outputs?: Record<string, string> } | undefined)?.outputs;
    if (!stageOutputs) return;

    // Use StageParameterResolver to extract and resolve outputs
    const outputs = resolver.extractStageOutputs([], stageOutputs);
    for (const [key, value] of Object.entries(outputs)) {
      variableCtx.setTaskOutput(stage.name, key, value);
      logger.info(
        { runId: execution.run.id, stageName: stage.name, key, value },
        'Stage output registered'
      );
    }
  }

  /**
   * Record a stage lifecycle audit event (fire-and-forget).
   */
  private async recordStageAudit(
    execution: PipelineExecution,
    stage: Stage,
    action: 'start' | 'complete' | 'skip' | 'fail',
    outcome: 'success' | 'failure',
    durationMs?: number,
    errorMessage?: string,
  ): Promise<void> {
    if (!this.pipelineAuditLogService) return;

    // Map outcome to AuditOutcome type ('success' | 'failed' | 'pending')
    const auditOutcome: 'success' | 'failed' | 'pending' = outcome === 'success' ? 'success' : 'failed';

    const tenantId = (execution.run.context as any)?.tenantId || getCurrentTenantId();
    try {
      await this.pipelineAuditLogService.recordStageEvent({
        tenantId,
        runId: execution.run.id,
        stageId: stage.id,
        action,
        actor: execution.run.triggerBy || 'system',
        outcome: auditOutcome,
        durationMs,
        errorMessage,
        metadata: { stageName: stage.name, pipelineId: execution.run.pipelineId },
      });
    } catch (error) {
      logger.warn(
        { stageId: stage.id, error: error instanceof Error ? error.message : String(error) },
        'Failed to record stage audit event (non-fatal)'
      );
    }
  }

  /**
   * Resolve GlobalParam and EnvProfile variables for a task.
   *
   * Global params: resolves ${global.xxx} references from GlobalParamService.
   * Env profile: resolves environment variables from EnvProfileService based on run environment.
   *
   * @returns Object with `params` (merged into task.parameters) and `env` (merged into task.parameters.env)
   */
  private async resolveServiceParameters(
    execution: PipelineExecution,
    task: Task,
  ): Promise<{ params: Record<string, string>; env: Record<string, string> }> {
    const tenantId = (execution.run.context as any)?.tenantId || getCurrentTenantId();
    const environment = execution.run.environment;
    const params: Record<string, string> = {};
    const env: Record<string, string> = {};

    // Resolve GlobalParam references
    if (this.globalParamService) {
      try {
        const globalKeys: Record<string, string> = {};
        for (const [key, value] of Object.entries(task.parameters)) {
          if (typeof value === 'string' && value.includes('${global.')) {
            globalKeys[key] = value;
          }
        }
        if (Object.keys(globalKeys).length > 0) {
          const resolved = await this.globalParamService.resolve(tenantId, globalKeys);
          Object.assign(params, resolved);
        }
      } catch (error) {
        logger.warn(
          { taskId: task.id, error: error instanceof Error ? error.message : String(error) },
          'GlobalParam resolution failed'
        );
      }
    }

    // Resolve EnvProfile variables
    if (this.envProfileService && environment) {
      try {
        const profileName = `default-${environment}`;
        const resolvedEnv = await this.envProfileService.resolveVariables(tenantId, profileName, environment);
        Object.assign(env, resolvedEnv);
      } catch (error) {
        logger.warn(
          { taskId: task.id, environment, error: error instanceof Error ? error.message : String(error) },
          'EnvProfile resolution failed'
        );
      }
    }

    return { params, env };
  }

  /**
   * GAP-03: Execute a sub-pipeline stage.
   */
  private async executeSubPipelineStage(
    execution: PipelineExecution,
    stage: Stage,
    tasks: Array<{ id: string; name: string; type: string; parameters: Record<string, unknown>; [key: string]: unknown }>,
    checkRunCompletion: (execution: PipelineExecution) => void
  ): Promise<void> {
    if (!this.subPipelineService) {
      throw new OrionError(`SubPipelineService not configured. Stage '${stage.name}' uses sub-pipeline type but SubPipelineService is not available.`, 'SERVICE_UNAVAILABLE');
    }

    const subPipelineTask = tasks[0];
    const params = subPipelineTask.parameters || {};
    const childPipelineId = params.pipelineId as string;

    if (!childPipelineId) {
      throw new OrionError(`Sub-pipeline stage '${stage.name}' missing required parameter: pipelineId`, 'NOT_FOUND');
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
      // Note: checkNextStages will be called from caller

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
      throw new OrionError(`Sub-pipeline '${stage.name}' failed: ${errorMessage}`, ErrorCode.OPERATION_FAILED);
    }
  }

  /**
   * 失败依赖此 Stage 的其他 Stages
   */
  async failDependentStages(execution: PipelineExecution, failedStage: Stage): Promise<void> {
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
   * Uses ConditionRouter for stage-level conditions (stages.X.status, stages.X.result.Y).
   * Falls back to ExpressionEvaluator for backward compatibility.
   */
  evaluateCondition(condition: string, execution: PipelineExecution): boolean {
    try {
      // Use ConditionRouter if available for this run
      const conditionRouter = this.conditionRouters.get(execution.run.id);
      if (conditionRouter) {
        return conditionRouter.evaluate(condition, execution);
      }

      // Fallback: Build expression context from execution data
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
   * Save a checkpoint for the current execution state.
   */
  async saveCheckpoint(
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
}
