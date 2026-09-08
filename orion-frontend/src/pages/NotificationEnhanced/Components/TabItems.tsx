import React from 'react';
import { BellOutlined, LinkOutlined, UserOutlined, ClockCircleOutlined, FileTextOutlined, TableOutlined } from '@ant-design/icons';

// Sub-components (lazy-loaded tabs)
const StrategyTab = React.lazy(() => import('../StrategyTab'));
const IntegrationTab = React.lazy(() => import('../IntegrationTab'));
const SubscriptionTab = React.lazy(() => import('../SubscriptionTab'));
const HistoryTab = React.lazy(() => import('../HistoryTab'));
const NoticeTab = React.lazy(() => import('../NoticeTab'));
const MatrixTab = React.lazy(() => import('../MatrixTab'));

export interface TabDef {
  key: string;
  label: React.ReactNode;
  component: React.ReactNode;
}

export const TABS: TabDef[] = [
  {
    key: 'strategies',
    label: (
      <span>
        <BellOutlined /> 通知策略
      </span>
    ),
    component: <StrategyTab key="strategies" />,
  },
  {
    key: 'integrations',
    label: (
      <span>
        <LinkOutlined /> 集成管理
      </span>
    ),
    component: <IntegrationTab key="integrations" />,
  },
  {
    key: 'subscriptions',
    label: (
      <span>
        <UserOutlined /> 消息订阅
      </span>
    ),
    component: <SubscriptionTab key="subscriptions" />,
  },
  {
    key: 'history',
    label: (
      <span>
        <ClockCircleOutlined /> 通知历史
      </span>
    ),
    component: <HistoryTab key="history" />,
  },
  {
    key: 'notices',
    label: (
      <span>
        <FileTextOutlined /> 公告管理
      </span>
    ),
    component: <NoticeTab key="notices" />,
  },
  {
    key: 'matrices',
    label: (
      <span>
        <TableOutlined /> 数据矩阵
      </span>
    ),
    component: <MatrixTab key="matrices" />,
  },
];
