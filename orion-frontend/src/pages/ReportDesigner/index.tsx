/**
 * Report Designer Page
 *
 * Features:
 * - Report list with category filter and CRUD operations
 * - Datasource management (sql/api/promql)
 * - Schedule management (cron, export format, recipients)
 * - Report preview placeholder
 * - Execution history table
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Typography,
  Card,
  Table,
  Tag,
  Space,
  Button,
  Switch,
  message,
  Modal,
  Form,
  Input,
  Select,
  Row,
  Col,
  Popconfirm,
  Drawer,
  Descriptions,
  Empty,
  Tabs,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
  FileTextOutlined,
  DatabaseOutlined,
  ClockCircleOutlined,
  PlayCircleOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { colors, spacing } from '@/tokens';
import {
  listReports,
  createReport,
  updateReport,
  deleteReport,
  previewReport,
  executeReport,
  getReportExecutions,
  listDatasources,
  createDatasource,
  updateDatasource,
  deleteDatasource,
  listSchedules,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  type ReportDefinition,
  type ReportDatasource,
  type ReportSchedule,
  type ReportExecution,
  type CreateReportInput,
  type CreateDatasourceInput,
  type CreateScheduleInput,
} from '@/api/reports';

const { Title, Text } = Typography;
const { TextArea } = Input;

// ============ Constants ============

const categoryOptions = [
  { value: 'operations', label: '运维报表' },
  { value: 'performance', label: '性能报表' },
  { value: 'business', label: '业务报表' },
  { value: 'security', label: '安全报表' },
  { value: 'custom', label: '自定义' },
];

const categoryLabel: Record<string, string> = {
  operations: '运维报表',
  performance: '性能报表',
  business: '业务报表',
  security: '安全报表',
  custom: '自定义',
};

const categoryColor: Record<string, string> = {
  operations: 'blue',
  performance: 'cyan',
  business: 'green',
  security: 'red',
  custom: 'default',
};

const datasourceTypeLabel: Record<string, string> = {
  sql: 'SQL',
  api: 'API',
  promql: 'PromQL',
};

const datasourceTypeColor: Record<string, string> = {
  sql: 'blue',
  api: 'orange',
  promql: 'purple',
};

const exportFormatLabel: Record<string, string> = {
  pdf: 'PDF',
  excel: 'Excel',
  csv: 'CSV',
};

const executionStatusLabel: Record<string, string> = {
  pending: '待执行',
  running: '执行中',
  completed: '已完成',
  failed: '失败',
};

const executionStatusColor: Record<string, string> = {
  pending: colors.neutral[400],
  running: colors.primary[500],
  completed: colors.success[500],
  failed: colors.error[500],
};

export default function ReportDesignerPage() {
  // ============ State ============
  const [reports, setReports] = useState<ReportDefinition[]>([]);
  const [datasources, setDatasources] = useState<ReportDatasource[]>([]);
  const [schedules, setSchedules] = useState<ReportSchedule[]>([]);
  const [executions, setExecutions] = useState<ReportExecution[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('reports');
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>(undefined);

  // Report modal
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportConfirmLoading, setReportConfirmLoading] = useState(false);
  const [editingReport, setEditingReport] = useState<ReportDefinition | null>(null);
  const [reportForm] = Form.useForm();

  // Datasource modal
  const [datasourceModalVisible, setDatasourceModalVisible] = useState(false);
  const [editingDatasource, setEditingDatasource] = useState<ReportDatasource | null>(null);
  const [datasourceForm] = Form.useForm();

  // Schedule modal
  const [scheduleModalVisible, setScheduleModalVisible] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ReportSchedule | null>(null);
  const [scheduleForm] = Form.useForm();

  // Preview drawer
  const [previewDrawerVisible, setPreviewDrawerVisible] = useState(false);
  const [previewData, setPreviewData] = useState<Record<string, unknown> | null>(null);
  const [selectedReportForPreview, setSelectedReportForPreview] = useState<ReportDefinition | null>(null);

  // ============ Data Fetching ============

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listReports(categoryFilter ? { category: categoryFilter } : undefined);
      setReports(res.data ?? []);
    } catch {
      message.error('获取报表列表失败');
    } finally {
      setLoading(false);
    }
  }, [categoryFilter]);

  const fetchDatasources = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listDatasources();
      setDatasources(res.data ?? []);
    } catch {
      message.error('获取数据源列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSchedules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listSchedules();
      setSchedules(res.data ?? []);
    } catch {
      message.error('获取调度列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchExecutions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getReportExecutions(undefined, 100);
      setExecutions(res.data ?? []);
    } catch {
      message.error('获取执行历史失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'reports') fetchReports();
    else if (activeTab === 'datasources') fetchDatasources();
    else if (activeTab === 'schedules') fetchSchedules();
    else if (activeTab === 'executions') fetchExecutions();
  }, [activeTab, fetchReports, fetchDatasources, fetchSchedules, fetchExecutions]);

  useEffect(() => {
    if (activeTab === 'reports') fetchReports();
  }, [categoryFilter, activeTab, fetchReports]);

  // ============ Report Handlers ============

  const handleCreateReport = () => {
    setEditingReport(null);
    reportForm.resetFields();
    setReportModalVisible(true);
  };

  const handleEditReport = (record: ReportDefinition) => {
    setEditingReport(record);
    reportForm.setFieldsValue({
      name: record.name,
      description: record.description,
      category: record.category,
      enabled: record.enabled,
    });
    setReportModalVisible(true);
  };

  const handleSaveReport = async () => {
    try {
      const values = await reportForm.validateFields();
      setReportConfirmLoading(true);
      const input: CreateReportInput = {
        name: values.name,
        description: values.description,
        category: values.category,
      };
      if (editingReport) {
        await updateReport(editingReport.id, input);
        message.success('报表更新成功');
      } else {
        await createReport(input);
        message.success('报表创建成功');
      }
      setReportModalVisible(false);
      fetchReports();
    } catch (err: any) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      message.error('保存失败');
    } finally {
      setReportConfirmLoading(false);
    }
  };

  const handleDeleteReport = async (id: string) => {
    try {
      await deleteReport(id);
      message.success('报表删除成功');
      fetchReports();
    } catch {
      message.error('删除失败');
    }
  };

  const handlePreviewReport = async (record: ReportDefinition) => {
    setSelectedReportForPreview(record);
    setPreviewDrawerVisible(true);
    try {
      const res = await previewReport(record.id);
      setPreviewData(res.data ?? null);
    } catch {
      setPreviewData(null);
    }
  };

  const handleExecuteReport = async (id: string) => {
    try {
      await executeReport(id, { triggeredBy: 'ui' });
      message.success('报表执行已启动');
    } catch {
      message.error('执行失败');
    }
  };

  // ============ Datasource Handlers ============

  const handleCreateDatasource = () => {
    setEditingDatasource(null);
    datasourceForm.resetFields();
    datasourceForm.setFieldsValue({ type: 'sql', enabled: true });
    setDatasourceModalVisible(true);
  };

  const handleEditDatasource = (record: ReportDatasource) => {
    setEditingDatasource(record);
    datasourceForm.setFieldsValue({
      name: record.name,
      type: record.type,
      connectionConfig: JSON.stringify(record.connectionConfig, null, 2),
      enabled: record.enabled,
    });
    setDatasourceModalVisible(true);
  };

  const handleSaveDatasource = async () => {
    try {
      const values = await datasourceForm.validateFields();
      let config: Record<string, unknown> = {};
      try {
        config = values.connectionConfig ? JSON.parse(values.connectionConfig) : {};
      } catch {
        message.error('连接配置格式错误，请输入合法 JSON');
        return;
      }
      const input: CreateDatasourceInput = {
        name: values.name,
        type: values.type,
        connectionConfig: config,
      };
      if (editingDatasource) {
        await updateDatasource(editingDatasource.id, input);
        message.success('数据源更新成功');
      } else {
        await createDatasource(input);
        message.success('数据源创建成功');
      }
      setDatasourceModalVisible(false);
      fetchDatasources();
    } catch {
      message.error('保存失败');
    }
  };

  const handleDeleteDatasource = async (id: string) => {
    try {
      await deleteDatasource(id);
      message.success('数据源删除成功');
      fetchDatasources();
    } catch {
      message.error('删除失败');
    }
  };

  // ============ Schedule Handlers ============

  const handleCreateSchedule = () => {
    setEditingSchedule(null);
    scheduleForm.resetFields();
    scheduleForm.setFieldsValue({ exportFormat: 'pdf', enabled: true });
    setScheduleModalVisible(true);
  };

  const handleEditSchedule = (record: ReportSchedule) => {
    setEditingSchedule(record);
    scheduleForm.setFieldsValue({
      reportId: record.reportId,
      cronExpression: record.cronExpression,
      exportFormat: record.exportFormat,
      recipients: record.recipients.join(','),
      enabled: record.enabled,
    });
    setScheduleModalVisible(true);
  };

  const handleSaveSchedule = async () => {
    try {
      const values = await scheduleForm.validateFields();
      const recipients = (values.recipients as string)
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean);
      const input: CreateScheduleInput = {
        reportId: values.reportId,
        cronExpression: values.cronExpression,
        exportFormat: values.exportFormat,
        recipients,
        enabled: values.enabled,
      };
      if (editingSchedule) {
        await updateSchedule(editingSchedule.id, input);
        message.success('调度更新成功');
      } else {
        await createSchedule(input);
        message.success('调度创建成功');
      }
      setScheduleModalVisible(false);
      fetchSchedules();
    } catch {
      message.error('保存失败');
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    try {
      await deleteSchedule(id);
      message.success('调度删除成功');
      fetchSchedules();
    } catch {
      message.error('删除失败');
    }
  };

  // ============ Column Definitions ============

  const reportColumns: ColumnsType<ReportDefinition> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      render: (cat: string) => (
        <Tag color={categoryColor[cat] ?? 'default'}>{categoryLabel[cat] ?? cat ?? '-'}</Tag>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (text: string) => text || '-',
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      render: (enabled: boolean) => (
        <Tag color={enabled ? 'green' : 'default'}>{enabled ? '启用' : '禁用'}</Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (text: string) => dayjs(text).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 280,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handlePreviewReport(record)}
          >
            预览
          </Button>
          <Button
            type="link"
            icon={<PlayCircleOutlined />}
            onClick={() => handleExecuteReport(record.id)}
          >
            执行
          </Button>
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEditReport(record)}>
            编辑
          </Button>
          <Popconfirm title="确认删除此报表？" onConfirm={() => handleDeleteReport(record.id)}>
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const datasourceColumns: ColumnsType<ReportDatasource> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => (
        <Tag color={datasourceTypeColor[type] ?? 'default'}>{datasourceTypeLabel[type] ?? type}</Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      render: (enabled: boolean) => (
        <Tag color={enabled ? 'green' : 'default'}>{enabled ? '启用' : '禁用'}</Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (text: string) => dayjs(text).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 160,
      render: (_, record) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEditDatasource(record)}>
            编辑
          </Button>
          <Popconfirm title="确认删除此数据源？" onConfirm={() => handleDeleteDatasource(record.id)}>
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const scheduleColumns: ColumnsType<ReportSchedule> = [
    {
      title: '报表 ID',
      dataIndex: 'reportId',
      key: 'reportId',
      ellipsis: true,
    },
    {
      title: 'Cron 表达式',
      dataIndex: 'cronExpression',
      key: 'cronExpression',
      render: (text: string) => <Text code>{text}</Text>,
    },
    {
      title: '导出格式',
      dataIndex: 'exportFormat',
      key: 'exportFormat',
      render: (fmt: string) => <Tag>{exportFormatLabel[fmt] ?? fmt}</Tag>,
    },
    {
      title: '接收人',
      dataIndex: 'recipients',
      key: 'recipients',
      render: (recipients: string[]) =>
        recipients?.length ? recipients.map((r) => <Tag key={r}>{r}</Tag>) : '-',
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      render: (enabled: boolean) => (
        <Tag color={enabled ? 'green' : 'default'}>{enabled ? '启用' : '禁用'}</Tag>
      ),
    },
    {
      title: '上次执行',
      dataIndex: 'lastRunAt',
      key: 'lastRunAt',
      render: (text: string | null) => (text ? dayjs(text).format('YYYY-MM-DD HH:mm') : '-'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 160,
      render: (_, record) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEditSchedule(record)}>
            编辑
          </Button>
          <Popconfirm title="确认删除此调度？" onConfirm={() => handleDeleteSchedule(record.id)}>
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const executionColumns: ColumnsType<ReportExecution> = [
    {
      title: '报表 ID',
      dataIndex: 'reportId',
      key: 'reportId',
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={executionStatusColor[status]}>{executionStatusLabel[status] ?? status}</Tag>
      ),
    },
    {
      title: '导出格式',
      dataIndex: 'exportFormat',
      key: 'exportFormat',
      render: (fmt: string | null) => <Tag>{fmt ? (exportFormatLabel[fmt] ?? fmt) : '-'}</Tag>,
    },
    {
      title: '错误信息',
      dataIndex: 'error',
      key: 'error',
      ellipsis: true,
      render: (text: string | null) => (text ? <Text type="danger">{text}</Text> : '-'),
    },
    {
      title: '开始时间',
      dataIndex: 'startedAt',
      key: 'startedAt',
      render: (text: string) => dayjs(text).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '完成时间',
      dataIndex: 'completedAt',
      key: 'completedAt',
      render: (text: string | null) => (text ? dayjs(text).format('YYYY-MM-DD HH:mm:ss') : '-'),
    },
  ];

  // ============ Render ============

  return (
    <div style={{ padding: spacing.lg }}>
      <Title level={2} style={{ marginBottom: spacing.md }}>
        <FileTextOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        报表管理
      </Title>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'reports',
            label: (
              <span>
                <FileTextOutlined style={{ marginRight: 6 }} />
                报表列表
              </span>
            ),
            children: (
              <Card
                style={{
                  borderRadius: 12,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
                }}
              >
                <Row justify="space-between" align="middle" style={{ marginBottom: spacing.md }}>
                  <Col>
                    <Space>
                      <Select
                        placeholder="按分类筛选"
                        allowClear
                        style={{ width: 160 }}
                        value={categoryFilter}
                        onChange={setCategoryFilter}
                        options={categoryOptions}
                      />
                      <Button icon={<ReloadOutlined />} onClick={fetchReports}>
                        刷新
                      </Button>
                    </Space>
                  </Col>
                  <Col>
                    <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateReport}>
                      创建报表
                    </Button>
                  </Col>
                </Row>
                <Table
                  columns={reportColumns}
                  dataSource={reports}
                  rowKey="id"
                  loading={loading}
                  pagination={{ pageSize: 20 }}
                  locale={{ emptyText: <Empty description="暂无报表，点击上方按钮创建" /> }}
                />
              </Card>
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
              <Card
                style={{
                  borderRadius: 12,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
                }}
              >
                <Row justify="space-between" style={{ marginBottom: spacing.md }}>
                  <Col>
                    <Button icon={<ReloadOutlined />} onClick={fetchDatasources}>
                      刷新
                    </Button>
                  </Col>
                  <Col>
                    <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateDatasource}>
                      创建数据源
                    </Button>
                  </Col>
                </Row>
                <Table
                  columns={datasourceColumns}
                  dataSource={datasources}
                  rowKey="id"
                  loading={loading}
                  pagination={{ pageSize: 20 }}
                  locale={{ emptyText: <Empty description="暂无数据源，点击上方按钮创建" /> }}
                />
              </Card>
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
              <Card
                style={{
                  borderRadius: 12,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
                }}
              >
                <Row justify="space-between" style={{ marginBottom: spacing.md }}>
                  <Col>
                    <Button icon={<ReloadOutlined />} onClick={fetchSchedules}>
                      刷新
                    </Button>
                  </Col>
                  <Col>
                    <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateSchedule}>
                      创建调度
                    </Button>
                  </Col>
                </Row>
                <Table
                  columns={scheduleColumns}
                  dataSource={schedules}
                  rowKey="id"
                  loading={loading}
                  pagination={{ pageSize: 20 }}
                  locale={{ emptyText: <Empty description="暂无调度任务，点击上方按钮创建" /> }}
                />
              </Card>
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
              <Card
                style={{
                  borderRadius: 12,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
                }}
              >
                <Row justify="space-between" style={{ marginBottom: spacing.md }}>
                  <Col>
                    <Button icon={<ReloadOutlined />} onClick={fetchExecutions}>
                      刷新
                    </Button>
                  </Col>
                </Row>
                <Table
                  columns={executionColumns}
                  dataSource={executions}
                  rowKey="id"
                  loading={loading}
                  pagination={{ pageSize: 20 }}
                  locale={{ emptyText: <Empty description="暂无执行记录" /> }}
                />
              </Card>
            ),
          },
        ]}
      />

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
            <Select placeholder="选择报表分类" style={{ height: 36 }} options={categoryOptions} />
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
          <Form.Item
            name="type"
            label="类型"
            rules={[{ required: true, message: '请选择类型' }]}
          >
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
            <Input
              placeholder="user1@example.com, user2@example.com"
              style={{ height: 36 }}
            />
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
            <Descriptions
              column={1}
              bordered
              size="small"
              style={{ marginBottom: spacing.md }}
            >
              <Descriptions.Item label="报表名称">{selectedReportForPreview.name}</Descriptions.Item>
              <Descriptions.Item label="分类">
                <Tag color={categoryColor[selectedReportForPreview.category ?? ''] ?? 'default'}>
                  {categoryLabel[selectedReportForPreview.category ?? ''] ?? selectedReportForPreview.category ?? '-'}
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
    </div>
  );
}
