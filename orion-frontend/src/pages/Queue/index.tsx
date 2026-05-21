/**
 * Queue Management Page
 * Queue job monitoring, enqueue/dequeue operations, and statistics
 */
import React, { useState, useEffect, useMemo } from 'react';
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
  Popconfirm,
  Drawer,
  Descriptions,
  Tooltip,
  Statistic,
  Row,
  Col,
  Table as AntTable,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  EyeOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  InboxOutlined,
} from '@ant-design/icons';
import {
  listJobs,
  enqueueJob,
  dequeueJob,
  completeJob,
  failJob,
  getQueueStats,
  type QueueJob,
  type JobStatus,
  type EnqueueInput,
  type QueueStats,
} from '@/api/queue';
import { colors } from '@/tokens/colors';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;

// ---- Color maps ----

const statusColorMap: Record<JobStatus, string> = {
  pending: 'processing',
  processing: 'warning',
  completed: 'success',
  failed: 'error',
};

const statusLabelMap: Record<JobStatus, string> = {
  pending: '等待中',
  processing: '处理中',
  completed: '已完成',
  failed: '已失败',
};

const statusIconMap: Record<JobStatus, React.ReactNode> = {
  pending: <ClockCircleOutlined />,
  processing: <SyncOutlined spin />,
  completed: <CheckCircleOutlined />,
  failed: <CloseCircleOutlined />,
};

const formatPayload = (payload: Record<string, any>): string => {
  return JSON.stringify(payload, null, 2);
};

// ---- Main Component ----

