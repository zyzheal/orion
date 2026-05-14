/**
 * 安全服务类型定义
 *
 * Re-exports from services/types.ts for consistency with import paths used by services.
 * Also adds database entity types.
 */

// Re-export all security types from services/types.ts
export {
  RiskLevel,
  RiskFactorCategory,
  RiskTargetType,
  type RiskFactor,
  type DeploymentRisk,
  type RiskAssessment,
  type RiskRecommendation,
  type HealthCheckStatus,
  type HealthCheck,
  type HealthCheckResult,
  type RiskReport,
  type RiskAssessmentEventData,
  type PipelineCompletedForRiskData,
  type CodePRMergedData,
  type RiskAssessmentServiceConfig,
  type HealthCheckConfig,
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
