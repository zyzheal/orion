/**
 * Login constants
 * 抽取自 index.tsx (P2-9 Phase 179)
 */
import {
  RocketOutlined,
  SafetyOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';

export const featureIcons = [RocketOutlined, SafetyOutlined, ThunderboltOutlined, CheckCircleOutlined] as const;

export const featureKeys = [
  ['features.smartPipeline', 'features.smartPipelineDesc'],
  ['features.securityGovernance', 'features.securityGovernanceDesc'],
  ['features.efficiencyInsight', 'features.efficiencyInsightDesc'],
  ['features.selfHealing', 'features.selfHealingDesc'],
] as const;
