/**
 * Process Step Engine Page
 *
 * Features:
 * - Process definition CRUD with steps/transitions editor
 * - Process instance list with status filtering
 * - Instance detail drawer with step history timeline
 * - Step advancement actions (approve, reject, pause, retry, etc.)
 * - State machine visualization
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Typography,
  Card,
  Table,
  Tag,
  Space,
  Button,
  message,
  Modal,
  Form,
  Input,
  Select,
  Row,
  Col,
  Drawer,
  Descriptions,
  Timeline,
  Popconfirm,
  Tabs,
  Empty,
  Badge,
  Tooltip,
  Switch,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  UndoOutlined,
  ForwardOutlined,
  StopOutlined,
  ApartmentOutlined,
  HistoryOutlined,
  RocketOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { colors, spacing } from '@/tokens';
import {
  listDefinitions,
  getDefinition,
  createDefinition,
  updateDefinition,
  deleteDefinition,
  listInstances,
  getInstance,
  startInstance,
  getStepHistory,
  advanceStep,
  type ProcessDefinition,
  type ProcessInstance,
  type ProcessStepInstance,
  type ProcessStepDef,
  type CreateDefinitionInput,
} from '@/api/process-steps';

const { Title, Text } = Typography;
const { TextArea } = Input;

/* ==================== Constants ==================== */

const statusColor: Record<string, string> = {
  draft: 'default',
  pending: 'processing',
  running: 'processing',
  success: 'success',
  failed: 'error',
  paused: 'warning',
  aborted: 'default',
  wait: 'warning',
  retry: 'warning',
  rejected: 'error',
  skip: 'default',
  close: 'default',
  completed: 'success',
};

const statusLabel: Record<string, string> = {
  draft: '草稿',
  pending: '待处理',
  running: '运行中',
  success: '成功',
  failed: '失败',
  paused: '已暂停',
  aborted: '已中止',
  wait: '等待中',
  retry: '重试中',
  rejected: '已拒绝',
  skip: '已跳过',
  close: '已关闭',
  completed: '已完成',
};

const actionLabel: Record<string, string> = {
  pending: '提交',
  running: '启动',
  success: '完成',
  failed: '失败',
  paused: '暂停',
  aborted: '中止',
  wait: '等待',
  retry: '重试',
  rejected: '拒绝',
  close: '关闭',
};

const actionIcon: Record<string, React.ReactNode> = {
  pending: <ForwardOutlined />,
  running: <PlayCircleOutlined />,
  success: <CheckCircleOutlined />,
  failed: <CloseCircleOutlined />,
  paused: <PauseCircleOutlined />,
  aborted: <StopOutlined />,
  wait: <PauseCircleOutlined />,
  retry: <UndoOutlined />,
  rejected: <CloseCircleOutlined />,
  close: <StopOutlined />,
};

const stepTypeLabel: Record<string, string> = {
  auto: '自动',
  manual: '手动',
  approval: '审批',
  script: '脚本',
};

/* ==================== Component ==================== */

