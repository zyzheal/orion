/**
 * 安全服务类型定义
 *
 * Re-exports from services/types.ts for consistency with import paths used by services.
 * Also adds database entity types.
 */

// Re-export all security types from services/types.ts
export type {
  RiskLevel,
  RiskFactorCategory,
  RiskTargetType,
  RiskFactor,
  DeploymentRisk,
  RiskAssessment,
  RiskRecommendation,
  HealthCheckStatus,
  HealthCheck,
  HealthCheckResult,
  RiskReport,
  RiskAssessmentEventData,
  PipelineCompletedForRiskData,
  CodePRMergedData,
  RiskAssessmentServiceConfig,
  HealthCheckConfig,
} from '../services/types';
export {
  DEFAULT_HEALTH_CHECK_CONFIG,
} from '../services/types';

/**
 * RiskAssessment database entity (maps to risk_assessments table)
 */
export interface RiskAssessmentEntity {
  id: string;
  tenantId: string;
  name: string;
  type: string;
  targetType: string;
  targetId: string;
  score?: number;
  riskLevel?: string;
  findings?: Record<string, unknown>[];
  status: string;
  createdAt: Date;
}
