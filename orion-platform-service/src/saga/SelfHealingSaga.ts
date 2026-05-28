/**
 * Self-Healing Saga - 自愈流程的分布式事务实现
 *
 * ARCH-011: 扩展 SagaCoordinator 到 Self-Healing 模块
 *
 * 步骤定义：
 * 1. detectIssue - 补偿: clearDetection
 * 2. diagnoseRootCause - 补偿: cancelDiagnosis
 * 3. executeRemediation - 补偿: undoRemediation
 * 4. verifyResult - 补偿: clearVerification
 * 5. publishEvents - 补偿: publishFailureEvents
 */

import { SagaStep, SagaContext, SagaDefinition } from './types';
import { EventBusService } from '../services/event-bus-service';
import { OrionError, ErrorCode } from '../../errors';

/**
 * Self-Healing Saga 输入
 */
export interface SelfHealingSagaInput {
  /** 服务名称 */
  service: string;
  /** 环境 */
  environment?: string;
  /** 命名空间 */
  namespace?: string;
  /** 问题类型 */
  issueType?: 'pod_crash' | 'container_oom' | 'service_timeout' | 'resource_exhausted' | 'config_drift' | 'unknown';
  /** 警告 ID */
  alertId?: string;
  /** 租户 ID */
  tenantId?: string;
  /** 自动执行阈值（置信度 >= 此值时自动执行） */
  autoExecuteThreshold?: number;
  /** 用户批准（手动触发时需要） */
  userApproval?: boolean;
}

/**
 * Self-Healing Saga 输出
 */
export interface SelfHealingSagaOutput {
  /** 自愈 ID */
  healingId: string;
  /** 服务名称 */
  service: string;
  /** 最终状态 */
  status: SelfHealingSagaStatus;
  /** 检测结果 */
  detectionResult?: {
    issueType: string;
    severity: 'critical' | 'warning' | 'info';
    details: Record<string, unknown>;
  };
  /** 诊断结果 */
  diagnosisResult?: {
    rootCause: string;
    confidence: number;
    recommendedActions: string[];
  };
  /** 修复结果 */
  remediationResult?: {
    action: string;
    success: boolean;
    details: Record<string, unknown>;
  };
  /** 执行耗时 */
  durationMs?: number;
  /** 错误信息 */
  error?: string;
}

/**
 * Self-Healing Saga 状态
 */
export enum SelfHealingSagaStatus {
  DETECTING = 'detecting',
  DIAGNOSING = 'diagnosing',
  REMEDIATING = 'remediating',
  VERIFYING = 'verifying',
  COMPLETED = 'completed',
  FAILED = 'failed',
  UNDONE = 'undone',
  WAITING_APPROVAL = 'waiting_approval',
}

/**
 * 步骤输出类型
 */
interface DetectOutput {
  issueType: string;
  severity: 'critical' | 'warning' | 'info';
  details: Record<string, unknown>;
  alertId?: string;
}

interface DiagnoseOutput {
  rootCause: string;
  confidence: number;
  recommendedActions: string[];
  autoApproved: boolean;
}

interface RemediateOutput {
  action: string;
  success: boolean;
  details: Record<string, unknown>;
  previousState?: Record<string, unknown>;
}

interface VerifyOutput {
  verified: boolean;
  metrics: Record<string, number>;
}

interface PublishEventsOutput {
  published: boolean;
  events: string[];
}

/**
 * 内存存储
 */
const healingSessions = new Map<string, {
  id: string;
  service: string;
  environment?: string;
  namespace?: string;
  status: SelfHealingSagaStatus;
  tenantId?: string;
  alertId?: string;
  createdAt: Date;
  updatedAt: Date;
  detectionResult?: DetectOutput;
  diagnosisResult?: DiagnoseOutput;
  remediationResult?: RemediateOutput;
}>();

/**
 * 创建 Self-Healing Saga 定义
 */
