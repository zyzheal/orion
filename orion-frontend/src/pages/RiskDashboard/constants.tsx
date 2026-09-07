/**
 * RiskDashboard constants
 * 抽取自 index.tsx (P2-9 Phase 123)
 */
import React from 'react';
import {
  ExclamationCircleOutlined,
  WarningOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';

export const riskLevelColor: Record<string, string> = {
  low: 'green',
  medium: 'blue',
  high: 'orange',
  critical: 'red',
};

export const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const severityLabels = ['Low', 'Medium', 'High', 'Critical'];

export const riskLevelToSeverity: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export const eventTypeIconMap: Record<string, React.ReactNode> = {
  risk_detected: <ExclamationCircleOutlined />,
  risk_escalated: <WarningOutlined />,
  risk_mitigated: <CheckCircleOutlined />,
};
