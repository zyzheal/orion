/**
 * 运维管理工具 - 主页面
 *
 * 提供系统管理与运维工具的集成入口，包含：
 * - 定时调度管理
 * - 数据库工具
 * - MQ 监控
 * - Tagent 管理
 * - 批量操作
 * - 文件管理
 * - 系统配置
 * - 审计
 * - 日志
 *
 * 遵循 Design Token 体系与交互完整性规范。
 * 主页面仅负责组装：
 *   - useOpsToolsData: 数据状态 + 操作 handler
 *   - buildTabItems:   各 Tab 内容组件组合
 *   - OpsToolsModals:  所有弹窗/抽屉
 *   - SystemInfoPanel: 系统信息概览
 *   - columns.tsx:     表格列定义（含工厂函数）
 *   - config.tsx:      Tab 配置 + 常量
 */
import React, { useMemo } from 'react';
import { Tabs, Typography, Form } from 'antd';
import { ToolOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import { OpsToolsModals } from './OpsToolsModals';
import { SystemInfoPanel } from './SystemInfoPanel';
import { useOpsToolsData } from './useOpsToolsData';
import { buildTabItems } from './tabItems';
import {
  getCronColumns,
  getIndexColumns,
  getTagentColumns,
  getFileColumns,
  getThemeColumns,
  getModuleColumns,
} from './columns';

const { Title, Text } = Typography;

// ==================== 主页面 ====================

const OpsTools: React.FC = () => {
  const d = useOpsToolsData();

  const [cronForm] = Form.useForm();
  const [indexForm] = Form.useForm();
  const [batchForm] = Form.useForm();
  const [uploadForm] = Form.useForm();
  void uploadForm;
  const [distributeForm] = Form.useForm();
  void distributeForm;
  const [themeForm] = Form.useForm();
  void themeForm;

  // ==================== 列定义 (从 columns.tsx 工厂函数导入) ====================

  const cronColumns = useMemo(
    () =>
      getCronColumns({
        handleCronToggle: d.handleCronToggle,
        handleCronEdit: (job) => {
          cronForm.setFieldsValue({
            name: job.name,
            cronExpression: job.cronExpression,
            command: job.command,
            description: job.description,
          });
          d.handleCronEdit(job);
        },
        handleCronDelete: d.handleCronDelete,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [d.handleCronToggle, d.handleCronDelete],
  );

  const indexColumns = useMemo(
    () => getIndexColumns({ handleDeleteIndex: d.handleDeleteIndex }),
    [d.handleDeleteIndex],
  );

  const tagentColumns = useMemo(
    () => getTagentColumns({ handleTagentUpgrade: d.handleTagentUpgrade }),
    [d.handleTagentUpgrade],
  );

  const fileColumns = useMemo(
    () =>
      getFileColumns({
        handleDistributeOpen: (fileId: string) => {
          d.setDistributingFile(fileId);
          d.setDistributeModalOpen(true);
        },
        handleDeleteFile: d.handleDeleteFile,
      }),
    [d.handleDeleteFile, d.setDistributingFile, d.setDistributeModalOpen],
  );

  const themeColumns = useMemo(
    () =>
      getThemeColumns(
        {
          handleThemeToggle: d.handleThemeToggle,
          handleDeleteTheme: d.handleDeleteTheme,
        },
        d.loading,
      ),
    [d.handleThemeToggle, d.handleDeleteTheme, d.loading],
  );

  const moduleColumns = useMemo(
    () => getModuleColumns({ handleModuleToggle: d.handleModuleToggle }, d.loading),
    [d.handleModuleToggle, d.loading],
  );

  // ==================== Tab items ====================

  const tabItems = useMemo(
    () =>
      buildTabItems({
        cronColumns,
        cronJobs: d.cronJobs,
        cronLoading: d.cronLoading,
        onCronRefresh: d.loadCronJobs,
        onCronCreate: () => {
          d.setCronEditingJob(null);
          cronForm.resetFields();
          d.setCronModalOpen(true);
        },

        dumps: d.dumps,
        fragments: d.fragments,
        indexes: d.indexes,
        dumpRunning: d.dumpRunning,
        indexColumns,
        onSqlDump: d.handleSqlDump,
        onCreateIndex: () => d.setIndexModalOpen(true),
        onMqRefresh: d.loadDBTools,

        tagentColumns,
        tagentClients: d.tagentClients,
        tagentStats: d.tagentStats,
        tagentLoading: d.tagentLoading,
        onTagentRefresh: d.loadTagent,

        batchForm,
        batchOps: d.batchOps,
        batchLoading: d.batchLoading,
        batchExecLoading: d.batchExecLoading,
        onBatchExecute: d.handleBatchExecute,
        onBatchRefresh: d.loadBatchOps,

        fileColumns,
        files: d.files,
        fileLoading: d.fileLoading,
        onFileRefresh: d.loadFiles,
        onFileUpload: () => {
          uploadForm.resetFields();
          d.setUploadModalOpen(true);
        },

        themeColumns,
        themes: d.themes,
        themeLoading: d.themeLoading,
        onNewTheme: () => {
          themeForm.resetFields();
          d.setThemeModalOpen(true);
        },
        licenses: d.licenses,
        moduleColumns,
        modules: d.modules,
        moduleLoading: d.moduleLoading,
        threadPools: d.threadPools,

        auditEvents: d.auditEvents,
        auditPage: d.auditPage,
        auditTotal: d.auditTotal,
        onAuditPageChange: d.loadAudit,
        onAuditRefresh: () => d.loadAudit(d.auditPage),

        logs: d.logs,
        logTotal: d.logTotal,
        logLevel: d.logLevel,
        onLogLevelChange: d.setLogLevel,
        logService: d.logService,
        onLogServiceChange: d.setLogService,
        onLogRefresh: d.loadLogs,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      cronColumns,
      indexColumns,
      tagentColumns,
      fileColumns,
      themeColumns,
      moduleColumns,
      d,
    ],
  );

  // ==================== 渲染 ====================

  return (
    <div style={{ padding: 0 }}>
      {/* 页面标题 */}
      <div style={{ marginBottom: spacing.lg }}>
        <Title level={2} style={{ marginBottom: spacing.sm }}>
          <ToolOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
          运维管理工具
        </Title>
        <Text type="secondary">
          系统定时任务、数据库工具、Tagent管理、批量操作、文件管理与系统配置
        </Text>
      </div>

      {/* 系统信息概览 */}
      {d.systemInfo && <SystemInfoPanel systemInfo={d.systemInfo} />}

      {/* Tabs */}
      <Tabs
        activeKey={d.activeTab}
        onChange={d.setActiveTab}
        items={tabItems}
        size="large"
        tabBarStyle={{ marginBottom: 0 }}
      />

      {/* ==================== 弹窗 ==================== */}
      <OpsToolsModals
        loading={d.loading}
        setLoading={d.setLoading}
        systemInfo={d.systemInfo}
        setSystemInfo={d.setSystemInfo}
        cronJobs={d.cronJobs}
        setCronJobs={d.setCronJobs}
        cronModalOpen={d.cronModalOpen}
        setCronModalOpen={d.setCronModalOpen}
        cronEditingJob={d.cronEditingJob}
        setCronEditingJob={d.setCronEditingJob}
        cronForm={cronForm}
        handleCronSave={d.handleCronSave}
        handleCronToggle={d.handleCronToggle}
        handleCronDelete={d.handleCronDelete}
        handleCronEdit={d.handleCronEdit}
        dumps={d.dumps}
        setDumps={d.setDumps}
        dumpRunning={d.dumpRunning}
        setDumpRunning={d.setDumpRunning}
        fragments={d.fragments}
        setFragments={d.setFragments}
        indexes={d.indexes}
        setIndexes={d.setIndexes}
        indexModalOpen={d.indexModalOpen}
        setIndexModalOpen={d.setIndexModalOpen}
        indexForm={indexForm}
        handleSqlDump={d.handleSqlDump}
        handleCreateIndex={d.handleCreateIndex}
        handleDeleteIndex={d.handleDeleteIndex}
        tagentClients={d.tagentClients}
        setTagentClients={d.setTagentClients}
        tagentStats={d.tagentStats}
        setTagentStats={d.setTagentStats}
        tagentLoading={d.tagentLoading}
        setTagentLoading={d.setTagentLoading}
        handleTagentUpgrade={d.handleTagentUpgrade}
        batchOps={d.batchOps}
        setBatchOps={d.setBatchOps}
        batchLoading={d.batchLoading}
        setBatchLoading={d.setBatchLoading}
        batchForm={batchForm}
        batchExecLoading={d.batchExecLoading}
        setBatchExecLoading={d.setBatchExecLoading}
        handleBatchExecute={d.handleBatchExecute}
        files={d.files}
        setFiles={d.setFiles}
        fileLoading={d.fileLoading}
        setFileLoading={d.setFileLoading}
        uploadForm={uploadForm}
        uploadModalOpen={d.uploadModalOpen}
        setUploadModalOpen={d.setUploadModalOpen}
        distributeModalOpen={d.distributeModalOpen}
        setDistributeModalOpen={d.setDistributeModalOpen}
        distributingFile={d.distributingFile}
        setDistributingFile={d.setDistributingFile}
        distributeForm={distributeForm}
        handleUpload={d.handleUpload}
        handleDeleteFile={d.handleDeleteFile}
        handleDistribute={d.handleDistribute}
        themes={d.themes}
        setThemes={d.setThemes}
        themeForm={themeForm}
        themeModalOpen={d.themeModalOpen}
        setThemeModalOpen={d.setThemeModalOpen}
        handleThemeSave={d.handleThemeSave}
        handleThemeToggle={d.handleThemeToggle}
        handleDeleteTheme={d.handleDeleteTheme}
        handleModuleToggle={d.handleModuleToggle}
        activeTab={d.activeTab}
        setActiveTab={d.setActiveTab}
        dbLoading={d.dbLoading}
        setDbLoading={d.setDbLoading}
      />
    </div>
  );
};

export default OpsTools;
