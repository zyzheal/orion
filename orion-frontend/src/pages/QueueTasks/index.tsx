/**
 * Queue Tasks Management Page
 *
 * Phase 2.3: Standalone queue task monitoring UI
 */
import React, { useEffect, useState } from 'react';
import {
  Table,
  Button,
  Tag,
  Space,
  Modal,
  Form,
  Input,
  Select,
  message,
  Card,
  Typography,
  Statistic,
  Row,
  Col,
  Badge,
} from 'antd';
import {
  PlusOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  StopOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { listJobs, enqueueJob, completeJob, failJob, getQueueStats, QueueJob, EnqueueInput, JobStatus, QueueStats } from '@/api/queue';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';

const { Title, Text } = Typography;

const statusColorMap: Record<JobStatus, string> = {
  pending: 'default',
  processing: 'processing',
  completed: 'success',
  failed: 'error',
};

const QueueTasksPage: React.FC = () => {
  const [jobs, setJobs] = useState<QueueJob[]>([]);
  const [stats, setStats] = useState<QueueStats>({ pending: 0, processing: 0, completed: 0, failed: 0 });
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [filterStatus, setFilterStatus] = useState<JobStatus | undefined>();
  const [form] = Form.useForm<EnqueueInput>();

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const res = await listJobs(filterStatus ? { status: filterStatus } : undefined);
      setJobs(res.data?.jobs || []);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await getQueueStats();
      setStats(res.data || { pending: 0, processing: 0, completed: 0, failed: 0 });
    } catch {
      // Stats endpoint may not be available
    }
  };

  useEffect(() => {
    fetchJobs();
    fetchStats();
  }, [filterStatus]);

  const handleEnqueue = async (values: EnqueueInput) => {
    try {
      const queueName = 'default';
      await enqueueJob(queueName, values);
      message.success('入队成功');
      setModalVisible(false);
      form.resetFields();
      fetchJobs();
      fetchStats();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '入队失败');
    }
  };

  const handleComplete = async (id: string) => {
    try {
      await completeJob(id);
      message.success('标记完成');
      fetchJobs();
      fetchStats();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '操作失败');
    }
  };

  const handleFail = async (id: string) => {
    try {
      await failJob(id);
      message.success('标记失败');
      fetchJobs();
      fetchStats();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '操作失败');
    }
  };

  const columns = [
    {
      title: '任务 ID',
      dataIndex: 'id',
      key: 'id',
      width: 280,
      ellipsis: true,
    },
    {
      title: '队列',
      dataIndex: 'queue',
      key: 'queue',
      width: 120,
      render: (v: string) => <Tag>{v || 'default'}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: JobStatus) => (
        <Badge status={statusColorMap[v] as any} text={v} />
      ),
    },
    {
      title: '重试次数',
      dataIndex: 'attempts',
      key: 'attempts',
      width: 100,
      render: (v: number) => v > 0 ? <Tag color="warning">{v}</Tag> : '-',
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (v: string) => new Date(v).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      fixed: 'right' as const,
      width: 160,
      render: (_: unknown, job: QueueJob) => (
        <Space>
          {job.status === 'processing' && (
            <Button type="link" size="small" onClick={() => handleComplete(job.id)}>
              完成
            </Button>
          )}
          {(job.status === 'pending' || job.status === 'processing') && (
            <Button type="link" size="small" danger onClick={() => handleFail(job.id)}>
              失败
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: spacing.lg }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.lg }}>
        <div>
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <UnorderedListOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            任务队列
          </Title>
          <Text type="secondary">管理队列任务状态、手动入队和完成标记</Text>
        </div>
        <Space>
          <Select
            style={{ width: 120 }}
            placeholder="状态筛选"
            allowClear
            value={filterStatus}
            onChange={(v) => setFilterStatus(v)}
            options={[
              { label: '待处理', value: 'pending' },
              { label: '处理中', value: 'processing' },
              { label: '已完成', value: 'completed' },
              { label: '失败', value: 'failed' },
            ]}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
            入队
          </Button>
        </Space>
      </div>

      <Row gutter={16} style={{ marginBottom: spacing.lg }}>
        <Col span={6}>
          <Card>
            <Statistic title="待处理" value={stats.pending} valueStyle={{ color: colors.neutral[500] }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="处理中" value={stats.processing} prefix={<SyncOutlined spin />} valueStyle={{ color: colors.primary[500] }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="已完成" value={stats.completed} prefix={<CheckCircleOutlined />} valueStyle={{ color: colors.success[500] }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="失败" value={stats.failed} valueStyle={{ color: stats.failed > 0 ? colors.error[500] : undefined }} prefix={<StopOutlined />} />
          </Card>
        </Col>
      </Row>

      <Table
        columns={columns}
        dataSource={jobs}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20 }}
        scroll={{ x: 900 }}
      />

      <Modal
        title="入队新任务"
        open={modalVisible}
        onCancel={() => { setModalVisible(false); form.resetFields(); }}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleEnqueue}>
          <Form.Item name="tenantId" label="租户 ID" rules={[{ required: true }]} initialValue="default">
            <Input />
          </Form.Item>
          <Form.Item name="payload" label="任务数据 (JSON)" rules={[{ required: true }]}>
            <Input.TextArea rows={6} placeholder='{"key": "value"}' />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default QueueTasksPage;
