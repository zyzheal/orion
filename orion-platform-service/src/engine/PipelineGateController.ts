/**
 * PipelineGateController - 流水线门禁控制器
 *
 * 负责：
 * - 部署策略执行（Canary / Blue-Green / Rolling）
 * - 质量门禁评估（GAP-CN-04）
 * - 审批网关管理（审批请求/通过/拒绝）
 */

import { OrionError, ErrorCode } from '../errors';
import { PipelineRun } from '../models/PipelineRun';
import { Stage, StageStatus } from '../models/Stage';
import { PipelineRunService } from '../services/pipeline/PipelineRunService';
import { PipelineEventPublisher } from '../events/PipelineEventPublisher';
import { PipelineEventSSEBridge } from '../services/pipeline/PipelineEventSSEBridge';
import { ApprovalGateService } from '../services/pipeline/ApprovalGateService';
import { QualityGateService } from '../services/pipeline/QualityGateService';
import { QualityGateResult } from '../models/QualityGate';
import { DeploymentStrategyService, CanaryConfig, BlueGreenConfig, RollingConfig } from '../services/pipeline/DeploymentStrategyService';
import { PipelineExecution } from './PipelineEngine';
import { VariableContext } from './VariableContext';
import { createLogger } from '../utils/logger';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface PipelineGateControllerDeps {
  runService: PipelineRunService;
  eventPublisher: PipelineEventPublisher;
  sseBridge: PipelineEventSSEBridge | null;
  approvalGateService: ApprovalGateService | null;
  qualityGateService: QualityGateService | null;
  deploymentStrategyService: DeploymentStrategyService | null;
}

export class PipelineGateController {
  private runService: PipelineRunService;
  private eventPublisher: PipelineEventPublisher;
  private sseBridge: PipelineEventSSEBridge | null;
  private approvalGateService: ApprovalGateService | null;
  private qualityGateService: QualityGateService | null;
  private deploymentStrategyService: DeploymentStrategyService | null;

  constructor(deps: PipelineGateControllerDeps) {
    this.runService = deps.runService;
    this.eventPublisher = deps.eventPublisher;
    this.sseBridge = deps.sseBridge;
    this.approvalGateService = deps.approvalGateService;
    this.qualityGateService = deps.qualityGateService;
    this.deploymentStrategyService = deps.deploymentStrategyService;
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
  async checkAndExecuteDeploymentStrategy(
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
        throw new OrionError(`Deployment strategy not found: ${strategyId || strategyName}`, ErrorCode.NOT_FOUND);
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
        throw new OrionError(`Unknown deployment strategy type: ${inline.type}`, ErrorCode.VALIDATION_ERROR);
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
        throw new OrionError(`Unknown deployment strategy type: ${strategy.type}`, ErrorCode.VALIDATION_ERROR);
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
   */
  async checkStageQualityGate(
    execution: PipelineExecution,
    stage: Stage,
    variableContexts: Map<string, VariableContext>
  ): Promise<{ reason: string; result: QualityGateResult } | undefined> {
    if (!this.qualityGateService) {
      return undefined;
    }

    // 从 stage 配置中获取质量门禁 ID
    const qualityGateId = (stage.result as any)?.qualityGateId;
    const qualityGateName = (stage.result as any)?.qualityGateName;

    if (!qualityGateId && !qualityGateName) {
      return undefined; // 此 stage 不需要质量门禁
    }

    try {
      // 收集阶段指标（从任务输出、环境变量等获取）
      const metrics = this.collectStageQualityMetrics(execution, stage, variableContexts);

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
   */
  private collectStageQualityMetrics(
    execution: PipelineExecution,
    stage: Stage,
    variableContexts: Map<string, VariableContext>
  ): Record<string, number> {
    const metrics: Record<string, number> = {};

    // 从 VariableContext 收集任务输出指标
    const variableCtx = variableContexts.get(execution.run.id);
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
  async checkApprovalGate(
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
      throw new OrionError('Approval gate service not configured', ErrorCode.SERVICE_UNAVAILABLE);
    }

    // 更新审批状态
    await this.approvalGateService.approve(runId, stageId, userId, comment);
  }

  /**
   * 审批拒绝一个 stage
   */
  async rejectStage(runId: string, stageId: string, userId: string, comment?: string): Promise<void> {
    if (!this.approvalGateService) {
      throw new OrionError('Approval gate service not configured', ErrorCode.SERVICE_UNAVAILABLE);
    }

    await this.approvalGateService.reject(runId, stageId, userId, comment);
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
}
