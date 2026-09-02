import React from 'react';
import { Card, Statistic, Typography } from 'antd';
import {
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  PauseCircleOutlined,
  StopOutlined,
} from '@ant-design/icons';

const { Text } = Typography;

export interface ProgressiveStage {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  trafficPercent: number;
  startedAt?: string;
  completedAt?: string;
}

export interface ProgressiveDeployment {
  id: string;
  appName: string;
  version: string;
  environment: string;
  currentStage: number;
  stages: ProgressiveStage[];
  status: 'pending' | 'running' | 'completed' | 'rolled_back' | 'failed';
  createdAt: string;
}

export interface DeployWindow {
  id: string;
  name: string;
  environment: string;
  startTime: string;
  endTime: string;
  recurring: boolean;
  recurringPattern?: 'daily' | 'weekly' | 'monthly';
  description?: string;
  status: 'active' | 'expired' | 'upcoming';
}

export const statusColorMap: Record<string, string> = {
  pending: 'default',
  deploying: 'blue',
  success: 'green',
  failed: 'red',
  rolled_back: 'gold',
  cancelled: 'default',
};

export const statusLabelMap: Record<string, string> = {
  pending: '等待中',
  deploying: '部署中',
  success: '成功',
  failed: '失败',
  rolled_back: '已回滚',
  cancelled: '已取消',
};

export const statusIconMap: Record<string, React.ReactNode> = {
  pending: <ClockCircleOutlined />,
  deploying: <SyncOutlined spin />,
  success: <CheckCircleOutlined />,
  failed: <CloseCircleOutlined />,
  rolled_back: <PauseCircleOutlined />,
  cancelled: <StopOutlined />,
};

export const strategyColorMap: Record<string, string> = {
  'blue-green': 'cyan',
  canary: 'orange',
  rolling: 'blue',
  recreate: 'purple',
};

export const strategyLabelMap: Record<string, string> = {
  'blue-green': '蓝绿部署',
  canary: '金丝雀',
  rolling: '滚动部署',
  recreate: '重建部署',
};

export const envColorMap: Record<string, string> = {
  dev: 'blue',
  staging: 'orange',
  prod: 'red',
};

export const envLabelMap: Record<string, string> = {
  dev: '开发',
  staging: '预发',
  prod: '生产',
};

export const windowStatusMap: Record<string, { color: string; label: string }> = {
  active: { color: 'green', label: '生效中' },
  expired: { color: 'default', label: '已过期' },
  upcoming: { color: 'blue', label: '即将开始' },
};

export const progressiveStatusMap: Record<string, { color: string; label: string }> = {
  pending: { color: 'default', label: '等待中' },
  running: { color: 'blue', label: '进行中' },
  completed: { color: 'green', label: '已完成' },
  rolled_back: { color: 'gold', label: '已回滚' },
  failed: { color: 'red', label: '失败' },
};

export const stageStatusMap: Record<string, { label: string; color: string }> = {
  completed: { label: '已完成', color: 'green' },
  running: { label: '进行中', color: 'blue' },
  failed: { label: '失败', color: 'red' },
  pending: { label: '等待中', color: 'default' },
};

export const StatCard: React.FC<{
  title: string;
  value: number;
  icon: React.ReactNode;
  color?: string;
}> = ({ title, value, icon, color }) => (
  <Card size="small">
    <Statistic
      title={<Text type="secondary">{title}</Text>}
      value={value}
      prefix={icon}
      valueStyle={{ color }}
    />
  </Card>
);
