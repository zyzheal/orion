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
 *
 * P2-9 Phase 259 重构: 282 -> 76 行 (-73%), 新增:
 *   useReportDesignerForms.ts  — 3 Form + 3 useEffect + 3 wrapper handlers
 *   Components/TabItems.tsx    — 4 tabs items (reports/datasources/schedules/executions)
 */
import { Typography, Tabs } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import { useReportDesignerState } from './useReportDesignerState';
import { useReportDesignerForms } from './useReportDesignerForms';
import { categoryLabel, categoryColor } from './ReportDesignerColumns';
import { ReportDesignerModals } from './ReportDesignerModals';
import { buildTabItems, categoryOptions } from './Components/TabItems';

const { Title } = Typography;

export default function ReportDesignerPage() {
  const state = useReportDesignerState();
  const {
    reportForm, datasourceForm, scheduleForm,
    handleSaveReportWrapper, handleSaveDatasourceWrapper, handleSaveScheduleWrapper,
  } = useReportDesignerForms({ state });

  const tabItems = buildTabItems({ state });

  return (
    <div style={{ padding: spacing.lg }}>
      <Title level={2} style={{ marginBottom: spacing.md }}>
        <FileTextOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        报表管理
      </Title>

      <Tabs activeKey={state.activeTab} onChange={state.setActiveTab} items={tabItems} />

      <ReportDesignerModals
        reports={state.reports}
        reportModalVisible={state.reportModalVisible}
        setReportModalVisible={state.setReportModalVisible}
        reportConfirmLoading={state.reportConfirmLoading}
        editingReport={state.editingReport}
        reportForm={reportForm}
        handleSaveReport={handleSaveReportWrapper}
        datasourceModalVisible={state.datasourceModalVisible}
        setDatasourceModalVisible={state.setDatasourceModalVisible}
        editingDatasource={state.editingDatasource}
        datasourceForm={datasourceForm}
        handleSaveDatasource={handleSaveDatasourceWrapper}
        scheduleModalVisible={state.scheduleModalVisible}
        setScheduleModalVisible={state.setScheduleModalVisible}
        editingSchedule={state.editingSchedule}
        scheduleForm={scheduleForm}
        handleSaveSchedule={handleSaveScheduleWrapper}
        previewDrawerVisible={state.previewDrawerVisible}
        setPreviewDrawerVisible={state.setPreviewDrawerVisible}
        previewData={state.previewData}
        setPreviewData={state.setPreviewData}
        selectedReportForPreview={state.selectedReportForPreview}
        setSelectedReportForPreview={state.setSelectedReportForPreview}
        categoryOptions={categoryOptions}
        categoryLabel={categoryLabel}
        categoryColor={categoryColor}
      />
    </div>
  );
}
