/**
 * Report Designer Page
 *
 * 报表设计器主页面 (P2-9 Phase 51 重构)
 * - ReportsTab: 报表列表 + 分类筛选
 * - DataSourcesTab: 数据源管理 (sql/api/promql)
 * - SchedulesTab: 定时调度 (cron, export, recipients)
 * - ExecutionsTab: 执行历史
 * - ReportDesignerModals: 报表/数据源/调度 Modal + 预览 Drawer
 *
 * 全部 state/loader/handler 已抽入 useReportDesignerState.ts
 * 全部列定义已抽入 ReportDesignerColumns.tsx
 * 4 个 Tab 已抽入 *Tab.tsx
 * 主页面仅保留 layout + 7 Form.useForm + 表单 wrapper
 */
import { useEffect } from 'react';
import { Typography, Tabs, Form } from 'antd';
import {
  FileTextOutlined,
  DatabaseOutlined,
  ClockCircleOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import { useReportDesignerState } from './useReportDesignerState';
import { categoryLabel, categoryColor } from './ReportDesignerColumns';
import { ReportsTab } from './ReportsTab';
import { DataSourcesTab } from './DataSourcesTab';
import { SchedulesTab } from './SchedulesTab';
import { ExecutionsTab } from './ExecutionsTab';
import { ReportDesignerModals } from './ReportDesignerModals';

const { Title } = Typography;

const categoryOptions = [
  { value: 'operations', label: '运维报表' },
  { value: 'performance', label: '性能报表' },
  { value: 'business', label: '业务报表' },
  { value: 'security', label: '安全报表' },
  { value: 'custom', label: '自定义' },
];

export default function ReportDesignerPage() {
  const state = useReportDesignerState();
  const {
    reports,
    datasources,
    schedules,
    executions,
    loading,
    activeTab,
    setActiveTab,
    categoryFilter,
    setCategoryFilter,
    reportModalVisible,
    setReportModalVisible,
    reportConfirmLoading,
    editingReport,
    datasourceModalVisible,
    setDatasourceModalVisible,
    editingDatasource,
    scheduleModalVisible,
    setScheduleModalVisible,
    editingSchedule,
    previewDrawerVisible,
    setPreviewDrawerVisible,
    previewData,
    setPreviewData,
    selectedReportForPreview,
    setSelectedReportForPreview,
    fetchReports,
    fetchDatasources,
    fetchSchedules,
    fetchExecutions,
    handleCreateReport,
    handleEditReport,
    handleSaveReport,
    handleDeleteReport,
    handlePreviewReport,
    handleExecuteReport,
    handleCreateDatasource,
    handleEditDatasource,
    handleSaveDatasource,
    handleDeleteDatasource,
    handleCreateSchedule,
    handleEditSchedule,
    handleSaveSchedule,
    handleDeleteSchedule,
  } = state;

  // ---- Forms (kept in main page; modals file consumes the form instance) ----
  const [reportForm] = Form.useForm();
  const [datasourceForm] = Form.useForm();
  const [scheduleForm] = Form.useForm();

  useEffect(() => {
    if (editingReport) {
      reportForm.setFieldsValue({
        name: editingReport.name,
        description: editingReport.description,
        category: editingReport.category,
        enabled: editingReport.enabled,
      });
    } else {
      reportForm.resetFields();
    }
  }, [editingReport, reportModalVisible, reportForm]);

  useEffect(() => {
    if (editingDatasource) {
      datasourceForm.setFieldsValue({
        name: editingDatasource.name,
        type: editingDatasource.type,
        connectionConfig: JSON.stringify(editingDatasource.connectionConfig, null, 2),
        enabled: editingDatasource.enabled,
      });
    } else {
      datasourceForm.resetFields();
      datasourceForm.setFieldsValue({ type: 'sql', enabled: true });
    }
  }, [editingDatasource, datasourceModalVisible, datasourceForm]);

  useEffect(() => {
    if (editingSchedule) {
      scheduleForm.setFieldsValue({
        reportId: editingSchedule.reportId,
        cronExpression: editingSchedule.cronExpression,
        exportFormat: editingSchedule.exportFormat,
        recipients: editingSchedule.recipients.join(','),
        enabled: editingSchedule.enabled,
      });
    } else {
      scheduleForm.resetFields();
      scheduleForm.setFieldsValue({ exportFormat: 'pdf', enabled: true });
    }
  }, [editingSchedule, scheduleModalVisible, scheduleForm]);

  // ---- Form wrapper handlers (validateFields + resetFields + call hook handler) ----
  const handleSaveReportWrapper = async () => {
    try {
      const values = await reportForm.validateFields();
      await handleSaveReport(values);
    } catch {
      // Form validation error - do nothing
    }
  };

  const handleSaveDatasourceWrapper = async () => {
    try {
      const values = await datasourceForm.validateFields();
      await handleSaveDatasource(values);
    } catch {
      // Form validation error
    }
  };

  const handleSaveScheduleWrapper = async () => {
    try {
      const values = await scheduleForm.validateFields();
      await handleSaveSchedule(values);
    } catch {
      // Form validation error
    }
  };

  const tabItems = [
    {
      key: 'reports',
      label: (
        <span>
          <FileTextOutlined style={{ marginRight: 6 }} />
          报表列表
        </span>
      ),
      children: (
        <ReportsTab
          reports={reports}
          loading={loading}
          categoryFilter={categoryFilter}
          onCategoryChange={setCategoryFilter}
          onRefresh={fetchReports}
          onCreate={handleCreateReport}
          handlePreviewReport={handlePreviewReport}
          handleExecuteReport={handleExecuteReport}
          handleEditReport={handleEditReport}
          handleDeleteReport={handleDeleteReport}
          categoryOptions={categoryOptions}
        />
      ),
    },
    {
      key: 'datasources',
      label: (
        <span>
          <DatabaseOutlined style={{ marginRight: 6 }} />
          数据源管理
        </span>
      ),
      children: (
        <DataSourcesTab
          datasources={datasources}
          loading={loading}
          onRefresh={fetchDatasources}
          onCreate={handleCreateDatasource}
          handleEditDatasource={handleEditDatasource}
          handleDeleteDatasource={handleDeleteDatasource}
        />
      ),
    },
    {
      key: 'schedules',
      label: (
        <span>
          <ClockCircleOutlined style={{ marginRight: 6 }} />
          定时调度
        </span>
      ),
      children: (
        <SchedulesTab
          schedules={schedules}
          loading={loading}
          onRefresh={fetchSchedules}
          onCreate={handleCreateSchedule}
          handleEditSchedule={handleEditSchedule}
          handleDeleteSchedule={handleDeleteSchedule}
        />
      ),
    },
    {
      key: 'executions',
      label: (
        <span>
          <PlayCircleOutlined style={{ marginRight: 6 }} />
          执行历史
        </span>
      ),
      children: (
        <ExecutionsTab executions={executions} loading={loading} onRefresh={fetchExecutions} />
      ),
    },
  ];

  return (
    <div style={{ padding: spacing.lg }}>
      <Title level={2} style={{ marginBottom: spacing.md }}>
        <FileTextOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        报表管理
      </Title>

      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />

      <ReportDesignerModals
        reports={reports}
        reportModalVisible={reportModalVisible}
        setReportModalVisible={setReportModalVisible}
        reportConfirmLoading={reportConfirmLoading}
        editingReport={editingReport}
        reportForm={reportForm}
        handleSaveReport={handleSaveReportWrapper}
        datasourceModalVisible={datasourceModalVisible}
        setDatasourceModalVisible={setDatasourceModalVisible}
        editingDatasource={editingDatasource}
        datasourceForm={datasourceForm}
        handleSaveDatasource={handleSaveDatasourceWrapper}
        scheduleModalVisible={scheduleModalVisible}
        setScheduleModalVisible={setScheduleModalVisible}
        editingSchedule={editingSchedule}
        scheduleForm={scheduleForm}
        handleSaveSchedule={handleSaveScheduleWrapper}
        previewDrawerVisible={previewDrawerVisible}
        setPreviewDrawerVisible={setPreviewDrawerVisible}
        previewData={previewData}
        setPreviewData={setPreviewData}
        selectedReportForPreview={selectedReportForPreview}
        setSelectedReportForPreview={setSelectedReportForPreview}
        categoryOptions={categoryOptions}
        categoryLabel={categoryLabel}
        categoryColor={categoryColor}
      />
    </div>
  );
}
