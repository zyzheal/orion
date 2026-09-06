/**
 * AISecurity shared config: types, label/color maps, mapper helpers
 */
import React from 'react';
import {
  FilterOutlined,
  SecurityScanOutlined,
  SafetyOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import type {
  SecurityPolicy as APISecurityPolicy,
  PolicyEvaluation as APIPolicyEvaluation,
} from '@/api/ai-security';

export type PolicyType = 'input_validation' | 'output_filtering' | 'pii_detection' | 'rate_limiting';
export type PolicyStatus = 'active' | 'inactive' | 'draft' | 'violated';
export type PolicySeverity = 'low' | 'medium' | 'high' | 'critical';

export interface UISecurityPolicy {
  id: string;
  name: string;
  description: string;
  type: PolicyType;
  status: PolicyStatus;
  severity: PolicySeverity;
  violations: number;
  lastUpdated: string;
  createdBy: string;
  enabled: boolean;
  rules: string[];
}

export interface SecurityStats {
  policiesActive: number;
  requestsBlocked: number;
  sensitiveDataDetected: number;
  complianceScore: number;
  totalViolations: number;
  avgResponseTime: number;
}

export interface PolicyEvaluation {
  policyId: string;
  policyName: string;
  result: 'pass' | 'fail' | 'warning';
  timestamp: string;
  details: string;
}

export function mapApiPolicyToUI(p: APISecurityPolicy): UISecurityPolicy {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    type: p.type as PolicyType,
    status: p.enabled ? 'active' : 'inactive',
    severity: p.severity,
    violations: p.matchCount,
    lastUpdated: p.updatedAt,
    createdBy: '',
    enabled: p.enabled,
    rules: [p.rule],
  };
}

export function mapApiEvalToUI(e: APIPolicyEvaluation): PolicyEvaluation {
  return {
    policyId: e.policyId,
    policyName: e.policyName,
    result: e.status,
    timestamp: e.evaluatedAt,
    details: e.message,
  };
}

export const typeLabelMap: Record<PolicyType, string> = {
  input_validation: '输入验证',
  output_filtering: '输出过滤',
  pii_detection: 'PII 检测',
  rate_limiting: '速率限制',
};

export const typeIconMap: Record<PolicyType, React.ReactNode> = {
  input_validation: <FilterOutlined />,
  output_filtering: <SecurityScanOutlined />,
  pii_detection: <SafetyOutlined />,
  rate_limiting: <ThunderboltOutlined />,
};

export const statusColorMap: Record<PolicyStatus, string> = {
  active: 'success',
  inactive: 'default',
  draft: 'processing',
  violated: 'error',
};

export const statusLabelMap: Record<PolicyStatus, string> = {
  active: '活跃',
  inactive: '未激活',
  draft: '草稿',
  violated: '已违规',
};

export const severityColorMap: Record<PolicySeverity, string> = {
  low: 'blue',
  medium: 'orange',
  high: 'volcano',
  critical: 'red',
};

export const severityLabelMap: Record<PolicySeverity, string> = {
  low: '低',
  medium: '中',
  high: '高',
  critical: '严重',
};

export const policyTypeOptions = (Object.keys(typeLabelMap) as PolicyType[]).map((v) => ({
  label: typeLabelMap[v],
  value: v,
}));

export const severityOptions = (Object.keys(severityLabelMap) as PolicySeverity[]).map((v) => ({
  label: severityLabelMap[v],
  value: v,
}));
