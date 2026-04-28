/**
 * Deploy Saga - 部署流程的分布式事务实现
 *
 * ARCH-011: 扩展 SagaCoordinator 到 Deploy 模块
 *
 * 步骤定义：
 * 1. createDeployment - 补偿: deleteDeployment
 * 2. runCanaryAnalysis - 补偿: cancelCanaryAnalysis
 * 3. promoteToProduction - 补偿: rollbackDeployment
 * 4. updateStatus - 补偿: revertStatus
 * 5. publishEvents - 补偿: publishRollbackEvents
 */

import { SagaStep, SagaContext, SagaDefinition } from './types';
import { DeploymentEventPublisher } from '../events/DeploymentEventPublisher';
import { EventBusService } from '../services/event-bus-service';

/**
 * Deploy Saga 输入
 */
export interface DeploySagaInput {
  /** 服务名称 */
  service: string;
  /** 目标环境 */
  environment: string;
  /** 版本 */
  version?: string;
  /** 部署策略 */
  strategy?: 'blue-green' | 'canary' | 'rolling' | 'recreate';
  /** 部署者 */
  deployedBy?: string;
  /** 租户 ID */
  tenantId?: string;
  /** Canary 配置 */
  canaryConfig?: {
    /** Canary 比例 */
    percentage?: number;
    /** Canary 持续时间 (秒) */
    durationSeconds?: number;
    /** 分析指标 */
    metrics?: string[];
  };
}

/**
 * Deploy Saga 输出
 */
export interface DeploySagaOutput {
  /** 部署 ID */
  deploymentId: string;
  /** 服务名称 */
  service: string;
  /** 环境 */
  environment: string;
  /** 最终状态 */
  status: DeploySagaStatus;
  /** 版本 */
  version?: string;
  /** 执行耗时 */
  durationMs?: number;
  /** 错误信息 */
  error?: string;
  /** Canary 分析结果 */
  canaryResult?: {
    passed: boolean;
    metrics: Record<string, number>;
  };
}

/**
 * Deploy Saga 状态
 */
export enum DeploySagaStatus {
  CREATED = 'created',
  RUNNING = 'running',
  CANARY_RUNNING = 'canary_running',
  PROMOTING = 'promoting',
  COMPLETED = 'completed',
  FAILED = 'failed',
  ROLLED_BACK = 'rolled_back',
}

/**
 * 步骤输出类型
 */
interface CreateDeploymentOutput {
  deploymentId: string;
  service: string;
  environment: string;
  version: string;
  status: DeploySagaStatus;
}

interface RunCanaryOutput {
  passed: boolean;
  metrics: Record<string, number>;
  durationSeconds: number;
  skipped?: boolean;
}

interface PromoteOutput {
  promoted: boolean;
  previousVersion?: string;
}

interface UpdateStatusOutput {
  status: DeploySagaStatus;
  previousStatus: DeploySagaStatus;
}

interface PublishEventsOutput {
  published: boolean;
  events: string[];
}

/**
 * 内存存储（用于 Saga 执行期间的临时状态）
 */
const deployments = new Map<string, {
  id: string;
  service: string;
  environment: string;
  version: string;
  status: DeploySagaStatus;
  deployedBy?: string;
  tenantId?: string;
  strategy?: string;
  createdAt: Date;
  updatedAt: Date;
  previousVersion?: string;
}>();

/**
 * 创建 Deploy Saga 定义
 */
