/**
 * Risk Module - Barrel export
 *
 * Risk management: identification, assessment, mitigation, and dashboard.
 */

// Types
export {
  RiskLevel,
  RiskStatus,
  RiskCategory,
  MitigationActionType,
  MitigationStatus,
  RuleOperator,
  RISK_LEVEL_LABELS,
  RISK_LEVEL_COLORS,
  RISK_LEVEL_SCORE_RANGES,
  RISK_CATEGORY_LABELS,
  RISK_STATUS_LABELS,
  MITIGATION_ACTION_LABELS,
  MITIGATION_STATUS_LABELS,
  RULE_OPERATOR_LABELS,
  RiskEntity,
  RiskCreateInput,
  RiskUpdateInput,
  RiskFinding,
  RiskFindingInput,
  RiskMitigation,
  MitigationAction,
  CreateMitigationInput,
  RiskRule,
  RiskRuleCondition,
  RiskDashboard,
  RiskTrendPoint,
  RiskEngineContext,
  RiskIdentificationResult,
  RiskAssessInput,
  RiskAssessOutput,
  RiskRow,
} from './types';

// Service
export { RiskService } from './RiskService';

// Repository
export { RiskRepository } from './RiskRepository';
export type {
  RiskEntity as RiskRepositoryEntity,
  RiskCreateInput as RiskRepositoryCreateInput,
  RiskUpdateInput as RiskRepositoryUpdateInput,
} from './RiskRepository';
