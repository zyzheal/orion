/**
 * ReportDesignerModals.tsx - 报表设计器 Modals + Drawer
 * 抽取自 ReportDesigner/index.tsx (P2-9 Phase 13)
 * 精简 props (P2-9 Phase 51): 移除未使用的 setter/handler
 * 使用 destructuring 替代 props.xxx
 */
import React from 'react';
import {
  Modal,
  Drawer,
  Form,
  Input,
  Select,
  Tag,
  Card,
  Descriptions,
  Empty,
  Switch,
  Typography,
} from 'antd';
import type {
  ReportDefinition,
  ReportDatasource,
  ReportSchedule,
} from '@/api/reports';
import dayjs from 'dayjs';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;
const { TextArea } = Input;

type FormInstance = ReturnType<typeof Form.useForm>[0];

interface ReportDesignerModalsProps {
  // Data (used in schedule modal report selector)
  reports: ReportDefinition[];

  // Report modal
  reportModalVisible: boolean;
  setReportModalVisible: (v: boolean) => void;
  reportConfirmLoading: boolean;
  editingReport: ReportDefinition | null;
  reportForm: FormInstance;
  handleSaveReport: () => void;

  // Datasource modal
  datasourceModalVisible: boolean;
  setDatasourceModalVisible: (v: boolean) => void;
  editingDatasource: ReportDatasource | null;
  datasourceForm: FormInstance;
  handleSaveDatasource: () => void;

  // Schedule modal
  scheduleModalVisible: boolean;
  setScheduleModalVisible: (v: boolean) => void;
  editingSchedule: ReportSchedule | null;
  scheduleForm: FormInstance;
  handleSaveSchedule: () => void;

  // Preview drawer
  previewDrawerVisible: boolean;
  setPreviewDrawerVisible: (v: boolean) => void;
  previewData: Record<string, unknown> | null;
  setPreviewData: (v: Record<string, unknown> | null) => void;
  selectedReportForPreview: ReportDefinition | null;
  setSelectedReportForPreview: (v: ReportDefinition | null) => void;

  // Category constants (used in preview drawer tag)
  categoryOptions: { label: string; value: string }[];
  categoryLabel: Record<string, string>;
  categoryColor: Record<string, string>;
}

