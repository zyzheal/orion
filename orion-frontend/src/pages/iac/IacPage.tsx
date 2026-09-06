/**
 * IaC (Infrastructure as Code) Management Page (Phase 4 - Multi-Cloud)
 * Workspace management, plan/apply, resource state, module registry
 *
 * P2-9 Phase 49 重构: 802 → 22 行 (-97%)
 * 拆分: WorkspaceTab / ResourcesTab / ModulesTab / PlansTab 各自独立组件
 */
import React from 'react';
import { Tabs } from 'antd';
import { spacing } from '@/tokens';
import WorkspaceTab from './WorkspaceTab';
import PlansTab from './PlansTab';
import ResourcesTab from './ResourcesTab';
import ModulesTab from './ModulesTab';

const tabItems = [
  { key: 'workspaces', label: '工作区管理', children: <WorkspaceTab /> },
  { key: 'plans', label: '变更计划', children: <PlansTab /> },
  { key: 'resources', label: '资源列表', children: <ResourcesTab /> },
  { key: 'modules', label: '模块注册表', children: <ModulesTab /> },
];

const IacPage: React.FC = () => (
  <div style={{ padding: spacing.lg }}>
    <Tabs defaultActiveKey="workspaces" items={tabItems} size="large" />
  </div>
);

export default IacPage;
