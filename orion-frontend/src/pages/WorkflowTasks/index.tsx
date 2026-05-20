/**
 * Workflow Tasks Page
 * 工作流人工任务管理页面
 * List, claim, complete, view detail
 */
import React, { useState, useMemo, useEffect } from 'react';
import {
  Typography,
  Button,
  Space,
  Tag,
  Card,
  Modal,
  Form,
  Input,
  Select,
  message,
  Descriptions,
  Drawer,
  Tooltip,
  Empty,
} from 'antd';
import {
  ReloadOutlined,
  CheckOutlined,
  EyeOutlined,
  ClockCircleOutlined,
  UserOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  SendOutlined,
} from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import PageSkeleton from '@/components/PageSkeleton';
import {
  getTasks,
  getTask,
  claimTask,
  completeTask,
  type WorkflowTask,
  type TaskStatus,
} from '@/api/workflow-task';
import { colors } from '@/tokens/colors';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Title, Text, Paragraph } = Typography;

// ---- Color maps ----

const statusColorMap: Record<TaskStatus, string> = {
  pending: 'processing',
  assigned: 'warning',
  completed: 'success',
  cancelled: 'default',
};

const statusLabelMap: Record<TaskStatus, string> = {
  pending: '待认领',
  assigned: '已认领',
  completed: '已完成',
  cancelled: '已取消',
};

const priorityColorMap: Record<string, string> = {
  low: 'default',
  normal: 'blue',
  high: 'orange',
  urgent: 'red',
};

const priorityLabelMap: Record<string, string> = {
  low: '低',
  normal: '普通',
  high: '高',
  urgent: '紧急',
};

// ---- Main Component ----

const WorkflowTasksPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<WorkflowTask[]>([]);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedTask, setSelectedTask] = useState<WorkflowTask | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Claim modal
  const [claimModalVisible, setClaimModalVisible] = useState(false);
  const [claimTaskId, setClaimTaskId] = useState('');
  const [claimForm] = Form.useForm();
  const [claimSubmitting, setClaimSubmitting] = useState(false);

  // Complete modal
  const [completeModalVisible, setCompleteModalVisible] = useState(false);
  const [completeTaskId, setCompleteTaskId] = useState('');
  const [completeForm] = Form.useForm();
  const [completeSubmitting, setCompleteSubmitting] = useState(false);

  // Current user (mock)
  const [currentUserId] = useState('current-user');

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getTasks();
      const list = res.data;
      setTasks(Array.isArray(list) ? list : []);
    } catch (error: unknown) {
      setTasks([]);
      message.error(`加载任务数据失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredTasks = useMemo(() => {
    if (statusFilter === 'all') return tasks;
    return tasks.filter((t) => t.status === statusFilter);
  }, [statusFilter, tasks]);

  const stats = useMemo(
    () => ({
      total: tasks.length,
      pending: tasks.filter((t) => t.status === 'pending').length,
      assigned: tasks.filter((t) => t.status === 'assigned').length,
      completed: tasks.filter((t) => t.status === 'completed').length,
    }),
    [tasks]
  );

  // ---- Handlers ----

  const handleClaim = async () => {
    try {
      const values = await claimForm.validateFields();
      setClaimSubmitting(true);
      await claimTask(claimTaskId, { comment: values.comment });
      message.success('任务认领成功');
      setClaimModalVisible(false);
      claimForm.resetFields();
      loadData();
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        if (error instanceof Error) {
          message.error(`认领失败：${error.message}`);
        } else {
          message.error('认领失败');
        }
      }
    } finally {
      setClaimSubmitting(false);
    }
  };

  const handleComplete = async () => {
    try {
      const values = await completeForm.validateFields();
      setCompleteSubmitting(true);
      const result = await completeTask(completeTaskId, {
        comment: values.comment,
        formData: values.formData ? JSON.parse(values.formData) : undefined,
      });
      if (result.warning) {
        message.warning(result.warning);
      } else {
        message.success('任务完成');
      }
      setCompleteModalVisible(false);
      completeForm.resetFields();
      loadData();
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        if (error instanceof Error) {
          message.error(`完成失败：${error.message}`);
        } else {
          message.error('完成失败');
        }
      }
    } finally {
      setCompleteSubmitting(false);
    }
  };

  const openClaimModal = (taskId: string) => {
    setClaimTaskId(taskId);
    claimForm.resetFields();
    setClaimModalVisible(true);
  };

  const openCompleteModal = (taskId: string) => {
    setCompleteTaskId(taskId);
    completeForm.resetFields();
    setCompleteModalVisible(true);
  };

  const openDetail = async (task: WorkflowTask) => {
    setSelectedTask(task);
    setDetailDrawerVisible(true);

    // Refresh detail from API
    if (task.id) {
      setDetailLoading(true);
      try {
        const detail = await getTask(task.id);
        setSelectedTask(detail);
      } catch {
        // Keep existing data
      } finally {
        setDetailLoading(false);
      }
    }
  };

  // ---- Table columns ----

  const columns: TableColumn<WorkflowTask>[] = [
    {
      key: 'title',
      title: '任务标题',
      dataIndex: 'title',
      width: 280,
      render: (v: unknown, record: WorkflowTask) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ cursor: 'pointer' }} onClick={() => openDetail(record)}>
            {String(v)}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            实例: {record.instance_id.substring(0, 8)}... | 节点: {record.node_id}
          </Text>
        </Space>
      ),
    },
    {
      key: 'status',
      title: '状态',
      width: 100,
      render: (_: unknown, record: WorkflowTask) => (
        <Tag color={statusColorMap[record.status] || 'default'}>
          {statusLabelMap[record.status] || record.status}
        </Tag>
      ),
    },
    {
      key: 'priority',
      title: '优先级',
      width: 90,
      render: (_: unknown, record: WorkflowTask) => (
        <Tag color={priorityColorMap[record.priority] || 'default'}>
          {priorityLabelMap[record.priority] || record.priority}
        </Tag>
      ),
    },
    {
      key: 'assignee',
      title: '处理人',
      width: 120,
      render: (_: unknown, record: WorkflowTask) => (
        <Space>
          <UserOutlined style={{ color: colors.neutral[400] }} />
          <Text type="secondary">
            {record.assignee_id || (record.candidate_users?.join(', ') || '-')}
          </Text>
        </Space>
      ),
    },
    {
      key: 'dueDate',
      title: '截止时间',
      width: 140,
      render: (v: unknown) => {
        if (!v) return <Text type="secondary">-</Text>;
        const dueDate = dayjs(String(v));
        const isOverdue = dueDate.isBefore(dayjs());
        return (
          <Text type="secondary" style={{ color: isOverdue ? colors.error[500] : undefined }}>
            {dueDate.format('MM-DD HH:mm')}
            {isOverdue && ' (已逾期)'}
          </Text>
        );
      },
    },
    {
      key: 'createdAt',
      title: '创建时间',
      width: 140,
      render: (v: unknown) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {dayjs(String(v)).fromNow()}
        </Text>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      width: 180,
      render: (_: unknown, record: WorkflowTask) => (
        <Space size="small" wrap>
          <Tooltip title="详情">
            <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => openDetail(record)}>
              详情
            </Button>
          </Tooltip>
          {record.status === 'pending' && (
            <Tooltip title="认领任务">
              <Button
                type="link"
                size="small"
                style={{ color: colors.primary[500] }}
                icon={<CheckOutlined />}
                onClick={() => openClaimModal(record.id)}
              >
                认领
              </Button>
            </Tooltip>
          )}
          {record.status === 'assigned' && record.assignee_id === currentUserId && (
            <Tooltip title="完成任务">
              <Button
                type="link"
                size="small"
                style={{ color: colors.success[500] }}
                icon={<SendOutlined />}
                onClick={() => openCompleteModal(record.id)}
              >
                完成
              </Button>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  // ---- Detail Drawer Content ----

  const detailContent = useMemo(() => {
    if (!selectedTask) return null;
    const t = selectedTask;
    return (
      <div>
        <Descriptions column={2} bordered size="small">
          <Descriptions.Item label="任务标题" span={2}>
            {t.title}
          </Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={statusColorMap[t.status]}>{statusLabelMap[t.status]}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="优先级">
            <Tag color={priorityColorMap[t.priority]}>{priorityLabelMap[t.priority]}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="任务类型">{t.task_type === 'manual' ? '人工任务' : '系统任务'}</Descriptions.Item>
          <Descriptions.Item label="分配类型">{t.assignee_type === 'user' ? '用户' : '角色'}</Descriptions.Item>
          <Descriptions.Item label="处理人">{t.assignee_id || '-'}</Descriptions.Item>
          <Descriptions.Item label="候选用户">
            {t.candidate_users?.join(', ') || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="候选角色">
            {t.candidate_roles?.join(', ') || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="截止时间">
            {t.due_date ? dayjs(t.due_date).format('YYYY-MM-DD HH:mm:ss') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {dayjs(t.created_at).format('YYYY-MM-DD HH:mm:ss')}
          </Descriptions.Item>
          <Descriptions.Item label="更新时间" span={2}>
            {dayjs(t.updated_at).format('YYYY-MM-DD HH:mm:ss')} ({dayjs(t.updated_at).fromNow()})
          </Descriptions.Item>
          {t.description && (
            <Descriptions.Item label="描述" span={2}>
              <Paragraph style={{ marginBottom: 0 }}>{t.description}</Paragraph>
            </Descriptions.Item>
          )}
          {t.completed_at && (
            <>
              <Descriptions.Item label="完成时间">
                {dayjs(t.completed_at).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
              <Descriptions.Item label="完成人">{t.completed_by || '-'}</Descriptions.Item>
            </>
          )}
          {t.completion_comment && (
            <Descriptions.Item label="完成评论" span={2}>
              {t.completion_comment}
            </Descriptions.Item>
          )}
        </Descriptions>

        {/* Form Data */}
        {t.form_data && Object.keys(t.form_data).length > 0 && (
          <Card size="small" title="表单数据" style={{ marginTop: 16 }}>
            <Descriptions column={1} size="small">
              {Object.entries(t.form_data).map(([key, value]) => (
                <Descriptions.Item key={key} label={key}>
                  {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                </Descriptions.Item>
              ))}
            </Descriptions>
          </Card>
        )}

        {/* Action buttons */}
        {t.status === 'pending' && (
          <Space style={{ marginTop: 16 }}>
            <Button
              type="primary"
              icon={<CheckOutlined />}
              onClick={() => openClaimModal(t.id)}
            >
              认领任务
            </Button>
          </Space>
        )}
        {t.status === 'assigned' && (
          <Space style={{ marginTop: 16 }}>
            <Button
              type="primary"
              icon={<SendOutlined />}
              style={{ backgroundColor: colors.success[500], borderColor: colors.success[500] }}
              onClick={() => openCompleteModal(t.id)}
            >
              完成任务
            </Button>
          </Space>
        )}
      </div>
    );
  }, [selectedTask, currentUserId]);

  const isInitialLoading = loading && tasks.length === 0;

  return (
    <div style={{ padding: 0 }}>
      {/* Page loading skeleton (initial load) */}
      {isInitialLoading && <PageSkeleton rows={8} />}

      {isInitialLoading ? null : (
        <>
          {/* Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: 24,
            }}
          >
            <div>
              <Title level={3} style={{ margin: 0 }}>
                工作流任务
              </Title>
              <Text type="secondary">管理工作流中的人工任务，包括认领和完成</Text>
            </div>
            <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
              刷新
            </Button>
          </div>

          {/* Stats Panel */}
          <Card size="small" style={{ marginBottom: 16 }}>
            <Space size="large">
              <Space>
                <Text type="secondary">总计:</Text>
                <Text strong>{stats.total}</Text>
              </Space>
              <Space>
                <ClockCircleOutlined style={{ color: colors.primary[500] }} />
                <Text type="secondary">待认领:</Text>
                <Text strong style={{ color: colors.primary[500] }}>
                  {stats.pending}
                </Text>
              </Space>
              <Space>
                <ExclamationCircleOutlined style={{ color: colors.warning[500] }} />
                <Text type="secondary">已认领:</Text>
                <Text strong style={{ color: colors.warning[500] }}>
                  {stats.assigned}
                </Text>
              </Space>
              <Space>
                <CheckCircleOutlined style={{ color: colors.success[500] }} />
                <Text type="secondary">已完成:</Text>
                <Text strong style={{ color: colors.success[500] }}>
                  {stats.completed}
                </Text>
              </Space>
            </Space>
          </Card>

          {/* Filters */}
          <Card>
            <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
              <Select
                style={{ width: 140 }}
                value={statusFilter}
                onChange={(v) => setStatusFilter(v)}
                options={[
                  { label: '全部状态', value: 'all' },
                  { label: '待认领', value: 'pending' },
                  { label: '已认领', value: 'assigned' },
                  { label: '已完成', value: 'completed' },
                  { label: '已取消', value: 'cancelled' },
                ]}
              />
            </div>

            {/* Task Table */}
            {filteredTasks.length === 0 && !loading ? (
              <Empty description="暂无任务" />
            ) : (
              <Table
                columns={columns}
                dataSource={filteredTasks}
                loading={loading}
                rowKey="id"
                size="middle"
                striped
              />
            )}
          </Card>

          {/* Detail Drawer */}
          <Drawer
            title={selectedTask ? selectedTask.title : '任务详情'}
            open={detailDrawerVisible}
            onClose={() => setDetailDrawerVisible(false)}
            width={720}
            destroyOnClose
          >
            {detailLoading ? <PageSkeleton rows={6} /> : detailContent}
          </Drawer>

          {/* Claim Modal */}
          <Modal
            title="认领任务"
            open={claimModalVisible}
            onCancel={() => setClaimModalVisible(false)}
            onOk={handleClaim}
            confirmLoading={claimSubmitting}
            okText="确认认领"
            width={480}
            destroyOnClose
          >
            <div style={{ marginBottom: 16 }}>
              <Text type="secondary">
                确认要认领此任务吗？认领后您将成为该任务的处理人。
              </Text>
            </div>
            <Form form={claimForm} layout="vertical">
              <Form.Item name="comment" label="备注 (可选)">
                <Input.TextArea rows={3} placeholder="输入认领备注..." />
              </Form.Item>
            </Form>
          </Modal>

          {/* Complete Modal */}
          <Modal
            title="完成任务"
            open={completeModalVisible}
            onCancel={() => setCompleteModalVisible(false)}
            onOk={handleComplete}
            confirmLoading={completeSubmitting}
            okText="确认完成"
            okButtonProps={{ style: { backgroundColor: colors.success[500], borderColor: colors.success[500] } }}
            width={520}
            destroyOnClose
          >
            <div style={{ marginBottom: 16 }}>
              <Text type="secondary">
                完成任务后将唤醒挂起的工作流实例，请填写必要的表单数据。
              </Text>
            </div>
            <Form form={completeForm} layout="vertical">
              <Form.Item name="formData" label="表单数据 (JSON, 可选)">
                <Input.TextArea
                  rows={4}
                  placeholder='{"key": "value"}'
                />
              </Form.Item>
              <Form.Item name="comment" label="完成备注 (可选)">
                <Input.TextArea rows={3} placeholder="输入完成备注..." />
              </Form.Item>
            </Form>
          </Modal>
        </>
      )}
    </div>
  );
};

export default WorkflowTasksPage;