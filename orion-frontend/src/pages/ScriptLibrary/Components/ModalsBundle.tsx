import { ScriptLibraryModals } from '../ScriptLibraryModals';
import type { useScriptLibraryState } from '../useScriptLibraryState';
import type { useScriptLibraryHandlers } from '../useScriptLibraryHandlers';

type State = ReturnType<typeof useScriptLibraryState>;
type Handlers = ReturnType<typeof useScriptLibraryHandlers>;

interface Props {
  s: State;
  h: Handlers;
  scriptForm: any;
  versionForm: any;
  paramForm: any;
  executeForm: any;
}

export function ScriptLibraryModalsBundle({ s, h, scriptForm, versionForm, paramForm, executeForm }: Props) {
  return (
    <ScriptLibraryModals
      scripts={s.scripts}
      scriptModalVisible={s.scriptModalVisible}
      setScriptModalVisible={s.setScriptModalVisible}
      scriptConfirmLoading={s.scriptConfirmLoading}
      setScriptConfirmLoading={s.setScriptConfirmLoading}
      editingScript={s.editingScript}
      setEditingScript={s.setEditingScript}
      scriptForm={scriptForm}
      handleSaveScript={h.handleSaveScript}
      drawerVisible={s.drawerVisible}
      setDrawerVisible={s.setDrawerVisible}
      selectedScript={s.selectedScript}
      setSelectedScript={s.setSelectedScript}
      versions={s.versions}
      setVersions={s.setVersions}
      versionsLoading={s.versionsLoading}
      setVersionsLoading={s.setVersionsLoading}
      versionModalVisible={s.versionModalVisible}
      setVersionModalVisible={s.setVersionModalVisible}
      versionForm={versionForm}
      handleSaveVersion={h.handleSaveVersion}
      handleCreateVersion={h.handleOpenVersion}
      handleRollback={s.handleRollback}
      parameters={s.parameters}
      setParametersList={s.setParametersList}
      paramsLoading={s.paramsLoading}
      setParamsLoading={s.setParamsLoading}
      paramModalVisible={s.paramModalVisible}
      setParamModalVisible={s.setParamModalVisible}
      paramForm={paramForm}
      editingParam={s.editingParam}
      setEditingParam={s.setEditingParam}
      handleSaveParam={h.handleSaveParam}
      handleAddParam={h.handleOpenCreateParam}
      handleEditParam={h.handleOpenEditParam}
      handleDeleteParam={s.handleDeleteParam}
      executeModalVisible={s.executeModalVisible}
      setExecuteModalVisible={s.setExecuteModalVisible}
      executingScript={s.executingScript}
      setExecutingScript={s.setExecutingScript}
      executeForm={executeForm}
      handleOpenExecute={s.handleOpenExecute}
      handleExecute={h.handleExecute}
      executions={s.executions}
      setExecutions={s.setExecutions}
      executionsLoading={s.executionsLoading}
      setExecutionsLoading={s.setExecutionsLoading}
      execDetailVisible={s.execDetailVisible}
      setExecDetailVisible={s.setExecDetailVisible}
      selectedExecution={s.selectedExecution}
      setSelectedExecution={s.setSelectedExecution}
      categoryOptions={s.categoryOptions}
      paramColumns={h.paramColumns}
    />
  );
}