export default function ProcessStepPage() {
  // Tab state
  const [activeTab, setActiveTab] = useState('definitions');

  // Definition state
  const [definitions, setDefinitions] = useState<ProcessDefinition[]>([]);
  const [defLoading, setDefLoading] = useState(false);
  const [defTotal, setDefTotal] = useState(0);
  const [defPage, setDefPage] = useState(1);
  const [defFilter, setDefFilter] = useState<{ entityType?: string; enabled?: boolean }>({});

  // Instance state
  const [instances, setInstances] = useState<ProcessInstance[]>([]);
  const [instLoading, setInstLoading] = useState(false);
  const [instTotal, setInstTotal] = useState(0);
  const [instPage, setInstPage] = useState(1);
  const [instFilter, setInstFilter] = useState<{ status?: string; definitionId?: string }>({});

  // Definition form modal
  const [defModalOpen, setDefModalOpen] = useState(false);
  const [defModalLoading, setDefModalLoading] = useState(false);
  const [editingDef, setEditingDef] = useState<ProcessDefinition | null>(null);
  const [defForm] = Form.useForm();

  // Instance start modal
  const [startModalOpen, setStartModalOpen] = useState(false);
  const [startModalLoading, setStartModalLoading] = useState(false);
  const [startForm] = Form.useForm();

  // Detail drawer
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [detailInstance, setDetailInstance] = useState<ProcessInstance | null>(null);
  const [stepHistory, setStepHistory] = useState<ProcessStepInstance[]>([]);
  const [stepLoading, setStepLoading] = useState(false);

  // Definition detail drawer
  const [defDetailOpen, setDefDetailOpen] = useState(false);
  const [defDetail, setDefDetail] = useState<ProcessDefinition | null>(null);

  /* ==================== Data Loading ==================== */

  const fetchDefinitions = useCallback(async () => {
    setDefLoading(true);
    try {
      const res = await listDefinitions({
        ...defFilter,
        limit: 20,
        offset: (defPage - 1) * 20,
      });
      setDefinitions(res.data.data || []);
      setDefTotal(res.data.total || 0);
    } catch {
      message.error('加载流程定义失败');
    } finally {
      setDefLoading(false);
    }
  }, [defFilter, defPage]);

  const fetchInstances = useCallback(async () => {
    setInstLoading(true);
    try {
      const res = await listInstances({
        ...instFilter,
        limit: 20,
        offset: (instPage - 1) * 20,
      });
      setInstances(res.data.data || []);
      setInstTotal(res.data.total || 0);
    } catch {
      message.error('加载流程实例失败');
    } finally {
      setInstLoading(false);
    }
  }, [instFilter, instPage]);

  useEffect(() => {
    if (activeTab === 'definitions') fetchDefinitions();
    else fetchInstances();
  }, [activeTab, fetchDefinitions, fetchInstances]);

  /* ==================== Definition CRUD ==================== */

  const handleCreateDef = () => {
    setEditingDef(null);
    defForm.resetFields();
    defForm.setFieldsValue({ enabled: true, steps: [{}], transitions: [] });
    setDefModalOpen(true);
  };

  const handleEditDef = (def: ProcessDefinition) => {
    setEditingDef(def);
    defForm.setFieldsValue({
      name: def.name,
      description: def.description,
      entityType: def.entityType,
      enabled: def.enabled,
      steps: def.steps.length > 0 ? def.steps : [{}],
    });
    setDefModalOpen(true);
  };

  const handleSaveDef = async () => {
    try {
      const values = await defForm.validateFields();
      setDefModalLoading(true);

      const steps = (values.steps || [])
        .filter((s: ProcessStepDef) => s.name)
        .map((s: ProcessStepDef, i: number) => ({
          id: s.id || `step-${i + 1}`,
          name: s.name,
          type: s.type || 'auto',
          handler: s.handler,
        }));

      const input: CreateDefinitionInput = {
        name: values.name,
        description: values.description,
        entityType: values.entityType,
        steps,
        enabled: values.enabled ?? true,
      };

      if (editingDef) {
        await updateDefinition(editingDef.id, input);
        message.success('流程定义已更新');
      } else {
        await createDefinition(input);
        message.success('流程定义已创建');
      }

      setDefModalOpen(false);
      fetchDefinitions();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) return; // form validation
      message.error('保存流程定义失败');
    } finally {
      setDefModalLoading(false);
    }
  };

  const handleDeleteDef = async (id: string) => {
    try {
      await deleteDefinition(id);
      message.success('流程定义已删除');
      fetchDefinitions();
    } catch {
      message.error('删除流程定义失败');
    }
  };

  const handleViewDefDetail = async (id: string) => {
    try {
      const res = await getDefinition(id);
      setDefDetail(res.data.data);
      setDefDetailOpen(true);
    } catch {
      message.error('加载流程定义详情失败');
    }
  };

  /* ==================== Instance Management ==================== */

  const handleStartInstance = (defId?: string) => {
    startForm.resetFields();
    if (defId) startForm.setFieldsValue({ definitionId: defId });
    setStartModalOpen(true);
  };

  const handleConfirmStart = async () => {
    try {
      const values = await startForm.validateFields();
      setStartModalLoading(true);
      await startInstance({
        definitionId: values.definitionId,
        entityType: values.entityType || 'default',
        entityId: values.entityId || `entity-${Date.now()}`,
      });
      message.success('流程实例已启动');
      setStartModalOpen(false);
      fetchInstances();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      message.error('启动流程实例失败');
    } finally {
      setStartModalLoading(false);
    }
  };

  const handleViewInstance = async (id: string) => {
    try {
      setStepLoading(true);
      setDetailDrawerOpen(true);
      const [instRes, historyRes] = await Promise.all([
        getInstance(id),
        getStepHistory(id),
      ]);
      setDetailInstance(instRes.data.data);
      setStepHistory(historyRes.data.data || []);
    } catch {
      message.error('加载实例详情失败');
    } finally {
      setStepLoading(false);
    }
  };

  const handleAdvanceStep = async (instanceId: string, stepId: string, action: string) => {
    try {
      await advanceStep(instanceId, stepId, { action });
      message.success(`步骤已${actionLabel[action] || action}`);
      // Refresh detail
      handleViewInstance(instanceId);
      fetchInstances();
    } catch {
      message.error('操作失败');
    }
  };

  /* ==================== Definition Table Columns ==================== */

  const defColumns: ColumnsType<ProcessDefinition> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record) => (
        <a onClick={() => handleViewDefDetail(record.id)}>{text}</a>
      ),
    },
    {
      title: '实体类型',
      dataIndex: 'entityType',
      key: 'entityType',
      render: (text: string) => <Tag>{text}</Tag>,
    },
    {
      title: '步骤数',
      key: 'stepCount',
      render: (_: unknown, record) => record.steps?.length || 0,
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      render: (enabled: boolean) => (
        <Badge status={enabled ? 'success' : 'default'} text={enabled ? '启用' : '禁用'} />
      ),
    },
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      width: 80,
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
      width: 240,
      render: (_: unknown, record) => (
        <Space>
          <Tooltip title="查看详情">
            <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewDefDetail(record.id)} />
          </Tooltip>
          <Tooltip title="编辑">
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEditDef(record)} />
          </Tooltip>
          <Tooltip title="启动实例">
            <Button type="link" size="small" icon={<RocketOutlined />} onClick={() => handleStartInstance(record.id)} />
          </Tooltip>
          <Popconfirm title="确定删除此流程定义？" onConfirm={() => handleDeleteDef(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  /* ==================== Instance Table Columns ==================== */

  const instColumns: ColumnsType<ProcessInstance> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 120,
      ellipsis: true,
      render: (text: string) => (
        <Text copyable={{ text }} style={{ fontSize: 12 }}>{text.slice(0, 8)}...</Text>
      ),
    },
    {
      title: '定义ID',
      dataIndex: 'definitionId',
      key: 'definitionId',
      width: 120,
      ellipsis: true,
    },
    {
      title: '实体类型',
      dataIndex: 'entityType',
      key: 'entityType',
      render: (text: string) => <Tag>{text}</Tag>,
    },
    {
      title: '实体ID',
      dataIndex: 'entityId',
      key: 'entityId',
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={statusColor[status] || 'default'}>{statusLabel[status] || status}</Tag>
      ),
    },
    {
      title: '当前步骤',
      dataIndex: 'currentStepId',
      key: 'currentStepId',
      ellipsis: true,
      render: (text: string | null) => text || '-',
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
      width: 120,
      render: (_: unknown, record) => (
        <Space>
          <Tooltip title="查看详情">
            <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewInstance(record.id)} />
          </Tooltip>
        </Space>
      ),
    },
  ];

  /* ==================== Render ==================== */

  return (
    <div style={{ padding: spacing.lg }}>
      <Title level={2} style={{ marginBottom: spacing.md }}>
        <ApartmentOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        流程引擎
      </Title>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'definitions',
            label: (
              <span><ApartmentOutlined /> 流程定义</span>
            ),
            children: (
              <Card>
                <Row justify="space-between" align="middle" style={{ marginBottom: spacing.md }}>
                  <Col>
                    <Space>
                      <Select
                        placeholder="实体类型"
                        allowClear
                        style={{ width: 140 }}
                        onChange={(v) => setDefFilter((f) => ({ ...f, entityType: v }))}
                        options={[
                          { label: '工单', value: 'ticket' },
                          { label: '变更', value: 'change' },
                          { label: '发布', value: 'release' },
                        ]}
                      />
                      <Select
                        placeholder="启用状态"
                        allowClear
                        style={{ width: 120 }}
                        onChange={(v) => setDefFilter((f) => ({ ...f, enabled: v }))}
                        options={[
                          { label: '启用', value: true },
                          { label: '禁用', value: false },
                        ]}
                      />
                    </Space>
                  </Col>
                  <Col>
                    <Space>
                      <Button icon={<ReloadOutlined />} onClick={fetchDefinitions}>刷新</Button>
                      <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateDef}>新建定义</Button>
                    </Space>
                  </Col>
                </Row>

                <Table
                  rowKey="id"
                  columns={defColumns}
                  dataSource={definitions}
                  loading={defLoading}
                  pagination={{
                    current: defPage,
                    total: defTotal,
                    pageSize: 20,
                    onChange: setDefPage,
                    showTotal: (t) => `共 ${t} 条`,
                  }}
                />
              </Card>
            ),
          },
          {
            key: 'instances',
            label: (
              <span><HistoryOutlined /> 流程实例</span>
            ),
            children: (
              <Card>
                <Row justify="space-between" align="middle" style={{ marginBottom: spacing.md }}>
                  <Col>
                    <Space>
                      <Select
                        placeholder="状态筛选"
                        allowClear
                        style={{ width: 140 }}
                        onChange={(v) => setInstFilter((f) => ({ ...f, status: v }))}
                        options={Object.entries(statusLabel).map(([k, v]) => ({ label: v, value: k }))}
                      />
                    </Space>
                  </Col>
                  <Col>
                    <Space>
                      <Button icon={<ReloadOutlined />} onClick={fetchInstances}>刷新</Button>
                      <Button type="primary" icon={<RocketOutlined />} onClick={() => handleStartInstance()}>启动实例</Button>
                    </Space>
                  </Col>
                </Row>

                <Table
                  rowKey="id"
                  columns={instColumns}
                  dataSource={instances}
                  loading={instLoading}
                  pagination={{
                    current: instPage,
                    total: instTotal,
                    pageSize: 20,
                    onChange: setInstPage,
                    showTotal: (t) => `共 ${t} 条`,
                  }}
                />
              </Card>
            ),
          },
        ]}
      />

      {/* ==================== Definition Form Modal ==================== */}
      <Modal
        title={editingDef ? '编辑流程定义' : '新建流程定义'}
        open={defModalOpen}
        onOk={handleSaveDef}
        onCancel={() => setDefModalOpen(false)}
        confirmLoading={defModalLoading}
        width={640}
      >
        <Form form={defForm} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="输入流程定义名称" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={2} placeholder="输入描述" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="entityType" label="实体类型" rules={[{ required: true, message: '请选择实体类型' }]}>
                <Select
                  placeholder="选择实体类型"
                  options={[
                    { label: '工单', value: 'ticket' },
                    { label: '变更', value: 'change' },
                    { label: '发布', value: 'release' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="enabled" label="启用" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="流程步骤">
            <Form.List name="steps">
              {(fields, { add, remove }) => (
                <>
                  {fields.map((field, index) => (
                    <Row key={field.key} gutter={8} style={{ marginBottom: 8 }}>
                      <Col span={8}>
                        <Form.Item name={[field.name, 'name']} noStyle>
                          <Input placeholder={`步骤 ${index + 1} 名称`} />
                        </Form.Item>
                      </Col>
                      <Col span={6}>
                        <Form.Item name={[field.name, 'type']} noStyle>
                          <Select
                            placeholder="类型"
                            options={Object.entries(stepTypeLabel).map(([k, v]) => ({ label: v, value: k }))}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item name={[field.name, 'handler']} noStyle>
                          <Input placeholder="处理器 (可选)" />
                        </Form.Item>
                      </Col>
                      <Col span={2}>
                        {fields.length > 1 && (
                          <Button type="link" danger icon={<DeleteOutlined />} onClick={() => remove(field.name)} />
                        )}
                      </Col>
                    </Row>
                  ))}
                  <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add()}>
                    添加步骤
                  </Button>
                </>
              )}
            </Form.List>
          </Form.Item>
        </Form>
      </Modal>

      {/* ==================== Start Instance Modal ==================== */}
      <Modal
        title="启动流程实例"
        open={startModalOpen}
        onOk={handleConfirmStart}
        onCancel={() => setStartModalOpen(false)}
        confirmLoading={startModalLoading}
      >
        <Form form={startForm} layout="vertical">
          <Form.Item name="definitionId" label="流程定义" rules={[{ required: true, message: '请选择流程定义' }]}>
            <Select
              placeholder="选择流程定义"
              showSearch
              optionFilterProp="label"
              options={definitions.map((d) => ({ label: d.name, value: d.id }))}
            />
          </Form.Item>
          <Form.Item name="entityType" label="实体类型">
            <Select
              placeholder="选择实体类型"
              options={[
                { label: '工单', value: 'ticket' },
                { label: '变更', value: 'change' },
                { label: '发布', value: 'release' },
              ]}
            />
          </Form.Item>
          <Form.Item name="entityId" label="实体ID">
            <Input placeholder="输入关联实体ID" />
          </Form.Item>
        </Form>
      </Modal>

      {/* ==================== Instance Detail Drawer ==================== */}
      <Drawer
        title="流程实例详情"
        open={detailDrawerOpen}
        onClose={() => setDetailDrawerOpen(false)}
        width={600}
      >
        {detailInstance && (
          <>
            <Descriptions column={2} bordered size="small" style={{ marginBottom: spacing.md }}>
              <Descriptions.Item label="实例ID">{detailInstance.id}</Descriptions.Item>
              <Descriptions.Item label="定义ID">{detailInstance.definitionId}</Descriptions.Item>
              <Descriptions.Item label="实体类型">{detailInstance.entityType}</Descriptions.Item>
              <Descriptions.Item label="实体ID">{detailInstance.entityId}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={statusColor[detailInstance.status]}>
                  {statusLabel[detailInstance.status] || detailInstance.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="当前步骤">{detailInstance.currentStepId || '-'}</Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {dayjs(detailInstance.createdAt).format('YYYY-MM-DD HH:mm')}
              </Descriptions.Item>
              <Descriptions.Item label="完成时间">
                {detailInstance.completedAt ? dayjs(detailInstance.completedAt).format('YYYY-MM-DD HH:mm') : '-'}
              </Descriptions.Item>
            </Descriptions>

            <Title level={4} style={{ marginBottom: spacing.sm }}>
              <HistoryOutlined style={{ marginRight: 8 }} /> 步骤历史
            </Title>

            {stepLoading ? (
              <div style={{ textAlign: 'center', padding: 40 }}>加载中...</div>
            ) : stepHistory.length === 0 ? (
              <Empty description="暂无步骤记录" />
            ) : (
              <Timeline
                items={stepHistory.map((step) => {
                  const canAdvance = !['success', 'failed', 'close', 'skip', 'aborted', 'rejected'].includes(step.status);
                  const allowedActions = getAllowedActions(step.status);

                  return {
                    color: getTimelineColor(step.status),
                    children: (
                      <div key={step.id}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Space>
                            <Text strong>{step.stepName}</Text>
                            <Tag color={statusColor[step.status]}>
                              {statusLabel[step.status] || step.status}
                            </Tag>
                            {step.stepType && <Tag>{stepTypeLabel[step.stepType] || step.stepType}</Tag>}
                          </Space>
                          {canAdvance && allowedActions.length > 0 && (
                            <Space size={4}>
                              {allowedActions.map((action) => (
                                <Tooltip key={action} title={actionLabel[action]}>
                                  <Button
                                    size="small"
                                    type={action === 'success' ? 'primary' : action === 'failed' ? 'primary' : 'default'}
                                    danger={action === 'failed' || action === 'aborted' || action === 'rejected'}
                                    icon={actionIcon[action]}
                                    onClick={() => handleAdvanceStep(detailInstance.id, step.stepId, action)}
                                  >
                                    {actionLabel[action]}
                                  </Button>
                                </Tooltip>
                              ))}
                            </Space>
                          )}
                        </div>
                        {step.operator && <Text type="secondary" style={{ fontSize: 12 }}>操作人: {step.operator}</Text>}
                        {step.comment && <div><Text type="secondary" style={{ fontSize: 12 }}>备注: {step.comment}</Text></div>}
                        {step.startedAt && (
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            开始: {dayjs(step.startedAt).format('HH:mm:ss')}
                            {step.completedAt && ` | 完成: ${dayjs(step.completedAt).format('HH:mm:ss')}`}
                          </Text>
                        )}
                      </div>
                    ),
                  };
                })}
              />
            )}
          </>
        )}
      </Drawer>

      {/* ==================== Definition Detail Drawer ==================== */}
      <Drawer
        title="流程定义详情"
        open={defDetailOpen}
        onClose={() => setDefDetailOpen(false)}
        width={560}
      >
        {defDetail && (
          <>
            <Descriptions column={2} bordered size="small" style={{ marginBottom: spacing.md }}>
              <Descriptions.Item label="名称">{defDetail.name}</Descriptions.Item>
              <Descriptions.Item label="版本">v{defDetail.version}</Descriptions.Item>
              <Descriptions.Item label="实体类型">{defDetail.entityType}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Badge status={defDetail.enabled ? 'success' : 'default'} text={defDetail.enabled ? '启用' : '禁用'} />
              </Descriptions.Item>
              <Descriptions.Item label="描述" span={2}>{defDetail.description || '-'}</Descriptions.Item>
              <Descriptions.Item label="创建时间" span={2}>
                {dayjs(defDetail.createdAt).format('YYYY-MM-DD HH:mm')}
              </Descriptions.Item>
            </Descriptions>

            <Title level={4} style={{ marginBottom: spacing.sm }}>
              <ApartmentOutlined style={{ marginRight: 8 }} /> 流程步骤
            </Title>

            {defDetail.steps.length === 0 ? (
              <Empty description="暂无步骤" />
            ) : (
              <Timeline
                items={defDetail.steps.map((step) => ({
                  children: (
                    <div key={step.id}>
                      <Text strong>{step.name}</Text>
                      {step.type && <Tag style={{ marginLeft: 8 }}>{stepTypeLabel[step.type] || step.type}</Tag>}
                      {step.handler && <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>处理器: {step.handler}</Text>}
                    </div>
                  ),
                }))}
              />
            )}

            <div style={{ marginTop: spacing.md }}>
              <Space>
                <Button type="primary" icon={<RocketOutlined />} onClick={() => { setDefDetailOpen(false); handleStartInstance(defDetail.id); }}>
                  启动实例
                </Button>
                <Button icon={<EditOutlined />} onClick={() => { setDefDetailOpen(false); handleEditDef(defDetail); }}>
                  编辑
                </Button>
              </Space>
            </div>
          </>
        )}
      </Drawer>
    </div>
  );
}

/* ==================== Helpers ==================== */

function getAllowedActions(status: string): string[] {
  const transitions: Record<string, string[]> = {
    draft: ['pending', 'aborted'],
    pending: ['running', 'rejected'],
    running: ['success', 'failed', 'paused', 'wait', 'retry'],
    success: ['close'],
    failed: ['retry', 'close'],
    paused: ['running', 'aborted'],
    aborted: ['close'],
    wait: ['running'],
    retry: ['running', 'failed'],
    rejected: ['pending', 'close'],
  };
  return transitions[status] || [];
}

function getTimelineColor(status: string): string {
  if (status === 'success' || status === 'completed') return 'green';
  if (status === 'failed' || status === 'rejected') return 'red';
  if (status === 'running' || status === 'pending') return 'blue';
  if (status === 'paused' || status === 'wait') return 'orange';
  return 'gray';
}
