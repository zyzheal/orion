/**
 * QualityGate 数据模型 — 代码质量门禁
 *
 * 用于在流水线阶段执行后评估代码质量指标（覆盖率、复杂度、安全漏洞等），
 * 支持阻断（block）和警告（warn）两种严重级别。
 *
 * GAP-CN-04: 代码质量门禁
 */

import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// 质量指标类型
// ============================================================================

export type QualityMetric =
  | 'coverage'             // 代码覆盖率 (%)
  | 'complexity'           // 圈复杂度
  | 'duplication'          // 代码重复率 (%)
  | 'security_hotspots'    // 安全热点数量
  | 'bugs'                 // 潜在 Bug 数量
  | 'vulnerabilities';     // 漏洞数量

// ============================================================================
// 比较运算符
// ============================================================================

export type QualityOperator = '<' | '<=' | '>' | '>=' | '==';

// ============================================================================
// 规则严重级别
// ============================================================================

export type QualitySeverity = 'block' | 'warn';

// ============================================================================
// 质量门禁规则
// ============================================================================

export interface QualityGateRule {
  metric: QualityMetric;
  operator: QualityOperator;
  threshold: number;
  severity: QualitySeverity;  // block 阻断流水线, warn 仅记录警告
}

// ============================================================================
// 质量门禁定义
// ============================================================================

export interface QualityGate {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  rules: QualityGateRule[];
  // 外部质量服务配置（可选，如 SonarQube）
  externalProvider?: {
    type: 'sonarqube' | 'generic';
    url: string;
    apiKey?: string;
  };
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// 质量门禁评估结果
// ============================================================================

export interface QualityGateResult {
  id: string;
  gateId: string;
  gateName: string;
  runId: string;
  stageName: string;
  // 实际收集到的指标值
  metrics: Record<string, number>;
  // 整体是否通过
  passed: boolean;
  // 未通过的阻断规则详情
  blockedRules: Array<{
    rule: QualityGateRule;
    actualValue: number;
    reason: string;
  }>;
  // 未通过的警告规则详情
  warnedRules: Array<{
    rule: QualityGateRule;
    actualValue: number;
    reason: string;
  }>;
  evaluatedAt: Date;
}

// ============================================================================
// 创建/更新输入
// ============================================================================

export interface QualityGateCreateInput {
  tenantId: string;
  name: string;
  description?: string;
  rules: QualityGateRule[];
  externalProvider?: QualityGate['externalProvider'];
  enabled?: boolean;
}

export interface QualityGateUpdateInput {
  name?: string;
  description?: string;
  rules?: QualityGateRule[];
  externalProvider?: QualityGate['externalProvider'];
  enabled?: boolean;
}

// ============================================================================
// 评估输入
// ============================================================================

export interface QualityGateEvaluateInput {
  gateId: string;
  runId: string;
  stageName: string;
  metrics: Record<string, number>;
}

// ============================================================================
// 工厂函数
// ============================================================================

export function createQualityGate(input: QualityGateCreateInput): QualityGate {
  const now = new Date();
  return {
    id: uuidv4(),
    tenantId: input.tenantId,
    name: input.name,
    description: input.description,
    rules: input.rules,
    externalProvider: input.externalProvider,
    enabled: input.enabled ?? true,
    createdAt: now,
    updatedAt: now,
  };
}
