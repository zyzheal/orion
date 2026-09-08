import type { TabsProps } from 'antd';
import { ScriptsTab } from '../ScriptsTab';
import { VersionsTab } from '../VersionsTab';
import { HistoryTab } from '../HistoryTab';
import type { useScriptLibraryState } from '../useScriptLibraryState';
import type { useScriptLibraryHandlers } from '../useScriptLibraryHandlers';

type State = ReturnType<typeof useScriptLibraryState>;
type Handlers = ReturnType<typeof useScriptLibraryHandlers>;

interface Props {
  s: State;
  h: Handlers;
}

export function buildScriptLibraryTabItems({ s, h }: Props): TabsProps['items'] {
  return [
    {
      key: 'scripts',
      label: '脚本列表',
      children: (
        <ScriptsTab
          scripts={s.scripts}
          scriptsLoading={s.scriptsLoading}
          filterCategory={s.filterCategory}
          setFilterCategory={s.setFilterCategory}
          filterType={s.filterType}
          setFilterType={s.setFilterType}
          categoryOptions={s.categoryOptions}
          fetchScripts={s.fetchScripts}
          handleCreateScript={s.handleCreateScript}
          handleViewDetail={s.handleViewDetail}
          handleOpenExecute={s.handleOpenExecute}
          handleEditScript={h.handleOpenEditScript}
          handleDeleteScript={s.handleDeleteScript}
        />
      ),
    },
    {
      key: 'versions',
      label: '版本管理',
      children: (
        <VersionsTab
          scripts={s.scripts}
          selectedScript={s.selectedScript}
          setSelectedScript={s.setSelectedScript}
          versions={s.versions}
          versionsLoading={s.versionsLoading}
          fetchVersions={s.fetchVersions}
          handleCreateVersion={h.handleOpenVersion}
          handleRollback={s.handleRollback}
        />
      ),
    },
    {
      key: 'history',
      label: '执行历史',
      children: (
        <HistoryTab
          scripts={s.scripts}
          executions={s.executions}
          executionsLoading={s.executionsLoading}
          historyScriptId={s.historyScriptId}
          setHistoryScriptId={s.setHistoryScriptId}
          fetchExecutions={s.fetchExecutions}
          setSelectedExecution={s.setSelectedExecution}
          setExecDetailVisible={s.setExecDetailVisible}
        />
      ),
    },
  ];
}
