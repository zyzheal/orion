/**
 * Module Manager Page (Workflow 5: Feature Domain Management)
 *
 * Features:
 * - Module list table with enable/disable toggle controls
 * - Dependency visualization (tree-based graph)
 * - Startup order display (topological sort)
 * - Validation report (missing deps, circular deps)
 * - Filter by level (core/domain/service/feature) and status
 *
 * Backend API:
 * - GET /api/v1/system/modules - list all modules
 * - PUT /api/v1/system/modules/:id/toggle - enable/disable module
 * - GET /api/v1/system/modules/validate - dependency validation
 * - GET /api/v1/system/modules/startup-order - startup order
 *
 * P2-9 Phase 117 拆分:
 * - constants.ts                 5 常量 (LEVEL_OPTIONS/STATUS_OPTIONS/stateColor/stateLabel/levelColor/levelLabel)
 * - useModuleManagerState.tsx    10 useState + 3 loaders + 1 handler + 2 useMemo + ModuleManagerState
 * - moduleColumns.tsx            8 列表 (含 Modal.info 详情)
 * - Components/ModuleManagerHeader.tsx       (Title + 3 Button)
 * - Components/ModuleManagerStatsRow.tsx     (4 MetricCard)
 * - Components/ModulesListTab.tsx            (SearchFilterBar + Table)
 * - Components/DependencyTab.tsx             (DependencyGraph 正/反向)
 * - Components/ValidationTab.tsx             (ValidationReport)
 */
import React, { useMemo } from 'react';
import { Tabs } from 'antd';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useModuleManagerState } from './useModuleManagerState';
import { ModuleManagerHeader } from './Components/ModuleManagerHeader';
import { ModuleManagerStatsRow } from './Components/ModuleManagerStatsRow';
import { ModulesListTab } from './Components/ModulesListTab';
import { DependencyTab } from './Components/DependencyTab';
import { ValidationTab } from './Components/ValidationTab';

dayjs.extend(relativeTime);

const ModuleManagerPage: React.FC = () => {
  const state = useModuleManagerState();
  const { activeTab, setActiveTab } = state;

  const tabItems = useMemo(
    () => [
      { key: 'list', label: '模块列表', children: <ModulesListTab state={state} /> },
      { key: 'dependency', label: '依赖关系图', children: <DependencyTab state={state} /> },
      { key: 'dependency-reverse', label: '反向依赖', children: <DependencyTab state={state} showReverseDeps /> },
      { key: 'validation', label: '校验报告', children: <ValidationTab state={state} /> },
    ],
    [state]
  );

  return (
    <div style={{ padding: 0 }}>
      <ModuleManagerHeader state={state} />
      <ModuleManagerStatsRow state={state} />

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
      />
    </div>
  );
};

export default ModuleManagerPage;
