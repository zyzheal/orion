/**
 * Script Library Page - 拆分后主页面（P2-9 Phase 34）
 *
 * 拆分结构:
 * - useScriptLibraryState.tsx: 全状态 + 5 loader + 15 handler（form wrapper 委托）
 * - ScriptsTab.tsx: 脚本列表 Tab
 * - VersionsTab.tsx: 版本管理 Tab
 * - HistoryTab.tsx: 执行历史 Tab
 * - ScriptLibraryModals.tsx: 6 个 Modal/Drawer（Phase 9 已拆分）
 * - columns.tsx / config.tsx: 表格列配置 + 常量
 *
 * 主页面仅负责：5 个 Form 实例 + 4 个 validateFields wrapper + Tab 路由 + Modal 编排
 */
import { useMemo } from 'react';
import { Typography, Tabs, Form } from 'antd';
import { CodeOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import { useScriptLibraryState } from './useScriptLibraryState';
import { ScriptsTab } from './ScriptsTab';
import { VersionsTab } from './VersionsTab';
import { HistoryTab } from './HistoryTab';
import { ScriptLibraryModals } from './ScriptLibraryModals';
import { buildParamColumns } from './columns';

const { Title } = Typography;

export default function ScriptLibraryPage() {
  const s = useScriptLibraryState();
  const [scriptForm] = Form.useForm();
  const [versionForm] = Form.useForm();
  const [paramForm] = Form.useForm();
  const [executeForm] = Form.useForm();

  // ==================== Form Wrapper Handlers ====================
  // Modal.onOk 无参数调用；wrapper 负责 validateFields 后委托给 state hook

  const handleSaveScript = async () => {
    try {
      const values = await scriptForm.validateFields();
      await s.handleSaveScript(values);
      scriptForm.resetFields();
    } catch {}
  };

  const handleSaveVersion = async () => {
    try {
      const values = await versionForm.validateFields();
      await s.handleSaveVersion(values);
      versionForm.resetFields();
    } catch {}
  };

  const handleSaveParam = async () => {
    try {
      const values = await paramForm.validateFields();
      await s.handleSaveParam(values);
      paramForm.resetFields();
    } catch {}
  };

  const handleExecute = async () => {
    try {
      const values = await executeForm.validateFields();
      await s.handleExecute(values);
      executeForm.resetFields();
    } catch {}
  };

  // ==================== Form Value Sync Wrappers ====================
  // 编辑脚本/参数时把 record 注入对应表单

  const handleOpenEditScript = (record: Parameters<typeof s.handleEditScript>[0]) => {
    scriptForm.setFieldsValue({
      name: record.name,
      description: record.description,
      scriptType: record.scriptType,
      category: record.category,
      tags: record.tags,
    });
    s.handleEditScript(record);
  };

  const handleOpenEditParam = (param: Parameters<typeof s.handleEditParam>[0]) => {
    paramForm.setFieldsValue({
      paramKey: param.paramKey,
      paramType: param.paramType,
      required: param.required,
      defaultValue: param.defaultValue,
      description: param.description,
    });
    s.handleEditParam(param);
  };

  const handleOpenCreateParam = () => {
    paramForm.resetFields();
    paramForm.setFieldsValue({ paramType: 'string', required: false });
    s.handleAddParam();
  };

  const handleOpenVersion = () => {
    versionForm.resetFields();
    s.handleCreateVersion();
  };

  // ==================== Param Columns for Drawer ====================
  const paramColumns = useMemo(
    () => buildParamColumns({ handleEditParam: handleOpenEditParam, handleDeleteParam: s.handleDeleteParam }),
    [handleOpenEditParam, s.handleDeleteParam]
  );

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
