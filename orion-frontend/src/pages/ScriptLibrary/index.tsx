/**
 * Script Library Page - 拆分后主页面（P2-9 Phase 34 + Phase 234）
 *
 * 拆分结构:
 * - useScriptLibraryState.tsx: 全状态 + 5 loader + 15 handler（form wrapper 委托）
 * - useScriptLibraryHandlers.ts: 4 个 validateFields wrapper + 4 个 open modal wrapper + paramColumns
 * - ScriptsTab.tsx: 脚本列表 Tab
 * - VersionsTab.tsx: 版本管理 Tab
 * - HistoryTab.tsx: 执行历史 Tab
 * - ScriptLibraryModals.tsx: 6 个 Modal/Drawer
 * - columns.tsx / config.tsx: 表格列配置 + 常量
 * - index.tsx: 组合层（仅 Form 实例 + Tab 路由 + Modal 编排）
 */
import { Typography, Tabs, Form } from 'antd';
import { CodeOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import { useScriptLibraryState } from './useScriptLibraryState';
import { useScriptLibraryHandlers } from './useScriptLibraryHandlers';
import { ScriptsTab } from './ScriptsTab';
import { VersionsTab } from './VersionsTab';
import { HistoryTab } from './HistoryTab';
import { ScriptLibraryModals } from './ScriptLibraryModals';

const { Title } = Typography;

export default function ScriptLibraryPage() {
  const s = useScriptLibraryState();
  const [scriptForm] = Form.useForm();
  const [versionForm] = Form.useForm();
  const [paramForm] = Form.useForm();
  const [executeForm] = Form.useForm();

  const {
    handleSaveScript,
    handleSaveVersion,
    handleSaveParam,
    handleExecute,
    handleOpenEditScript,
    handleOpenEditParam,
    handleOpenCreateParam,
    handleOpenVersion,
    paramColumns,
  } = useScriptLibraryHandlers({
    state: s,
    scriptForm,
    versionForm,
    paramForm,
    executeForm,
  });

  return (
    <div style={{ padding: spacing.lg }}>
      <Title level={2} style={{ marginBottom: 16 }}>
        <CodeOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        脚本库
      </Title>

      <Tabs activeKey={s.activeTab} onChange={s.setActiveTab} items={[
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
              handleEditScript={handleOpenEditScript}
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
              handleCreateVersion={handleOpenVersion}
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
      ]} />

      <ScriptLibraryModals
        scripts={s.scripts}
        scriptModalVisible={s.scriptModalVisible}
        setScriptModalVisible={s.setScriptModalVisible}
        scriptConfirmLoading={s.scriptConfirmLoading}
        setScriptConfirmLoading={s.setScriptConfirmLoading}
        editingScript={s.editingScript}
        setEditingScript={s.setEditingScript}
        scriptForm={scriptForm}
        handleSaveScript={handleSaveScript}
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
        handleSaveVersion={handleSaveVersion}
        handleCreateVersion={handleOpenVersion}
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
        handleSaveParam={handleSaveParam}
        handleAddParam={handleOpenCreateParam}
        handleEditParam={handleOpenEditParam}
        handleDeleteParam={s.handleDeleteParam}
        executeModalVisible={s.executeModalVisible}
        setExecuteModalVisible={s.setExecuteModalVisible}
        executingScript={s.executingScript}
        setExecutingScript={s.setExecutingScript}
        executeForm={executeForm}
        handleOpenExecute={s.handleOpenExecute}
        handleExecute={handleExecute}
        executions={s.executions}
        setExecutions={s.setExecutions}
        executionsLoading={s.executionsLoading}
        setExecutionsLoading={s.setExecutionsLoading}
        execDetailVisible={s.execDetailVisible}
        setExecDetailVisible={s.setExecDetailVisible}
        selectedExecution={s.selectedExecution}
        setSelectedExecution={s.setSelectedExecution}
        categoryOptions={s.categoryOptions}
        paramColumns={paramColumns}
      />
    </div>
  );
}
