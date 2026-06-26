/**
 * Runbook Management Page
 *
 * Features:
 * - Runbook definition CRUD
 * - Runbook execution and history
 * - Step-by-step execution tracking
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
  Timeline,
  Empty,
  Tabs,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  HistoryOutlined,
  BookOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { colors, spacing } from '@/tokens';
import {
  listRunbooks,
  createRunbook,
  updateRunbook,
  deleteRunbook,
  executeRunbook,
  getExecutionHistory,
  type RunbookDefinition,
  type RunbookExecution,
  type CreateRunbookInput,
} from '@/api/runbooks';

const { Title, Text } = Typography;
const { TextArea } = Input;

const statusColor: Record<string, string> = {
  pending: colors.neutral[400],
  running: colors.primary[500],
  completed: colors.success[500],
  failed: colors.error[500],
  cancelled: colors.warning[500],
  skipped: colors.neutral[300],
};

const statusLabel: Record<string, string> = {
  pending: '待执行',
  running: '执行中',
  completed: '已完成',
  failed: '失败',
  cancelled: '已取消',
  skipped: '已跳过',
};

export default function RunbookManagementPage() {
  const [runbooks, setRunbooks] = useState<RunbookDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRunbook, setEditingRunbook] = useState<RunbookDefinition | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [selectedRunbook, setSelectedRunbook] = useState<RunbookDefinition | null>(null);
  const [executions, setExecutions] = useState<RunbookExecution[]>([]);
  const [executionDrawerVisible, setExecutionDrawerVisible] = useState(false);
  const [selectedExecution, setSelectedExecution] = useState<RunbookExecution | null>(null);
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState('definitions');

  const fetchRunbooks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listRunbooks();
      setRunbooks(res.data ?? []);
    } catch {
      message.error('获取 Runbook 列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRunbooks();
  }, [fetchRunbooks]);

  const handleCreate = () => {
    setEditingRunbook(null);
    form.resetFields();
    form.setFieldsValue({ steps: [{}] });
    setModalVisible(true);
  };

  const handleEdit = (record: RunbookDefinition) => {
    setEditingRunbook(record);
    form.setFieldsValue({
      name: record.name,
      description: record.description,
      category: record.category,
      steps: record.steps,
      enabled: record.enabled,
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const input: CreateRunbookInput = {
        name: values.name,
        description: values.description,
        category: values.category,
        steps: values.steps ?? [],
        enabled: values.enabled ?? true,
      };
      if (editingRunbook) {
        await updateRunbook(editingRunbook.id, input);
        message.success('Runbook 更新成功');
      } else {
        await createRunbook(input);
        message.success('Runbook 创建成功');
      }
      setModalVisible(false);
      fetchRunbooks();
    } catch {
      message.error('保存失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteRunbook(id);
      message.success('删除成功');
      fetchRunbooks();
    } catch {
      message.error('删除失败');
    }
  };

  const handleExecute = async (id: string) => {
    try {
      await executeRunbook(id, { triggeredBy: 'ui' });
      message.success('Runbook 执行已启动');
      fetchRunbooks();
    } catch {
      message.error('执行失败');
    }
  };

  const handleViewDetail = async (record: RunbookDefinition) => {
    setSelectedRunbook(record);
    setDrawerVisible(true);
    try {
      const res = await getExecutionHistory(record.id, { limit: 20 });
      setExecutions(res.data ?? []);
    } catch {
      // ignore
    }
  };

  const handleViewExecution = async (execution: RunbookExecution) => {
    setSelectedExecution(execution);
    setExecutionDrawerVisible(true);
  };

  const columns: ColumnsType<RunbookDefinition> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record) => (
        <a onClick={() => handleViewDetail(record)}>{text}</a>
      ),
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      render: (text: string) => <Tag>{text}</Tag>,
    },
    {
      title: '步骤数',
      key: 'steps',
      render: (_, record) => record.steps?.length ?? 0,
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
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<PlayCircleOutlined />}
            onClick={() => handleExecute(record.id)}
            disabled={!record.enabled}
          >
            执行
          </Button>
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm title="确认删除？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const executionColumns: ColumnsType<RunbookExecution> = [
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={statusColor[status]}>{statusLabel[status] ?? status}</Tag>
      ),
    },
    {
      title: '触发者',
      dataIndex: 'triggeredBy',
      key: 'triggeredBy',
    },
    {
      title: '当前步骤',
      dataIndex: 'currentStepIndex',
      key: 'currentStepIndex',
    },
    {
      title: '开始时间',
      dataIndex: 'startedAt',
      key: 'startedAt',
      render: (text: string) => dayjs(text).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Button type="link" icon={<HistoryOutlined />} onClick={() => handleViewExecution(record)}>
          详情
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: spacing.lg }}>
      <Title level={2} style={{ marginBottom: spacing.md }}>
        <BookOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        Runbook 管理
      </Title>

      <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
        {
          key: 'definitions',
          label: 'Runbook 定义',
          children: (
            <Card>
              <Row justify="space-between" style={{ marginBottom: spacing.md }}>
                <Col>
                  <Button icon={<ReloadOutlined />} onClick={fetchRunbooks}>
                    刷新
                  </Button>
                </Col>
                <Col>
                  <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
                    创建 Runbook
                  </Button>
                </Col>
              </Row>
              <Table
                columns={columns}
                dataSource={runbooks}
                rowKey="id"
                loading={loading}
                pagination={{ pageSize: 20 }}
              />
            </Card>
          ),
        },
      ]} />

      {/* Create/Edit Modal */}
      <Modal
        title={editingRunbook ? '编辑 Runbook' : '创建 Runbook'}
        open={modalVisible}
        onOk={handleSave}
        onCancel={() => setModalVisible(false)}
        width={700}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="输入 Runbook 名称" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={2} placeholder="输入描述" />
          </Form.Item>
          <Form.Item name="category" label="分类" rules={[{ required: true, message: '请选择分类' }]}>
            <Select placeholder="选择分类">
              <Select.Option value="incident">故障处理</Select.Option>
              <Select.Option value="deployment">部署运维</Select.Option>
              <Select.Option value="maintenance">日常维护</Select.Option>
              <Select.Option value="security">安全响应</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      {/* Detail Drawer */}
      <Drawer
        title={selectedRunbook?.name}
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={600}
      >
        {selectedRunbook && (
          <>
            <Descriptions column={1} bordered size="small" style={{ marginBottom: spacing.md }}>
              <Descriptions.Item label="分类">{selectedRunbook.category}</Descriptions.Item>
              <Descriptions.Item label="描述">{selectedRunbook.description ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={selectedRunbook.enabled ? 'green' : 'default'}>
                  {selectedRunbook.enabled ? '启用' : '禁用'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="步骤数">{selectedRunbook.steps?.length ?? 0}</Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {dayjs(selectedRunbook.createdAt).format('YYYY-MM-DD HH:mm')}
              </Descriptions.Item>
            </Descriptions>

            <Title level={4}>执行历史</Title>
            {executions.length === 0 ? (
              <Empty description="暂无执行记录" />
            ) : (
              <Table
                columns={executionColumns}
                dataSource={executions}
                rowKey="id"
                size="small"
                pagination={false}
              />
            )}
          </>
        )}
      </Drawer>

      {/* Execution Detail Drawer */}
      <Drawer
        title="执行详情"
        open={executionDrawerVisible}
        onClose={() => setExecutionDrawerVisible(false)}
        width={500}
      >
        {selectedExecution && (
          <>
            <Descriptions column={1} bordered size="small" style={{ marginBottom: spacing.md }}>
              <Descriptions.Item label="状态">
                <Tag color={statusColor[selectedExecution.status]}>
                  {statusLabel[selectedExecution.status]}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="触发者">{selectedExecution.triggeredBy}</Descriptions.Item>
              <Descriptions.Item label="开始时间">
                {dayjs(selectedExecution.startedAt).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
              {selectedExecution.completedAt && (
                <Descriptions.Item label="完成时间">
                  {dayjs(selectedExecution.completedAt).format('YYYY-MM-DD HH:mm:ss')}
                </Descriptions.Item>
              )}
            </Descriptions>

            <Title level={4}>步骤执行结果</Title>
            <Timeline
              items={selectedExecution.stepResults?.map((step, index) => ({
                color: statusColor[step.status] ?? colors.neutral[400],
                children: (
                  <div>
                    <Text strong>步骤 {index + 1}</Text>
                    <br />
                    <Tag color={statusColor[step.status]} style={{ fontSize: 12 }}>
                      {statusLabel[step.status]}
                    </Tag>
                    {step.output && <Text type="secondary" style={{ display: 'block', marginTop: 4 }}>{step.output}</Text>}
                    {step.error && <Text type="danger" style={{ display: 'block', marginTop: 4 }}>{step.error}</Text>}
                  </div>
                ),
              }))}
            />
          </>
        )}
      </Drawer>
    </div>
  );
}