export function createSelfHealingSagaDefinition(
  eventBus?: EventBusService,
  diagnosticService?: any,  // DiagnosticService 实例
  selfHealingService?: any, // SelfHealingService 实例
): SagaDefinition<SelfHealingSagaInput, SelfHealingSagaOutput> {
  const steps: SagaStep<SelfHealingSagaInput, unknown>[] = [
    // 步骤 1: 问题检测
    {
      name: 'detectIssue',
      sequence: 1,
      execute: async (input: SelfHealingSagaInput, context: SagaContext): Promise<DetectOutput> => {
        const healingId = `healing-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

        // 创建自愈会话
        const session = {
          id: healingId,
          service: input.service,
          environment: input.environment,
          namespace: input.namespace,
          status: SelfHealingSagaStatus.DETECTING,
          tenantId: input.tenantId,
          alertId: input.alertId,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        healingSessions.set(healingId, session);

        // 存储到上下文
        context.metadata.healingId = healingId;
        context.metadata.service = input.service;

        // 检测问题（如果有 diagnosticService）
        let detection: DetectOutput;
        if (diagnosticService) {
          try {
            const result = await diagnosticService.detect({
              service: input.service,
              environment: input.environment,
              namespace: input.namespace,
              alertId: input.alertId,
            });

            detection = {
              issueType: result.issueType || input.issueType || 'unknown',
              severity: result.severity || 'warning',
              details: result.details || {},
              alertId: input.alertId,
            };
          } catch (error) {
            detection = {
              issueType: input.issueType || 'unknown',
              severity: 'warning',
              details: { error: error instanceof Error ? error.message : 'Detection failed' },
              alertId: input.alertId,
            };
          }
        } else {
          // Fallback: 模拟检测
          detection = {
            issueType: input.issueType || 'pod_crash',
            severity: 'warning',
            details: {
              podCount: 3,
              crashCount: 1,
              lastCrashTime: new Date().toISOString(),
            },
            alertId: input.alertId,
          };
        }

        // 保存检测结果
        const updatedSession = healingSessions.get(healingId);
        if (updatedSession) {
          updatedSession.detectionResult = detection;
          healingSessions.set(healingId, updatedSession);
        }

        return detection;
      },
      compensate: async (input: SelfHealingSagaInput, output: unknown, context: SagaContext): Promise<void> => {
        const healingId = context.metadata.healingId as string;

        // 清除检测记录
        healingSessions.delete(healingId);

        // 如果有 eventBus，发布清除事件
        if (eventBus) {
          await eventBus.publish('selfhealing.detection.cleared', {
            healingId,
            service: input.service,
            reason: 'Saga compensation',
          });
        }
      },
      retryConfig: {
        maxRetries: 2,
        initialDelayMs: 500,
        maxDelayMs: 5000,
        multiplier: 2,
      },
    },

    // 步骤 2: 根因诊断
    {
      name: 'diagnoseRootCause',
      sequence: 2,
      execute: async (input: SelfHealingSagaInput, context: SagaContext): Promise<DiagnoseOutput> => {
        const healingId = context.metadata.healingId as string;
        const session = healingSessions.get(healingId);

        if (!session) {
          throw new OrionError(ErrorCode.NOT_FOUND, `Self-healing session '${healingId}' not found`);
        }

        session.status = SelfHealingSagaStatus.DIAGNOSING;
        healingSessions.set(healingId, session);

        // 诊断根因
        let diagnosis: DiagnoseOutput;
        if (diagnosticService) {
          try {
            const result = await diagnosticService.diagnose({
              service: input.service,
              issueType: session.detectionResult?.issueType,
              details: session.detectionResult?.details,
            });

            diagnosis = {
              rootCause: result.rootCause || 'Unknown',
              confidence: result.confidence ?? 0.7,
              recommendedActions: result.recommendedActions ?? ['restart'],
              autoApproved: result.confidence >= (input.autoExecuteThreshold ?? 90) || input.userApproval === true,
            };
          } catch (error) {
            diagnosis = {
              rootCause: 'Diagnostic service unavailable',
              confidence: 0,
              recommendedActions: [],
              autoApproved: false,
            };
          }
        } else {
          // Fallback: 模拟诊断
          diagnosis = {
            rootCause: 'Pod memory limit exceeded',
            confidence: 85,
            recommendedActions: ['restart', 'increase_memory_limit'],
            autoApproved: 85 >= (input.autoExecuteThreshold ?? 90) || input.userApproval === true,
          };
        }

        // 检查是否需要人工审批
        if (!diagnosis.autoApproved) {
          session.status = SelfHealingSagaStatus.WAITING_APPROVAL;
          healingSessions.set(healingId, session);

          // 如果没有用户批准，抛出等待错误
          if (!input.userApproval) {
            throw new OrionError(ErrorCode.NOT_FOUND, `Confidence ${diagnosis.confidence}% below threshold ${input.autoExecuteThreshold ?? 90}%, waiting for user approval`);
          }
        }

        // 保存诊断结果
        session.diagnosisResult = diagnosis;
        healingSessions.set(healingId, session);

        return diagnosis;
      },
      compensate: async (input: SelfHealingSagaInput, output: unknown, context: SagaContext): Promise<void> => {
        const healingId = context.metadata.healingId as string;
        const session = healingSessions.get(healingId);

        if (session) {
          // 取消诊断会话
          if (diagnosticService) {
            await diagnosticService.cancelSession({ healingId });
          }

          session.diagnosisResult = undefined;
          session.status = SelfHealingSagaStatus.FAILED;
          healingSessions.set(healingId, session);
        }
      },
      timeoutMs: 120000, // 2 分钟
    },

    // 步骤 3: 执行修复
    {
      name: 'executeRemediation',
      sequence: 3,
      execute: async (input: SelfHealingSagaInput, context: SagaContext): Promise<RemediateOutput> => {
        const healingId = context.metadata.healingId as string;
        const session = healingSessions.get(healingId);

        if (!session || !session.diagnosisResult) {
          throw new OrionError(ErrorCode.NOT_FOUND, `Self-healing session '${healingId}' not found or diagnosis missing`);
        }

        session.status = SelfHealingSagaStatus.REMEDIATING;
        healingSessions.set(healingId, session);

        // 选择修复动作（取置信度最高的）
        const action = session.diagnosisResult.recommendedActions[0] || 'restart';

        // 执行修复
        let remediation: RemediateOutput;
        if (selfHealingService) {
          try {
            // 获取当前状态（用于回滚）
            const previousState = await selfHealingService.getCurrentState({
              service: input.service,
              namespace: input.namespace,
            });

            const result = await selfHealingService.executeRemediation({
              healingId,
              service: input.service,
              namespace: input.namespace,
              action,
              previousState,
            });

            remediation = {
              action,
              success: result.success,
              details: result.details || {},
              previousState,
            };
          } catch (error) {
            remediation = {
              action,
              success: false,
              details: { error: error instanceof Error ? error.message : 'Remediation failed' },
            };
          }
        } else {
          // Fallback: 模拟修复
          remediation = {
            action,
            success: true,
            details: {
              restartedPods: 1,
              previousPodName: `${input.service}-pod-12345`,
              newPodName: `${input.service}-pod-67890`,
            },
            previousState: { podName: `${input.service}-pod-12345` },
          };
        }

        // 保存修复结果
        session.remediationResult = remediation;
        healingSessions.set(healingId, session);

        if (!remediation.success) {
          throw new OrionError(ErrorCode.NOT_FOUND, `Remediation action '${action}' failed`);
        }

        return remediation;
      },
      compensate: async (input: SelfHealingSagaInput, output: unknown, context: SagaContext): Promise<void> => {
        const typedOutput = output as RemediateOutput;
        const healingId = context.metadata.healingId as string;
        const session = healingSessions.get(healingId);

        if (!session) return;

        // 撤销修复（回滚到之前状态）
        session.status = SelfHealingSagaStatus.UNDONE;
        healingSessions.set(healingId, session);

        if (selfHealingService && typedOutput.previousState) {
          await selfHealingService.undoRemediation({
            healingId,
            service: input.service,
            namespace: input.namespace,
            previousState: typedOutput.previousState,
          });
        }

        // 如果有 eventBus，发布撤销事件
        if (eventBus) {
          await eventBus.publish('selfhealing.remediation.undo', {
            healingId,
            service: input.service,
            action: typedOutput.action,
            reason: 'Saga compensation',
          });
        }
      },
      timeoutMs: 180000, // 3 分钟
    },

    // 步骤 4: 验证结果
    {
      name: 'verifyResult',
      sequence: 4,
      execute: async (input: SelfHealingSagaInput, context: SagaContext): Promise<VerifyOutput> => {
        const healingId = context.metadata.healingId as string;
        const session = healingSessions.get(healingId);

        if (!session) {
          throw new OrionError(ErrorCode.NOT_FOUND, `Self-healing session '${healingId}' not found`);
        }

        session.status = SelfHealingSagaStatus.VERIFYING;
        healingSessions.set(healingId, session);

        // 验证修复结果
        let verification: VerifyOutput;
        if (selfHealingService) {
          try {
            const result = await selfHealingService.verifyRemediation({
              healingId,
              service: input.service,
              namespace: input.namespace,
              action: session.remediationResult?.action,
            });

            verification = {
              verified: result.verified,
              metrics: result.metrics || {},
            };
          } catch (error) {
            verification = {
              verified: false,
              metrics: {},
            };
          }
        } else {
          // Fallback: 模拟验证
          verification = {
            verified: true,
            metrics: {
              restartCount: 0,
              latencyMs: 50,  // ARCH-011: 数值类型，重命名为 latencyMs
              healthyPodCount: 3,  // 数值类型
            },
          };
        }

        if (!verification.verified) {
          throw new OrionError(ErrorCode.OPERATION_FAILED, 'Remediation verification failed');
        }

        session.status = SelfHealingSagaStatus.COMPLETED;
        healingSessions.set(healingId, session);

        return verification;
      },
      compensate: async (input: SelfHealingSagaInput, output: unknown, context: SagaContext): Promise<void> => {
        const healingId = context.metadata.healingId as string;
        const session = healingSessions.get(healingId);

        if (session) {
          session.status = SelfHealingSagaStatus.FAILED;
          healingSessions.set(healingId, session);
        }
      },
      timeoutMs: 60000, // 1 分钟
    },

    // 步骤 5: 发布事件
    {
      name: 'publishEvents',
      sequence: 5,
      execute: async (input: SelfHealingSagaInput, context: SagaContext): Promise<PublishEventsOutput> => {
        const healingId = context.metadata.healingId as string;
        const session = healingSessions.get(healingId);

        if (!session) {
          throw new OrionError(ErrorCode.NOT_FOUND, `Self-healing session '${healingId}' not found`);
        }

        const events: string[] = [];

        // 发布完成事件
        if (eventBus) {
          await eventBus.publish('selfhealing.completed', {
            healingId,
            service: input.service,
            issueType: session.detectionResult?.issueType,
            rootCause: session.diagnosisResult?.rootCause,
            action: session.remediationResult?.action,
            verified: true,
            durationMs: session.updatedAt.getTime() - session.createdAt.getTime(),
          });
          events.push('selfhealing.completed');
        }

        return { published: true, events };
      },
      compensate: async (input: SelfHealingSagaInput, output: unknown, context: SagaContext): Promise<void> => {
        const healingId = context.metadata.healingId as string;
        const session = healingSessions.get(healingId);

        if (session && eventBus) {
          // 发布失败事件
          await eventBus.publish('selfhealing.failed', {
            healingId,
            service: input.service,
            reason: 'Saga failed during compensation',
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
  const finalize = async (input: SelfHealingSagaInput, context: SagaContext): Promise<SelfHealingSagaOutput> => {
    const healingId = context.metadata.healingId as string;
    const session = healingSessions.get(healingId);

    if (!session) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Self-healing session '${healingId}' not found`);
    }

    return {
      healingId,
      service: session.service,
      status: session.status,
      detectionResult: session.detectionResult,
      diagnosisResult: session.diagnosisResult,
      remediationResult: session.remediationResult,
      durationMs: session.updatedAt.getTime() - session.createdAt.getTime(),
    };
  };

  return {
    name: 'SelfHealingSaga',
    steps,
    finalize,
  };
}

/**
 * Self-Healing Saga 服务
 */
export class SelfHealingSaga {
  private definition: SagaDefinition<SelfHealingSagaInput, SelfHealingSagaOutput>;

  constructor(
    eventBus?: EventBusService,
    diagnosticService?: any,
    selfHealingService?: any,
  ) {
    this.definition = createSelfHealingSagaDefinition(eventBus, diagnosticService, selfHealingService);
  }

  /**
   * 获取 Saga 定义
   */
  getDefinition(): SagaDefinition<SelfHealingSagaInput, SelfHealingSagaOutput> {
    return this.definition;
  }

  /**
   * 获取自愈会话
   */
  getSession(healingId: string): {
    id: string;
    service: string;
    environment?: string;
    namespace?: string;
    status: SelfHealingSagaStatus;
    tenantId?: string;
    alertId?: string;
    createdAt: Date;
    updatedAt: Date;
    detectionResult?: DetectOutput;
    diagnosisResult?: DiagnoseOutput;
    remediationResult?: RemediateOutput;
  } | null {
    return healingSessions.get(healingId) ?? null;
  }

  /**
   * 清理数据
   */
  cleanup(healingId: string): void {
    healingSessions.delete(healingId);
  }
}