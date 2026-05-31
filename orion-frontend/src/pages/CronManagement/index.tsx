/**
 * Cron Management Page
 *
 * Admin page for scheduled job CRUD: create, edit, delete, execute cron jobs.
 * Uses api/cron.ts for all data operations.
 *
 * Route: /console/cron
 * Access: admin, platform_admin
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Button, Space, Tag, Card, Modal, Form, Input,
  Switch, message, Popconfirm, Tooltip,
} from 'antd';
import {
  ReloadOutlined, PlusOutlined, PlayCircleOutlined,
  EditOutlined, DeleteOutlined, ClockCircleOutlined,
  CheckCircleOutlined, CloseCircleOutlined, StopOutlined,
} from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import MetricCard from '@/components/MetricCard';
import DataState from '@/components/DataState';
import { colors, spacing } from '@/tokens';
import {
  getCronJobs, createCronJob, updateCronJob,
  deleteCronJob, executeCronJob, getCronStatus,
  type CronJob, type CronJobInput,
} from '@/api/cron';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TextArea } = Input;

// Status helpers
const STATUS_CONFIG: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
  running:  { color: 'processing', label: '运行中', icon: <PlayCircleOutlined /> },
  idle:     { color: 'success',    label: '空闲',   icon: <CheckCircleOutlined /> },
  error:    { color: 'error',      label: '错误',   icon: <CloseCircleOutlined /> },
  disabled: { color: 'default',    label: '已禁用', icon: <StopOutlined /> },
};

const CronManagement: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [stats, setStats] = useState<{ running: number; total: number; enabled: number } | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingJob, setEditingJob] = useState<CronJob | null>(null);
  const [form] = Form.useForm();

  const loadJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [jobsRes, statusRes] = await Promise.all([getCronJobs(), getCronStatus()]);
      setJobs((jobsRes.data as any)?.jobs ?? []);
      setStats(statusRes.data ?? null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('加载定时任务失败'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  const handleCreate = async (values: CronJobInput) => {
    try {
      await createCronJob(values);
      message.success('定时任务已创建');
      setModalVisible(false);
      form.resetFields();
      loadJobs();
    } catch (err) {
      message.error('创建失败');
    }
  };

  const handleUpdate = async (values: CronJobInput) => {
    if (!editingJob) return;
    try {
      await updateCronJob(editingJob.id, values);
      message.success('定时任务已更新');
      setModalVisible(false);
      setEditingJob(null);
      form.resetFields();
      loadJobs();
    } catch (err) {
      message.error('更新失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteCronJob(id);
      message.success('定时任务已删除');
      loadJobs();
    } catch (err) {
      message.error('删除失败');
    }
  };

  const handleExecute = async (id: string) => {
    try {
      await executeCronJob(id);
      message.success('定时任务已触发执行');
      loadJobs();
    } catch (err) {
      message.error('执行失败');
    }
  };

  const openEdit = (job: CronJob) => {
    setEditingJob(job);
    form.setFieldsValue({
      name: job.name,
      schedule: job.schedule,
      command: job.command,
      enabled: job.enabled,
    });
    setModalVisible(true);
  };

  const openCreate = () => {
    setEditingJob(null);
    form.resetFields();
    setModalVisible(true);
  };

  // Table columns
  const columns: TableColumn<CronJob>[] = [
    {
      key: 'name',
      title: '名称',
      dataIndex: 'name',
      width: 150,
      render: (v: unknown) => <Text strong>{String(v)}</Text>,
    },
    {
      key: 'schedule',
      title: '调度表达式',
      dataIndex: 'schedule',
      width: 150,
      render: (v: unknown) => <Text code style={{ fontSize: 12 }}>{String(v)}</Text>,
    },
    {
      key: 'command',
      title: '命令',
      dataIndex: 'command',
      ellipsis: true,
      render: (v: unknown) => <Text code style={{ fontSize: 11 }}>{String(v)}</Text>,
    },
    {
      key: 'status',
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (v: unknown) => {
        const cfg = STATUS_CONFIG[String(v)] ?? { color: 'default', label: String(v), icon: null };
        return <Tag color={cfg.color} icon={cfg.icon}>{cfg.label}</Tag>;
      },
    },
    {
      key: 'enabled',
      title: '启用',
      dataIndex: 'enabled',
      width: 70,
      render: (v: unknown) => (v ? <Tag color="success">是</Tag> : <Tag>否</Tag>),
    },
    {
      key: 'runCount',
      title: '执行次数',
      dataIndex: 'runCount',
      width: 90,
    },
    {
      key: 'lastRunAt',
      title: '上次执行',
      dataIndex: 'lastRunAt',
      width: 150,
      render: (v: unknown) => v ? dayjs(String(v)).format('MM-DD HH:mm') : '—',
    },
    {
      key: 'nextRunAt',
      title: '下次执行',
      dataIndex: 'nextRunAt',
      width: 150,
      render: (v: unknown) => v ? dayjs(String(v)).format('MM-DD HH:mm') : '—',
    },
    {
      key: 'actions',
      title: '操作',
      width: 160,
      render: (_: unknown, record: CronJob) => (
        <Space size="small">
          <Tooltip title="立即执行">
            <Button type="link" size="small" icon={<PlayCircleOutlined />}
              onClick={() => handleExecute(record.id)}
              disabled={record.status === 'running'}
            />
          </Tooltip>
          <Tooltip title="编辑">
            <Button type="link" size="small" icon={<EditOutlined />}
              onClick={() => openEdit(record)}
            />
          </Tooltip>
          <Popconfirm title="确认删除该定时任务?" onConfirm={() => handleDelete(record.id)}>
            <Tooltip title="删除">
              <Button type="link" size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 0 }}>
      {/* Header - always visible */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.lg }}>
        <div>
          <Title level={2} style={{ marginBottom: 8 }}>
            <ClockCircleOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            定时任务管理
          </Title>
          <Text type="secondary">Cron Job Management</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadJobs} loading={loading}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建任务</Button>
        </Space>
      </div>

      <DataState
        loading={loading && jobs.length === 0}
        error={error}
        empty={jobs.length === 0 && !loading}
        emptyText="暂无定时任务"
        loadingText="加载定时任务..."
        retry={loadJobs}
      >
        {/* Stats */}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: spacing.md, marginBottom: spacing.lg }}>
            <MetricCard title="总任务数" value={stats.total} icon={<ClockCircleOutlined />} color={colors.primary[500]} size="medium" />
            <MetricCard title="已启用" value={stats.enabled} icon={<CheckCircleOutlined />} color={colors.success[500]} size="medium" />
            <MetricCard title="运行中" value={stats.running} icon={<PlayCircleOutlined />} color={colors.purple[500]} size="medium" />
          </div>
        )}

        {/* Job Table */}
        <Card>
          <Table columns={columns} dataSource={jobs} loading={loading} rowKey="id" size="middle" striped />
        </Card>
      </DataState>

      {/* Create/Edit Modal */}
      <Modal
        title={editingJob ? '编辑定时任务' : '新建定时任务'}
        open={modalVisible}
        onCancel={() => { setModalVisible(false); setEditingJob(null); }}
        onOk={() => form.submit()}
        width={560}
      >
        <Form form={form} layout="vertical" onFinish={editingJob ? handleUpdate : handleCreate}>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input placeholder="e.g. daily-cleanup" />
          </Form.Item>
          <Form.Item name="schedule" label="Cron 表达式" rules={[{ required: true }]}>
            <Input placeholder="e.g. 0 2 * * *" />
          </Form.Item>
          <Form.Item name="command" label="命令" rules={[{ required: true }]}>
            <TextArea rows={3} placeholder="e.g. npm run cleanup -- --env=production" />
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default CronManagement;
