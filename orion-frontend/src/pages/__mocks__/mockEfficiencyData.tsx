/**
 * Mock data for Efficiency Dashboard (TASK-402)
 */
import React from 'react';
import {
  ThunderboltOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';

export interface DoraMetric {
  key: string;
  name: string;
  icon: React.ReactNode;
  currentValue: string | number;
  targetValue: string | number;
  trend: 'up' | 'down' | 'stable';
  level: 'Elite' | 'High' | 'Medium' | 'Low';
}

export interface TeamComparison {
  team: string;
  deploymentFrequency: number;
  leadTime: number;
  mttr: number;
  failureRate: number;
  score: number;
}

export interface EfficiencyData {
  metrics: {
    deploymentFrequency: { value: number; trend: 'up' | 'down' };
    leadTime: { value: number; trend: 'up' | 'down' };
    mttr: { value: number; trend: 'up' | 'down' };
    failureRate: { value: number; trend: 'up' | 'down' };
  };
  doraMetrics: DoraMetric[];
  teamComparison: TeamComparison[];
  suggestions: string[];
}

// 模拟 DORA 指标数据
export const mockEfficiencyData: EfficiencyData = {
  metrics: {
    deploymentFrequency: { value: 175, trend: 'up' },
    leadTime: { value: 22, trend: 'down' },
    mttr: { value: 45, trend: 'down' },
    failureRate: { value: 6.4, trend: 'down' },
  },
  doraMetrics: [
    {
      key: 'deployment-frequency',
      name: '发布频率 (Deployment Frequency)',
      icon: <ThunderboltOutlined />,
      currentValue: '175 次/周',
      targetValue: '200 次/周',
      trend: 'up',
      level: 'Elite',
    },
    {
      key: 'lead-time',
      name: '变更前置时间 (Lead Time for Changes)',
      icon: <ClockCircleOutlined />,
      currentValue: '22 小时',
      targetValue: '< 24 小时',
      trend: 'down',
      level: 'High',
    },
    {
      key: 'mttr',
      name: '服务恢复时间 (MTTR)',
      icon: <CheckCircleOutlined />,
      currentValue: '45 分钟',
      targetValue: '< 60 分钟',
      trend: 'down',
      level: 'Elite',
    },
    {
      key: 'failure-rate',
      name: '变更失败率 (Change Failure Rate)',
      icon: <ThunderboltOutlined />,
      currentValue: '6.4%',
      targetValue: '< 5%',
      trend: 'stable',
      level: 'High',
    },
  ],
  teamComparison: [
    {
      team: '平台团队',
      deploymentFrequency: 210,
      leadTime: 18,
      mttr: 35,
      failureRate: 4.2,
      score: 92,
    },
    {
      team: '后端团队',
      deploymentFrequency: 180,
      leadTime: 24,
      mttr: 45,
      failureRate: 5.8,
      score: 85,
    },
    {
      team: '前端团队',
      deploymentFrequency: 195,
      leadTime: 20,
      mttr: 40,
      failureRate: 5.1,
      score: 88,
    },
    {
      team: '数据团队',
      deploymentFrequency: 120,
      leadTime: 36,
      mttr: 60,
      failureRate: 8.5,
      score: 72,
    },
    {
      team: '测试团队',
      deploymentFrequency: 150,
      leadTime: 28,
      mttr: 50,
      failureRate: 6.2,
      score: 78,
    },
  ],
  suggestions: [
    '建议数据团队提升自动化测试覆盖率，当前测试覆盖率仅为 65%，低于团队平均水平 (82%)',
    '建议建立更完善的监控告警机制，降低服务恢复时间 (MTTR)',
    '建议推行小批量频繁发布，减少单次变更的风险和复杂度',
    '建议建立变更评审机制，降低变更失败率',
  ],
};