export function createDeploySagaDefinition(
  eventPublisher: DeploymentEventPublisher,
  canaryAnalysisService?: any,  // CanaryAnalysisService 实例
  deployService?: any,          // DeployService 实例
): SagaDefinition<DeploySagaInput, DeploySagaOutput> {
  const steps: SagaStep<DeploySagaInput, unknown>[] = [
    // 步骤 1: 创建部署记录
    {
      name: 'createDeployment',
      sequence: 1,
      execute: async (input: DeploySagaInput, context: SagaContext): Promise<CreateDeploymentOutput> => {
        const deploymentId = `deploy-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
        const version = input.version || `v${Date.now()}`;

        // 创建部署记录
        const deployment = {
          id: deploymentId,
          service: input.service,
          environment: input.environment,
          version,
          status: DeploySagaStatus.CREATED,
          deployedBy: input.deployedBy,
          tenantId: input.tenantId,
          strategy: input.strategy || 'rolling',
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        deployments.set(deploymentId, deployment);

        // 存储到上下文
        context.metadata.deploymentId = deploymentId;
        context.metadata.service = input.service;
        context.metadata.environment = input.environment;

        // 发布部署开始事件
        await eventPublisher.publishDeploymentStarted({
          deploymentId,
          service: input.service,
          environment: input.environment,
          version,
          deployedBy: input.deployedBy,
          strategy: input.strategy,
        });

        return {
          deploymentId,
          service: input.service,
          environment: input.environment,
          version,
          status: DeploySagaStatus.CREATED,
        };
      },
      compensate: async (input: DeploySagaInput, output: unknown, context: SagaContext): Promise<void> => {
        const typedOutput = output as CreateDeploymentOutput;
        const deploymentId = context.metadata.deploymentId as string || typedOutput.deploymentId;

        // 删除部署记录
        deployments.delete(deploymentId);

        // 发布取消事件
        await eventPublisher.publishDeploymentCancelled({
          deploymentId,
          service: typedOutput.service,
          environment: typedOutput.environment,
          cancelledBy: input.deployedBy,
          reason: 'Saga compensation',
        });
      },
      retryConfig: {
        maxRetries: 2,
        initialDelayMs: 500,
        maxDelayMs: 5000,
        multiplier: 2,
      },
    },

    // 步骤 2: Canary 分析（仅 blue-green/canary 策略）
    {
      name: 'runCanaryAnalysis',
      sequence: 2,
      execute: async (input: DeploySagaInput, context: SagaContext): Promise<RunCanaryOutput> => {
        const deploymentId = context.metadata.deploymentId as string;
        const deployment = deployments.get(deploymentId);

        if (!deployment) {
          throw new Error(`Deployment '${deploymentId}' not found`);
        }

        // 仅 canary/blue-green 策略需要 Canary 分析
        if (deployment.strategy !== 'canary' && deployment.strategy !== 'blue-green') {
          // 跳过 Canary 分析
          deployment.status = DeploySagaStatus.RUNNING;
          return { passed: true, metrics: {}, durationSeconds: 0, skipped: true };
        }

        deployment.status = DeploySagaStatus.CANARY_RUNNING;
        deployments.set(deploymentId, deployment);

        // 如果有真实的 CanaryAnalysisService，则使用它
        if (canaryAnalysisService) {
          try {
            const result = await canaryAnalysisService.runAnalysis({
              service: input.service,
              environment: input.environment,
              percentage: input.canaryConfig?.percentage ?? 10,
              durationSeconds: input.canaryConfig?.durationSeconds ?? 300,
              metrics: input.canaryConfig?.metrics ?? ['latency', 'error_rate', 'throughput'],
            });

            deployment.status = result.passed ? DeploySagaStatus.RUNNING : DeploySagaStatus.FAILED;
            deployments.set(deploymentId, deployment);

            return {
              passed: result.passed,
              metrics: result.metrics,
              durationSeconds: result.durationSeconds,
            };
          } catch (error) {
            deployment.status = DeploySagaStatus.FAILED;
            deployments.set(deploymentId, deployment);
            throw error;
          }
        }

        // Fallback: 模拟 Canary 分析
        const mockResult = {
          passed: true,
          metrics: {
            latency: 50,
            error_rate: 0.1,
            throughput: 1000,
          },
          durationSeconds: input.canaryConfig?.durationSeconds ?? 60,
        };

        deployment.status = DeploySagaStatus.RUNNING;
        deployments.set(deploymentId, deployment);

        return mockResult;
      },
      compensate: async (input: DeploySagaInput, output: unknown, context: SagaContext): Promise<void> => {
        const typedOutput = output as RunCanaryOutput;
        const deploymentId = context.metadata.deploymentId as string;

        // 取消 Canary 分析（如果正在运行）
        if (canaryAnalysisService && !typedOutput.skipped) {
          await canaryAnalysisService.cancelAnalysis({
            service: input.service,
            environment: input.environment,
          });
        }
      },
      timeoutMs: 600000, // 10 分钟（Canary 分析可能较长）
    },

    // 步骤 3: 推进到生产环境
    {
      name: 'promoteToProduction',
      sequence: 3,
      execute: async (input: DeploySagaInput, context: SagaContext): Promise<PromoteOutput> => {
        const deploymentId = context.metadata.deploymentId as string;
        const deployment = deployments.get(deploymentId);

        if (!deployment) {
          throw new Error(`Deployment '${deploymentId}' not found`);
        }

        // 检查 Canary 结果
        const canaryOutput = context.stepExecutions[1]?.output as RunCanaryOutput;
        if (canaryOutput && !canaryOutput.passed && !canaryOutput.skipped) {
          throw new Error('Canary analysis failed, cannot promote to production');
        }

        deployment.status = DeploySagaStatus.PROMOTING;
        deployments.set(deploymentId, deployment);

        // 如果有真实的 DeployService，则使用它
        let previousVersion: string | undefined;
        if (deployService) {
          try {
            const result = await deployService.promote({
              deploymentId,
              service: input.service,
              environment: input.environment,
              strategy: deployment.strategy,
            });
            previousVersion = result.previousVersion;

            // 保存 previousVersion 到部署记录
            deployment.previousVersion = previousVersion;
            deployments.set(deploymentId, deployment);
          } catch (error) {
            throw error;
          }
        }

        deployment.status = DeploySagaStatus.COMPLETED;
        deployments.set(deploymentId, deployment);

        return {
          promoted: true,
          previousVersion,
        };
      },
      compensate: async (input: DeploySagaInput, output: unknown, context: SagaContext): Promise<void> => {
        const typedOutput = output as PromoteOutput;
        const deploymentId = context.metadata.deploymentId as string;
        const deployment = deployments.get(deploymentId);

        if (!deployment) return;

        // 回滚部署
        deployment.status = DeploySagaStatus.ROLLED_BACK;
        deployments.set(deploymentId, deployment);

        if (deployService && typedOutput.previousVersion) {
          await deployService.rollback({
            deploymentId,
            service: input.service,
            environment: input.environment,
            targetVersion: typedOutput.previousVersion,
          });
        }

        // 发布回滚事件
        await eventPublisher.publishDeploymentRolledback({
          deploymentId,
          service: input.service,
          environment: input.environment,
          rollbackToVersion: typedOutput.previousVersion,
          reason: 'Saga compensation',
        });
      },
      timeoutMs: 300000, // 5 分钟
    },

    // 步骤 4: 更新状态
    {
      name: 'updateStatus',
      sequence: 4,
      execute: async (input: DeploySagaInput, context: SagaContext): Promise<UpdateStatusOutput> => {
        const deploymentId = context.metadata.deploymentId as string;
        const deployment = deployments.get(deploymentId);

        if (!deployment) {
          throw new Error(`Deployment '${deploymentId}' not found`);
        }

        const previousStatus = deployment.status;
        const now = new Date();

        // 计算执行耗时
        const durationMs = now.getTime() - deployment.createdAt.getTime();

        // 更新部署记录
        const updatedDeployment = {
          ...deployment,
          status: DeploySagaStatus.COMPLETED,
          updatedAt: now,
        };

        deployments.set(deploymentId, updatedDeployment);

        return {
          status: DeploySagaStatus.COMPLETED,
          previousStatus,
        };
      },
      compensate: async (input: DeploySagaInput, output: unknown, context: SagaContext): Promise<void> => {
        const typedOutput = output as UpdateStatusOutput;
        const deploymentId = context.metadata.deploymentId as string;
        const deployment = deployments.get(deploymentId);

        if (deployment) {
          deployment.status = typedOutput.previousStatus;
          deployment.updatedAt = new Date();
          deployments.set(deploymentId, deployment);
        }
      },
    },

    // 步骤 5: 发布事件
    {
      name: 'publishEvents',
      sequence: 5,
      execute: async (input: DeploySagaInput, context: SagaContext): Promise<PublishEventsOutput> => {
        const deploymentId = context.metadata.deploymentId as string;
        const deployment = deployments.get(deploymentId);

        if (!deployment) {
          throw new Error(`Deployment '${deploymentId}' not found`);
        }

        const events: string[] = [];

        // 发布完成事件
        await eventPublisher.publishDeploymentCompleted({
          deploymentId,
          service: deployment.service,
          environment: deployment.environment,
          status: 'completed' as any,  // ARCH-011: 类型兼容
          version: deployment.version,
          durationMs: deployment.updatedAt.getTime() - deployment.createdAt.getTime(),
        });
        events.push('deploy.completed');

        return { published: true, events };
      },
      compensate: async (input: DeploySagaInput, output: unknown, context: SagaContext): Promise<void> => {
        const deploymentId = context.metadata.deploymentId as string;
        const deployment = deployments.get(deploymentId);

        if (deployment) {
          // 发布失败事件
          await eventPublisher.publishDeploymentFailed({
            deploymentId,
            service: deployment.service,
            environment: deployment.environment,
            error: 'Saga failed during compensation',
            phase: 'events',
          });
        }
      },
      retryConfig: {
        maxRetries: 3,
        initialDelayMs: 1000,
        maxDelayMs: 10000,
        multiplier: 2,
      },
    },
  ];

  // finalize 函数
  const finalize = async (input: DeploySagaInput, context: SagaContext): Promise<DeploySagaOutput> => {
    const deploymentId = context.metadata.deploymentId as string;
    const deployment = deployments.get(deploymentId);

    if (!deployment) {
      throw new Error(`Deployment '${deploymentId}' not found`);
    }

    const canaryOutput = context.stepExecutions[1]?.output as RunCanaryOutput;

    return {
      deploymentId,
      service: deployment.service,
      environment: deployment.environment,
      status: deployment.status,
      version: deployment.version,
      durationMs: deployment.updatedAt.getTime() - deployment.createdAt.getTime(),
      canaryResult: canaryOutput && !canaryOutput.skipped ? {
        passed: canaryOutput.passed,
        metrics: canaryOutput.metrics,
      } : undefined,
    };
  };

  return {
    name: 'DeploySaga',
    steps,
    finalize,
  };
}

/**
 * Deploy Saga 服务
 */
export class DeploySaga {
  private definition: SagaDefinition<DeploySagaInput, DeploySagaOutput>;

  constructor(
    eventPublisher: DeploymentEventPublisher,
    canaryAnalysisService?: any,
    deployService?: any,
  ) {
    this.definition = createDeploySagaDefinition(eventPublisher, canaryAnalysisService, deployService);
  }

  /**
   * 获取 Saga 定义
   */
  getDefinition(): SagaDefinition<DeploySagaInput, DeploySagaOutput> {
    return this.definition;
  }

  /**
   * 获取部署记录
   */
  getDeployment(deploymentId: string): {
    id: string;
    service: string;
    environment: string;
    version: string;
    status: DeploySagaStatus;
    deployedBy?: string;
    tenantId?: string;
    strategy?: string;
    createdAt: Date;
    updatedAt: Date;
    previousVersion?: string;
  } | null {
    return deployments.get(deploymentId) ?? null;
  }

  /**
   * 清理数据
   */
  cleanup(deploymentId: string): void {
    deployments.delete(deploymentId);
  }
}