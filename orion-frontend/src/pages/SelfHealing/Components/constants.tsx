import React from 'react';
import {
  MedicineBoxOutlined,
  HistoryOutlined,
  ExperimentOutlined,
  CheckSquareOutlined,
  DashboardOutlined,
} from '@ant-design/icons';
import { spacing } from '@/tokens';

// 统一菜单项配置
export const menuItems = [
  {
    key: '/observability/self-healing/incidents',
    icon: <MedicineBoxOutlined />,
    label: 'Incidents',
  },
  {
    key: '/observability/self-healing/history',
    icon: <HistoryOutlined />,
    label: 'Healing History',
  },
  {
    key: '/observability/self-healing/strategies',
    icon: <ExperimentOutlined />,
    label: 'Strategies',
  },
  {
    key: '/observability/self-healing/approvals',
    icon: <CheckSquareOutlined />,
    label: 'Approval Queue',
  },
  {
    key: '/observability/self-healing/effectiveness',
    icon: <DashboardOutlined />,
    label: 'Effectiveness',
  },
];

export const pageTitleMap: Record<string, { icon: React.ReactNode; title: string; subtitle: string }> = {
  '/observability/self-healing/incidents': {
    icon: <MedicineBoxOutlined />,
    title: 'Incidents',
    subtitle: '当前待处理的自我修复事件',
  },
  '/observability/self-healing/history': {
    icon: <HistoryOutlined />,
    title: 'Healing History',
    subtitle: '查看历史修复记录',
  },
  '/observability/self-healing/strategies': {
    icon: <ExperimentOutlined />,
    title: 'Strategies',
    subtitle: '管理修复策略配置',
  },
  '/observability/self-healing/approvals': {
    icon: <CheckSquareOutlined />,
    title: 'Approval Queue',
    subtitle: '待审核的修复操作',
  },
  '/observability/self-healing/effectiveness': {
    icon: <DashboardOutlined />,
    title: 'Effectiveness',
    subtitle: '自我修复效果分析',
  },
};

// 统一的 Layout 配置
export const LAYOUT_CONFIG = {
  siderWidth: 220,
  titleLevel: 5 as const,
  headerPadding: `${spacing[4]}px ${spacing[3]}px ${spacing[2]}px`,
};