const QueueManagement: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState<QueueJob[]>([]);
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [queueFilter, setQueueFilter] = useState<string>('all');
  const [enqueueModalVisible, setEnqueueModalVisible] = useState(false);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedJob, setSelectedJob] = useState<QueueJob | null>(null);
  const [dequeueModalVisible, setDequeueModalVisible] = useState(false);
  const [enqueueForm] = Form.useForm();
  const [dequeueForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const params: { status?: JobStatus; queue?: string } = {};
      if (statusFilter !== 'all') params.status = statusFilter as JobStatus;
      if (queueFilter !== 'all') params.queue = queueFilter;
      const res = await listJobs(params);
      const jobsData = res.data?.data?.jobs;
      setJobs(Array.isArray(jobsData) ? jobsData : []);
    } catch (error: unknown) {
      setJobs([]);
      message.error(`加载任务数据失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const res = await getQueueStats();
      setStats(res.data?.data || null);
    } catch (error: unknown) {
      setStats(null);
    }
  };

  useEffect(() => {
    loadData();
    loadStats();
  }, [statusFilter, queueFilter]);

  // Extract unique queue names from jobs
  const queueNames = useMemo(() => {
    const names = new Set<string>();
    jobs.forEach((j) => names.add(j.queue));
    return Array.from(names);
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    return jobs;
  }, [jobs]);

  const handleEnqueue = async () => {
    try {
      const values = await enqueueForm.validateFields();
      setSubmitting(true);
      const payload: EnqueueInput = {
        tenantId: values.tenantId,
        payload: JSON.parse(values.payload),
      };
      await enqueueJob(values.queueName, payload);
      message.success('任务入队成功');
      setEnqueueModalVisible(false);
      enqueueForm.resetFields();
      loadData();
      loadStats();
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('JSON')) {
        message.error('Payload 格式错误，请输入有效的 JSON');
      } else if (err instanceof Error) {
        message.error(`入队失败：${err.message}`);
      } else {
        message.error('入队失败');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDequeue = async () => {
    try {
      const values = await dequeueForm.validateFields();
      setSubmitting(true);
      const res = await dequeueJob(values.queueName, {
        limit: values.limit ? parseInt(values.limit) : 1,
      });
      const count = res.data?.data?.count || 0;
      message.success(`出队成功，获取 ${count} 个任务`);
      setDequeueModalVisible(false);
      dequeueForm.resetFields();
      loadData();
      loadStats();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`出队失败：${error.message}`);
      } else {
        message.error('出队失败');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleComplete = async (id: string) => {
    try {
      await completeJob(id);
      message.success('任务已标记为完成');
      loadData();
      loadStats();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`操作失败：${error.message}`);
      } else {
        message.error('操作失败');
      }
    }
  };

  const handleFail = async (id: string) => {
    try {
      await failJob(id);
      message.success('任务已标记为失败');
      loadData();
      loadStats();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`操作失败：${error.message}`);
      } else {
        message.error('操作失败');
      }
    }
  };

  const openDetail = (job: QueueJob) => {
    setSelectedJob(job);
    setDetailDrawerVisible(true);
  };

  const openEnqueue = () => {
    setEnqueueModalVisible(true);
  };

  const openDequeue = () => {
    setDequeueModalVisible(true);
  };

  // ---- Table columns ----

  const columns = [
    {
      title: '任务 ID',
      dataIndex: 'id',
      key: 'id',
      width: 120,
      render: (v: string) => (
        <Text code style={{ fontSize: 12 }}>
          {v}
        </Text>
      ),
    },
    {
      title: '队列名称',
      dataIndex: 'queue',
      key: 'queue',
      width: 150,
      render: (v: string) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: JobStatus) => (
        <Tag color={statusColorMap[v]} icon={statusIconMap[v]}>
          {statusLabelMap[v]}
        </Tag>
      ),
    },
    {
      title: '重试次数',
      dataIndex: 'attempts',
      key: 'attempts',
      width: 80,
      render: (v: number) => <Text type={v > 2 ? 'danger' : 'secondary'}>{v}</Text>,
    },
    {
      title: 'Payload',
      dataIndex: 'payload',
      key: 'payload',
      ellipsis: true,
      render: (v: Record<string, any>) => (
        <Text type="secondary" style={{ fontSize: 12, fontFamily: 'monospace' }}>
          {JSON.stringify(v).substring(0, 60)}...
        </Text>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 140,
      render: (v: string) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {dayjs(v).fromNow()}
        </Text>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      render: (_: unknown, record: QueueJob) => (
        <Space size="small" wrap>
          <Tooltip title="详情">
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => openDetail(record)}
            >
              详情
            </Button>
          </Tooltip>
          {record.status === 'processing' && (
            <>
              <Tooltip title="标记完成">
                <Popconfirm title="确认标记为完成?" onConfirm={() => handleComplete(record.id)}>
                  <Button type="link" size="small" icon={<CheckCircleOutlined />} />
                </Popconfirm>
              </Tooltip>
              <Tooltip title="标记失败">
                <Popconfirm title="确认标记为失败?" onConfirm={() => handleFail(record.id)}>
                  <Button type="link" size="small" danger icon={<CloseCircleOutlined />} />
                </Popconfirm>
              </Tooltip>
            </>
          )}
          {record.status === 'failed' && record.attempts < 5 && (
            <Tooltip title="重新入队">
              <Button
                type="link"
                size="small"
                icon={<SyncOutlined />}
                onClick={() => {
                  message.info('重新入队功能需要后端支持重试队列');
                }}
              >
                重试
              </Button>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 0 }}>
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
          <Title level={2} style={{ marginBottom: 8 }}>
            <InboxOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            队列管理
          </Title>
          <Text type="secondary">管理异步任务队列，监控任务执行状态</Text>
        </div>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              loadData();
              loadStats();
            }}
            loading={loading}
          >
            刷新
          </Button>
          <Button icon={<InboxOutlined />} onClick={openDequeue}>
            出队
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openEnqueue}>
            入队
          </Button>
        </Space>
      </div>

      {/* Stats Panel */}
      {stats && (
        <Card size="small" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col span={6}>
              <Statistic
                title="等待中"
                value={stats.pending}
                prefix={<ClockCircleOutlined />}
                valueStyle={{ color: colors.primary[500] }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="处理中"
                value={stats.processing}
                prefix={<SyncOutlined spin />}
                valueStyle={{ color: colors.warning[500] }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="已完成"
                value={stats.completed}
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: colors.success[500] }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="已失败"
                value={stats.failed}
                prefix={<CloseCircleOutlined />}
                valueStyle={{ color: colors.error[400] }}
              />
            </Col>
          </Row>
        </Card>
      )}

      {/* Filter bar */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space>
          <Text>状态筛选:</Text>
          <Select
            style={{ width: 120 }}
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { label: '全部', value: 'all' },
              { label: '等待中', value: 'pending' },
              { label: '处理中', value: 'processing' },
              { label: '已完成', value: 'completed' },
              { label: '已失败', value: 'failed' },
            ]}
          />
          <Text style={{ marginLeft: 16 }}>队列筛选:</Text>
          <Select
            style={{ width: 160 }}
            value={queueFilter}
            onChange={setQueueFilter}
            options={[
              { label: '全部', value: 'all' },
              ...queueNames.map((n) => ({ label: n, value: n })),
            ]}
          />
        </Space>
      </Card>

      {/* Job List */}
      <Card>
        <AntTable
          columns={columns}
          dataSource={filteredJobs}
          loading={loading}
          rowKey="id"
          size="middle"
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total: number) => `共 ${total} 个任务`,
          }}
        />
      </Card>

      {/* Enqueue Modal */}
      <Modal
        title="任务入队"
        open={enqueueModalVisible}
        onCancel={() => setEnqueueModalVisible(false)}
        onOk={handleEnqueue}
        confirmLoading={submitting}
        width={560}
        destroyOnClose
      >
        <Form form={enqueueForm} layout="vertical">
          <Form.Item
            name="queueName"
            label="队列名称"
            rules={[{ required: true, message: '请输入队列名称' }]}
          >
            <Select
              placeholder="选择或输入队列名称"
              options={[
                { label: 'pipeline-execution', value: 'pipeline-execution' },
                { label: 'deployment', value: 'deployment' },
                { label: 'notification', value: 'notification' },
                { label: 'artifact-scan', value: 'artifact-scan' },
              ]}
              mode="tags"
              maxCount={1}
            />
          </Form.Item>
          <Form.Item
            name="tenantId"
            label="租户 ID"
            rules={[{ required: true, message: '请输入租户 ID' }]}
          >
            <Input placeholder="tenant-1" />
          </Form.Item>
          <Form.Item
            name="payload"
            label="Payload (JSON)"
            rules={[
              { required: true, message: '请输入 Payload' },
              {
                validator: (_, value) => {
                  if (!value) return Promise.resolve();
                  try {
                    JSON.parse(value);
                    return Promise.resolve();
                  } catch {
                    return Promise.reject(new Error('请输入有效的 JSON'));
                  }
                },
              },
            ]}
          >
            <Input.TextArea
              rows={6}
              placeholder='{"pipelineId": "pipe-101", "action": "build"}'
              style={{ fontFamily: 'monospace' }}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Dequeue Modal */}
      <Modal
        title="任务出队"
        open={dequeueModalVisible}
        onCancel={() => setDequeueModalVisible(false)}
        onOk={handleDequeue}
        confirmLoading={submitting}
        width={480}
        destroyOnClose
      >
        <Form form={dequeueForm} layout="vertical">
          <Form.Item
            name="queueName"
            label="队列名称"
            rules={[{ required: true, message: '请选择队列名称' }]}
          >
            <Select
              placeholder="选择队列"
              options={[
                { label: 'pipeline-execution', value: 'pipeline-execution' },
                { label: 'deployment', value: 'deployment' },
                { label: 'notification', value: 'notification' },
                { label: 'artifact-scan', value: 'artifact-scan' },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="limit"
            label="出队数量"
            rules={[{ required: true, message: '请输入出队数量' }]}
            initialValue="1"
          >
            <Input type="number" min={1} max={100} placeholder="1" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Detail Drawer */}
      <Drawer
        title="任务详情"
        open={detailDrawerVisible}
        onClose={() => setDetailDrawerVisible(false)}
        width={700}
        destroyOnClose
      >
        {selectedJob && (
          <div>
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="任务 ID" span={2}>
                <Text code>{selectedJob.id}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="队列名称">
                <Tag color="blue">{selectedJob.queue}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag
                  color={statusColorMap[selectedJob.status]}
                  icon={statusIconMap[selectedJob.status]}
                >
                  {statusLabelMap[selectedJob.status]}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="租户 ID">{selectedJob.tenant_id}</Descriptions.Item>
              <Descriptions.Item label="重试次数">{selectedJob.attempts}</Descriptions.Item>
              <Descriptions.Item label="创建时间" span={2}>
                {dayjs(selectedJob.created_at).format('YYYY-MM-DD HH:mm:ss')}
                <Text type="secondary" style={{ marginLeft: 8 }}>
                  ({dayjs(selectedJob.created_at).fromNow()})
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="Payload" span={2}>
                <pre
                  style={{
                    background: colors.neutral[100],
                    padding: 12,
                    borderRadius: 4,
                    fontSize: 12,
                    fontFamily: 'monospace',
                    maxHeight: 300,
                    overflow: 'auto',
                    margin: 0,
                  }}
                >
                  {formatPayload(selectedJob.payload)}
                </pre>
              </Descriptions.Item>
            </Descriptions>

            {/* Action buttons for processing jobs */}
            {selectedJob.status === 'processing' && (
              <div style={{ marginTop: 16 }}>
                <Space>
                  <Popconfirm
                    title="确认标记为完成?"
                    onConfirm={() => {
                      handleComplete(selectedJob.id);
                      setDetailDrawerVisible(false);
                    }}
                  >
                    <Button type="primary" icon={<CheckCircleOutlined />}>
                      标记完成
                    </Button>
                  </Popconfirm>
                  <Popconfirm
                    title="确认标记为失败?"
                    onConfirm={() => {
                      handleFail(selectedJob.id);
                      setDetailDrawerVisible(false);
                    }}
                  >
                    <Button danger icon={<CloseCircleOutlined />}>
                      标记失败
                    </Button>
                  </Popconfirm>
                </Space>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default QueueManagement;
