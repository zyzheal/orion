/**
 * DeploymentStrategy 数据模型
 *
 * GAP-CN-03: 渐进式发布策略（金丝雀/蓝绿/滚动发布）
 */

import { v4 as uuidv4 } from 'uuid';

// ==================== 发布策略类型 ====================

export type DeploymentStrategyType = 'canary' | 'bluegreen' | 'rolling';

// ==================== 金丝雀发布配置 ====================

export interface CanaryStep {
  weight: number;        // 流量权重百分比 (10, 50, 100)
  pause: string;         // 暂停时长 (e.g., '5m', '10m')
  verification?: string; // 健康检查端点 URL
}

export interface CanaryConfig {
  steps: CanaryStep[];
  // e.g., [{ weight: 10, pause: '5m' }, { weight: 50, pause: '10m' }, { weight: 100 }]
  autoPromote?: boolean;  // 是否自动推进到下一步
  rollbackOnFailure?: boolean; // 失败时自动回滚
}

// ==================== 蓝绿发布配置 ====================

export type BlueGreenSwitchMethod = 'instant' | 'gradual';

export interface BlueGreenConfig {
  activeSlot: 'blue' | 'green';
  switchMethod: BlueGreenSwitchMethod;
  gradualSteps?: number[]; // gradual 模式下的流量切换步骤 [10, 50, 100]
}

// ==================== 滚动发布配置 ====================

export interface RollingConfig {
  batchSize: number;      // 每批实例数
  maxUnavailable: number; // 最大不可用实例数
  pauseBetweenBatches?: string; // 批次间暂停时长
}

// ==================== 联合配置类型 ====================

export type DeploymentConfig = CanaryConfig | BlueGreenConfig | RollingConfig;

// ==================== 发布策略定义 ====================

export interface DeploymentStrategy {
  id: string;
  tenantId: string;
  name: string;
  type: DeploymentStrategyType;
  config: DeploymentConfig;
  description?: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DeploymentStrategyCreateInput {
  tenantId: string;
  name: string;
  type: DeploymentStrategyType;
  config: DeploymentConfig;
  description?: string;
  enabled?: boolean;
}

export interface DeploymentStrategyUpdateInput {
  name?: string;
  config?: DeploymentConfig;
  description?: string;
  enabled?: boolean;
}

export function createDeploymentStrategy(
  input: DeploymentStrategyCreateInput
): DeploymentStrategy {
  const now = new Date();
  return {
    id: uuidv4(),
    tenantId: input.tenantId,
    name: input.name,
    type: input.type,
    config: input.config,
    description: input.description,
    enabled: input.enabled ?? true,
    createdAt: now,
    updatedAt: now,
  };
}

// ==================== 发布步骤跟踪 ====================

export type DeploymentStepStatus =
  | 'pending'
  | 'running'
  | 'healthy'
  | 'unhealthy'
  | 'completed'
  | 'failed'
  | 'rolledback';

export interface HealthCheckResult {
  id: string;
  stepTrackerId: string;
  stepIndex: number;
  endpoint: string;
  statusCode: number | null;
  responseTime: number | null; // ms
  healthy: boolean;
  errorMessage: string | null;
  checkedAt: Date;
}

export interface DeploymentStepTracker {
  id: string;
  runId: string;
  strategyId: string;
  strategyType: DeploymentStrategyType;
  currentStep: number;       // 当前步骤索引 (0-based)
  totalSteps: number;
  currentWeight: number;     // 当前流量权重
  status: DeploymentStepStatus;
  healthChecks: HealthCheckResult[];
  startedAt: Date;
  completedAt?: Date;
  rollbackReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DeploymentStepTrackerCreateInput {
  runId: string;
  strategyId: string;
  strategyType: DeploymentStrategyType;
  totalSteps: number;
}

export function createDeploymentStepTracker(
  input: DeploymentStepTrackerCreateInput
): DeploymentStepTracker {
  const now = new Date();
  return {
    id: uuidv4(),
    runId: input.runId,
    strategyId: input.strategyId,
    strategyType: input.strategyType,
    currentStep: 0,
    totalSteps: input.totalSteps,
    currentWeight: 0,
    status: 'pending',
    healthChecks: [],
    startedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

export function createHealthCheckResult(
  stepTrackerId: string,
  stepIndex: number,
  endpoint: string,
  healthy: boolean,
  options?: {
    statusCode?: number;
    responseTime?: number;
    errorMessage?: string;
  }
): HealthCheckResult {
  return {
    id: uuidv4(),
    stepTrackerId,
    stepIndex,
    endpoint,
    statusCode: options?.statusCode ?? null,
    responseTime: options?.responseTime ?? null,
    healthy,
    errorMessage: options?.errorMessage ?? null,
    checkedAt: new Date(),
  };
}
