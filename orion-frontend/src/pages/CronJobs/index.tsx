/**
 * Cron Jobs Management Page
 *
 * Phase 2.3: Standalone cron job management UI
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
  message,
  Card,
  Typography,
  Popconfirm,
  Statistic,
  Row,
  Col,
} from 'antd';
import {
  DeleteOutlined,
  PlusOutlined,
  ThunderboltOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ScheduleOutlined,
} from '@ant-design/icons';
import { getCronJobs, createCronJob, deleteCronJob, executeCronJob, CronJob, CronJobInput } from '@/api/cron';
import { colors } from '@/tokens/colors';

const { Title, Text } = Typography;

const CronJobsPage: React.FC = () => {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm<CronJobInput>();

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const res = await getCronJobs();
      setJobs(res.data?.data?.jobs || []);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const handleCreate = async (values: CronJobInput) => {
    try {
      await createCronJob(values);
      message.success('创建成功');
      setModalVisible(false);
      form.resetFields();
      fetchJobs();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '创建失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteCronJob(id);
      message.success('删除成功');
      fetchJobs();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '删除失败');
    }
  };

  const handleExecute = async (id: string) => {
    try {
      await executeCronJob(id);
      message.success('执行成功');
      fetchJobs();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '执行失败');
    }
  };

  const statusTag = (job: CronJob) => {
    if (!job.enabled) return <Tag color="default">已禁用</Tag>;
    if (job.status === 'error') return <Tag color="error">异常</Tag>;
    if (job.status === 'running') return <Tag color="processing">运行中</Tag>;
    return <Tag color="success">就绪</Tag>;
  };

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
    },
    {
      title: '调度表达式',
      dataIndex: 'schedule',
      key: 'schedule',
      width: 160,
      render: (v: string) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: '状态',
      key: 'status',
      width: 100,
      render: (_: unknown, job: CronJob) => statusTag(job),
    },
    {
      title: '上次运行',
      dataIndex: 'lastRunAt',
      key: 'lastRunAt',
      width: 180,
      render: (v: string) => v ? new Date(v).toLocaleString() : '-',
    },
    {
      title: '下次运行',
      dataIndex: 'nextRunAt',
      key: 'nextRunAt',
      width: 180,
      render: (v: string) => v ? new Date(v).toLocaleString() : '-',
    },
    {
      title: '运行次数',
      dataIndex: 'runCount',
      key: 'runCount',
      width: 100,
    },
    {
      title: '操作',
      key: 'action',
      fixed: 'right' as const,
      render: (_: unknown, job: CronJob) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<ThunderboltOutlined />}
            onClick={() => handleExecute(job.id)}
          >
            执行
          </Button>
          <Popconfirm title="确认删除?" onConfirm={() => handleDelete(job.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const stats = {
    total: jobs.length,
    enabled: jobs.filter(j => j.enabled).length,
    running: jobs.filter(j => j.status === 'running').length,
    error: jobs.filter(j => j.status === 'error').length,
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <Title level={2} style={{ marginBottom: 8 }}>
            <ScheduleOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            定时任务
          </Title>
          <Text type="secondary">管理和调度周期性执行的任务</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
          新建任务
        </Button>
      </div>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic title="总任务数" value={stats.total} prefix={<ClockCircleOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="已启用" value={stats.enabled} valueStyle={{ color: colors.success[500] }} prefix={<CheckCircleOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="运行中" value={stats.running} valueStyle={{ color: colors.primary[500] }} prefix={<ThunderboltOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="异常" value={stats.error} valueStyle={{ color: stats.error > 0 ? colors.error[500] : undefined }} prefix={<ExclamationCircleOutlined />} />
          </Card>
        </Col>
      </Row>

      <Table
        columns={columns}
        dataSource={jobs}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20 }}
        scroll={{ x: 1000 }}
      />

      <Modal
        title="新建定时任务"
        open={modalVisible}
        onCancel={() => { setModalVisible(false); form.resetFields(); }}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="name" label="任务名称" rules={[{ required: true }]}>
            <Input placeholder="例如：每日数据清理" />
          </Form.Item>
          <Form.Item name="schedule" label="Cron 表达式" rules={[{ required: true }]}>
            <Input placeholder="例如：0 2 * * * (每天凌晨2点)" />
          </Form.Item>
          <Form.Item name="command" label="执行命令" rules={[{ required: true }]}>
            <Input.TextArea rows={4} placeholder="输入要执行的命令或脚本" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default CronJobsPage;