export const ReportDesignerModals: React.FC<ReportDesignerModalsProps> = ({
  reports,
  reportModalVisible,
  setReportModalVisible,
  reportConfirmLoading,
  editingReport,
  reportForm,
  handleSaveReport,
  datasourceModalVisible,
  setDatasourceModalVisible,
  editingDatasource,
  datasourceForm,
  handleSaveDatasource,
  scheduleModalVisible,
  setScheduleModalVisible,
  editingSchedule,
  scheduleForm,
  handleSaveSchedule,
  previewDrawerVisible,
  setPreviewDrawerVisible,
  previewData,
  setPreviewData,
  selectedReportForPreview,
  setSelectedReportForPreview,
  categoryOptions,
  categoryLabel,
  categoryColor,
}) => (
  <>
    {/* ============ Report Create/Edit Modal ============ */}
    <Modal
      title={editingReport ? '编辑报表' : '创建报表'}
      open={reportModalVisible}
      onOk={handleSaveReport}
      confirmLoading={reportConfirmLoading}
      onCancel={() => setReportModalVisible(false)}
      width={600}
      destroyOnClose
    >
      <Form form={reportForm} layout="vertical" style={{ marginTop: spacing.md }}>
        <Form.Item
          name="name"
          label="报表名称"
          rules={[{ required: true, message: '请输入报表名称' }]}
        >
          <Input placeholder="输入报表名称" style={{ height: 36 }} />
        </Form.Item>
        <Form.Item name="description" label="描述">
          <TextArea rows={3} placeholder="输入报表描述" />
        </Form.Item>
        <Form.Item
          name="category"
          label="分类"
          rules={[{ required: true, message: '请选择分类' }]}
        >
          <Select
            placeholder="选择报表分类"
            style={{ height: 36 }}
            options={categoryOptions}
          />
        </Form.Item>
        <Form.Item name="enabled" label="启用" valuePropName="checked" initialValue={true}>
          <Switch />
        </Form.Item>
      </Form>
    </Modal>

    {/* ============ Datasource Create/Edit Modal ============ */}
    <Modal
      title={editingDatasource ? '编辑数据源' : '创建数据源'}
      open={datasourceModalVisible}
      onOk={handleSaveDatasource}
      onCancel={() => setDatasourceModalVisible(false)}
      width={600}
      destroyOnClose
    >
      <Form form={datasourceForm} layout="vertical" style={{ marginTop: spacing.md }}>
        <Form.Item
          name="name"
          label="数据源名称"
          rules={[{ required: true, message: '请输入数据源名称' }]}
        >
          <Input placeholder="输入数据源名称" style={{ height: 36 }} />
        </Form.Item>
        <Form.Item name="type" label="类型" rules={[{ required: true, message: '请选择类型' }]}>
          <Select
            placeholder="选择数据源类型"
            style={{ height: 36 }}
            options={[
              { value: 'sql', label: 'SQL 数据库' },
              { value: 'api', label: 'API 接口' },
              { value: 'promql', label: 'PromQL (Prometheus)' },
            ]}
          />
        </Form.Item>
        <Form.Item
          name="connectionConfig"
          label="连接配置 (JSON)"
          rules={[{ required: true, message: '请输入连接配置' }]}
        >
          <TextArea
            rows={5}
            placeholder={'{\n  "host": "localhost",\n  "port": 5432,\n  "database": "mydb"\n}'}
            style={{ fontFamily: '"SFMono-Regular", Consolas, monospace', fontSize: 13 }}
          />
        </Form.Item>
        <Form.Item name="enabled" label="启用" valuePropName="checked" initialValue={true}>
          <Switch />
        </Form.Item>
      </Form>
    </Modal>

    {/* ============ Schedule Create/Edit Modal ============ */}
    <Modal
      title={editingSchedule ? '编辑调度' : '创建调度'}
      open={scheduleModalVisible}
      onOk={handleSaveSchedule}
      onCancel={() => setScheduleModalVisible(false)}
      width={600}
      destroyOnClose
    >
      <Form form={scheduleForm} layout="vertical" style={{ marginTop: spacing.md }}>
        <Form.Item
          name="reportId"
          label="关联报表"
          rules={[{ required: true, message: '请选择关联报表' }]}
        >
          <Select
            placeholder="选择报表"
            style={{ height: 36 }}
            showSearch
            optionFilterProp="label"
            options={reports.map((r) => ({ value: r.id, label: r.name }))}
          />
        </Form.Item>
        <Form.Item
          name="cronExpression"
          label="Cron 表达式"
          rules={[{ required: true, message: '请输入 Cron 表达式' }]}
        >
          <Input
            placeholder="例: 0 8 * * 1 (每周一早8点)"
            style={{ height: 36 }}
            suffix={
              <Text type="secondary" style={{ fontSize: 12 }}>
                分 时 日 月 周
              </Text>
            }
          />
        </Form.Item>
        <Form.Item
          name="exportFormat"
          label="导出格式"
          rules={[{ required: true, message: '请选择导出格式' }]}
        >
          <Select
            placeholder="选择导出格式"
            style={{ height: 36 }}
            options={[
              { value: 'pdf', label: 'PDF' },
              { value: 'excel', label: 'Excel' },
              { value: 'csv', label: 'CSV' },
            ]}
          />
        </Form.Item>
        <Form.Item
          name="recipients"
          label="接收人"
          rules={[{ required: true, message: '请输入接收人邮箱' }]}
          extra="多个邮箱用逗号分隔"
        >
          <Input placeholder="user1@example.com, user2@example.com" style={{ height: 36 }} />
        </Form.Item>
        <Form.Item name="enabled" label="启用" valuePropName="checked" initialValue={true}>
          <Switch />
        </Form.Item>
      </Form>
    </Modal>

    {/* ============ Report Preview Drawer ============ */}
    <Drawer
      title="报表预览"
      open={previewDrawerVisible}
      onClose={() => {
        setPreviewDrawerVisible(false);
        setPreviewData(null);
        setSelectedReportForPreview(null);
      }}
      width={560}
    >
      {selectedReportForPreview && (
        <>
          <Descriptions column={1} bordered size="small" style={{ marginBottom: spacing.md }}>
            <Descriptions.Item label="报表名称">
              {selectedReportForPreview.name}
            </Descriptions.Item>
            <Descriptions.Item label="分类">
              <Tag
                color={
                  categoryColor[selectedReportForPreview.category ?? ''] ?? 'default'
                }
              >
                {categoryLabel[selectedReportForPreview.category ?? ''] ??
                  selectedReportForPreview.category ??
                  '-'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="描述">
              {selectedReportForPreview.description || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={selectedReportForPreview.enabled ? 'green' : 'default'}>
                {selectedReportForPreview.enabled ? '启用' : '禁用'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {dayjs(selectedReportForPreview.createdAt).format('YYYY-MM-DD HH:mm')}
            </Descriptions.Item>
            <Descriptions.Item label="更新时间">
              {dayjs(selectedReportForPreview.updatedAt).format('YYYY-MM-DD HH:mm')}
            </Descriptions.Item>
          </Descriptions>

          <Title level={4} style={{ marginBottom: spacing.sm }}>
            数据预览
          </Title>
          {previewData ? (
            <Card
              size="small"
              style={{
                background: colors.neutral[50],
                borderRadius: 8,
                fontFamily: '"SFMono-Regular", Consolas, monospace',
                fontSize: 13,
              }}
            >
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {JSON.stringify(previewData, null, 2)}
              </pre>
            </Card>
          ) : (
            <Empty description="暂无预览数据" />
          )}
        </>
      )}
    </Drawer>
  </>
);
