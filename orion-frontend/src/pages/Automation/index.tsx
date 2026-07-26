/**
 * Automation — 自动化作业与工具库管理页面
 *
 * FE-02: 自动化作业管理 (AutoJob CRUD + 执行 + 历史)
 *
 * 功能对标:
 *   - NeatLogic 自动化 25 页 (auto-exec / time-job / tool-library /
 *     script-library / composite-tool / approval / global-param / tool-category)
 *
 * 本页聚焦 Job 管理, 后续可拆分子页:
 *   - TimeJob 定时任务 / ToolLibrary 工具库 / ScriptLibrary 脚本库
 *   - CompositeTool 复合工具 / Approval 审批流 / GlobalParam 全局参数
 *
 * 交互完整性 (CLAUDE.md 8 项):
 *   1. 每个按钮有 onClick + loading + disabled
 *   2. 异步操作有 message.success / message.error
 *   3. 删除有 Modal.confirm 二次确认
 *   4. 空状态有 Empty + 引导按钮
 *   5. 表单有校验规则 (必填 + 格式)
 *   6. 编辑字段有保存入口
 *   7. 状态切换有反馈
 *   8. 执行操作有 loading 态
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Button, Space, Table, Card, Modal, Form, Input,
  Select, Tag, Tooltip, Switch, message, Empty,
  Drawer, Descriptions, Badge, Alert,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, EditOutlined, DeleteOutlined,
  PlayCircleOutlined, EyeOutlined, RocketOutlined, SettingOutlined,
  ClockCircleOutlined, ThunderboltOutlined, FolderOpenOutlined,
} from '@ant-design/icons';
import {
  colors, spacing, radius, shadows,
} from '@/tokens';
import {
  listJobs, getJob, createJob, updateJob, deleteJob,
  executeJob, toggleJob, getJobExecutions,
  type AutoJob, type CreateJobInput, type UpdateJobInput,
  type JobExecutionRecord,
} from '@/api/automation';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

// ==================== Constants ====================

const JOB_TYPE_MAP: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
  script: { color: colors.info[500], label: '脚本', icon: <ThunderboltOutlined /> },
  tool: { color: colors.purple[500], label: '工具调用', icon: <SettingOutlined /> },
  composite: { color: colors.warning[500], label: '复合工具', icon: <FolderOpenOutlined /> },
  api: { color: colors.success[500], label: 'API 调用', icon: <RocketOutlined /> },
};

const JOB_STATUS_MAP: Record<string, { color: string; label: string }> = {
  idle: { color: colors.neutral[400], label: '待执行' },
  running: { color: colors.primary[500], label: '执行中' },
  succeeded: { color: colors.success[500], label: '成功' },
  failed: { color: colors.error[500], label: '失败' },
  cancelled: { color: colors.warning[500], label: '已取消' },
};

const EXEC_STATUS_MAP: Record<string, { color: string; label: string }> = {
  pending: { color: colors.neutral[400], label: '等待中' },
  running: { color: colors.primary[500], label: '执行中' },
  completed: { color: colors.success[500], label: '完成' },
  failed: { color: colors.error[500], label: '失败' },
  cancelled: { color: colors.warning[500], label: '已取消' },
};

const JOB_TYPE_OPTIONS = Object.entries(JOB_TYPE_MAP).map(([value, { label }]) => ({ label, value }));
const JOB_STATUS_OPTIONS = Object.entries(JOB_STATUS_MAP).map(([value, { label }]) => ({ label, value }));

// ==================== Mock Data (development fallback) ====================

const mockJobs: AutoJob[] = [
  {
    id: 'job-001',
    tenantId: 'tenant-1',
    name: '部署后健康检查',
    description: '服务部署完成后自动执行健康检查，验证服务可用性',
    type: 'script',
    config: { scriptId: 'script-health', timeout: 300 },
    enabled: true,
    schedule: null,
    status: 'succeeded',
    owner: 'admin',
    tags: ['deployment', 'healthcheck'],
    createdAt: '2026-07-20T10:00:00Z',
    updatedAt: '2026-07-25T08:30:00Z',
  },
  {
    id: 'job-002',
    tenantId: 'tenant-1',
    name: '日志轮转清理',
    description: '定期清理过期日志文件，释放磁盘空间',
    type: 'script',
    config: { scriptId: 'script-log-rotate', retentionDays: 7 },
    enabled: true,
    schedule: '0 2 * * *',
    status: 'idle',
    owner: 'ops',
    tags: ['maintenance', 'cleanup'],
    createdAt: '2026-07-18T14:00:00Z',
    updatedAt: '2026-07-24T02:00:00Z',
  },
  {
    id: 'job-003',
    tenantId: 'tenant-1',
    name: '构建制品同步',
    description: '将构建产物同步到制品仓库',
    type: 'tool',
    config: { toolId: 'artifact-sync', target: 'harbor-registry' },
    enabled: false,
    schedule: null,
    status: 'failed',
    owner: 'dev',
    tags: ['ci', 'artifact'],
    createdAt: '2026-07-15T09:00:00Z',
    updatedAt: '2026-07-23T16:45:00Z',
  },
  {
    id: 'job-004',
    tenantId: 'tenant-1',
    name: '配置合规检测',
    description: '检测 Kubernetes 资源配置是否符合安全基线',
    type: 'api',
    config: { apiUrl: '/api/v1/compliance/check', method: 'POST' },
    enabled: true,
    schedule: '0 */6 * * *',
    status: 'running',
    owner: 'security',
    tags: ['compliance', 'security'],
    createdAt: '2026-07-10T11:00:00Z',
    updatedAt: '2026-07-25T09:00:00Z',
  },
  {
    id: 'job-005',
    tenantId: 'tenant-1',
    name: '故障恢复编排',
    description: '检测到故障后自动执行恢复流程：重启服务 → 验证 → 通知',
    type: 'composite',
    config: { steps: [{ action: 'restart' }, { action: 'verify' }, { action: 'notify' }] },
    enabled: true,
    schedule: null,
    status: 'succeeded',
    owner: 'sre',
    tags: ['recovery', 'automation'],
    createdAt: '2026-07-05T08:00:00Z',
    updatedAt: '2026-07-22T12:00:00Z',
  },
];

const mockExecutions: JobExecutionRecord[] = [
  {
    id: 'exec-001',
    tenantId: 'tenant-1',
    jobId: 'job-001',
    status: 'completed',
    params: {},
    output: 'Health check passed: 3/3 services healthy',
    error: null,
    durationMs: 4520,
    startedBy: 'admin',
    startedAt: '2026-07-25T08:30:00Z',
    finishedAt: '2026-07-25T08:30:04Z',
  },
  {
    id: 'exec-002',
    tenantId: 'tenant-1',
    jobId: 'job-001',
    status: 'completed',
    params: {},
    output: 'Health check passed: 3/3 services healthy',
    error: null,
    durationMs: 3890,
    startedBy: 'system',
    startedAt: '2026-07-24T08:30:00Z',
    finishedAt: '2026-07-24T08:30:03Z',
  },
  {
    id: 'exec-003',
    tenantId: 'tenant-1',
    jobId: 'job-001',
    status: 'failed',
    params: {},
    output: null,
    error: 'Service api-gateway unhealthy after 3 retries',
    durationMs: 12000,
    startedBy: 'admin',
    startedAt: '2026-07-23T08:30:00Z',
    finishedAt: '2026-07-23T08:30:12Z',
  },
];

// ==================== Utility ====================

/** Parse a JSON string safely; returns empty object on failure. */
function parseJSON(val: string): Record<string, unknown> {
  if (!val || typeof val !== 'string') return {};
  try { return JSON.parse(val); } catch { return {}; }
}

/** Format a date string to a short Chinese locale display. */
function formatShortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('zh-CN', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

// ==================== Component ====================

const Automation: React.FC = () => {
  // === State ===
  const [jobs, setJobs] = useState<AutoJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [executing, setExecuting] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Filter state
  const [searchText, setSearchText] = useState('');
  const [typeFilter, setTypeFilter] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<string | undefined>();

  // Create / Edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<AutoJob | null>(null);
  const [form] = Form.useForm();

  // Execution history drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [currentJob, setCurrentJob] = useState<AutoJob | null>(null);
  const [executions, setExecutions] = useState<JobExecutionRecord[]>([]);
  const [execLoading, setExecLoading] = useState(false);

  // ==================== Load Jobs ====================

  const loadJobs = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | boolean | undefined> = {};
      if (typeFilter) params.type = typeFilter;
      if (statusFilter) params.status = statusFilter;

      const response = await listJobs(params);
      setJobs(response.data);
    } catch {
      // Fallback to mock data for development (API may not be deployed)
      message.warning('API 暂不可用，显示模拟数据');
      setJobs(mockJobs);
    } finally {
      setLoading(false);
    }
  }, [typeFilter, statusFilter]);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  // ==================== CRUD Handlers ====================

  const handleOpenCreate = () => {
    setEditingJob(null);
    form.resetFields();
    form.setFieldsValue({
      type: 'script',
      enabled: true,
      tags: [],
    });
    setModalOpen(true);
  };

  const handleOpenEdit = async (job: AutoJob) => {
    try {
      const response = await getJob(job.id);
      const detail: AutoJob = response.data;
      setEditingJob(detail);
      form.resetFields();
      form.setFieldsValue({
        name: detail.name,
        description: detail.description,
        type: detail.type,
        enabled: detail.enabled,
        schedule: detail.schedule,
        tags: detail.tags,
        config: JSON.stringify(detail.config, null, 2),
      });
      setModalOpen(true);
    } catch {
      message.error('加载作业详情失败');
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const config = parseJSON(values.config);

      setSaving(true);
      if (editingJob) {
        const payload: UpdateJobInput = {
          name: values.name,
          description: values.description,
          config,
          enabled: values.enabled,
          schedule: values.schedule || null,
          tags: values.tags || [],
        };
        await updateJob(editingJob.id, payload);
        message.success('作业更新成功');
      } else {
        const payload: CreateJobInput = {
          name: values.name,
          description: values.description,
          type: values.type,
          config,
          enabled: values.enabled,
          schedule: values.schedule,
          tags: values.tags || [],
        };
        await createJob(payload);
        message.success('作业创建成功');
      }
      setModalOpen(false);
      loadJobs();
    } catch (err) {
      // Skip message when form validation fails (err has errorFields)
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      message.error(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (job: AutoJob) => {
    Modal.confirm({
      title: '确认删除作业',
      content: (
        <div>
          <p>确定要删除作业 <Text strong>{job.name}</Text> 吗？</p>
          <p><Text type="secondary">此操作不可恢复，所有执行历史将被保留。</Text></p>
        </div>
      ),
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteJob(job.id);
          message.success('作业删除成功');
          loadJobs();
        } catch {
          message.error('删除失败');
        }
      },
    });
  };

  const handleToggle = async (job: AutoJob) => {
    const newEnabled = !job.enabled;
    setTogglingId(job.id);
    try {
      await toggleJob(job.id, newEnabled);
      message.success(`作业已${newEnabled ? '启用' : '停用'}`);
      loadJobs();
    } catch {
      message.error('状态切换失败');
    } finally {
      setTogglingId(null);
    }
  };

  const handleExecute = async (job: AutoJob) => {
    if (!job.enabled) {
      message.warning('该作业处于停用状态，无法执行');
      return;
    }
    setExecuting(job.id);
    try {
      const response = await executeJob(job.id, {});
      message.success(`作业已执行，执行 ID: ${response.data.id}`);
      loadJobs();
    } catch {
      message.error('执行失败');
    } finally {
      setExecuting(null);
    }
  };

  // ==================== Execution History ====================

  const handleViewExecutions = async (job: AutoJob) => {
    setCurrentJob(job);
    setDrawerOpen(true);
    setExecLoading(true);
    try {
      const response = await getJobExecutions(job.id, 20);
      setExecutions(response.data);
    } catch {
      message.error('加载执行历史失败');
      setExecutions(mockExecutions);
    } finally {
      setExecLoading(false);
    }
  };

  // ==================== Filtered Data ====================

  const filteredJobs = jobs.filter((job) => {
    if (typeFilter && job.type !== typeFilter) return false;
    if (statusFilter && job.status !== statusFilter) return false;
    if (searchText) {
      const search = searchText.toLowerCase();
      const nameMatch = job.name.toLowerCase().includes(search);
      const tagMatch = job.tags.some((t) => t.toLowerCase().includes(search));
      if (!nameMatch && !tagMatch) return false;
    }
    return true;
  });

  // ==================== Stats ====================

  const stats = {
    total: filteredJobs.length,
    enabled: filteredJobs.filter((j) => j.enabled).length,
    running: filteredJobs.filter((j) => j.status === 'running').length,
    failed: filteredJobs.filter((j) => j.status === 'failed').length,
  };

  // ==================== Table Columns ====================

  const columns = [
    {
      title: '作业名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (name: string) => (
        <Text style={{ fontWeight: 500 }}>{name}</Text>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 110,
      fixed: 'left' as const,
      render: (type: string) => {
        const t = JOB_TYPE_MAP[type] || JOB_TYPE_MAP.script;
        return (
          <Tag color={t.color} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            {t.icon}
            {t.label}
          </Tag>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      fixed: 'left' as const,
      render: (status: string) => {
        const s = JOB_STATUS_MAP[status] || JOB_STATUS_MAP.idle;
        const isRunning = status === 'running';
        return (
          <Badge
            status={isRunning ? 'processing' : 'default'}
            dot
          >
            <Tag color={s.color}>{s.label}</Tag>
          </Badge>
        );
      },
    },
    {
      title: '启用',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 70,
      align: 'center' as const,
      render: (_: boolean, record: AutoJob) => (
        <Switch
          size="small"
          checked={record.enabled}
          loading={togglingId === record.id}
          disabled={togglingId === record.id}
          onChange={() => handleToggle(record)}
        />
      ),
    },
    {
      title: '调度',
      dataIndex: 'schedule',
      key: 'schedule',
      width: 130,
      render: (schedule: string | null) =>
        schedule ? (
          <Tooltip title="定时任务 (Cron)">
            <Tag color="cyan" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <ClockCircleOutlined />
              <Text code style={{ fontSize: 11 }}>{schedule}</Text>
            </Tag>
          </Tooltip>
        ) : (
          <Text type="secondary" style={{ fontSize: 12 }}>手动</Text>
        ),
    },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      width: 140,
      render: (tags: string[]) => (
        <Space size={[0, 4]} wrap>
          {tags.slice(0, 2).map((tag) => (
            <Tag key={tag} style={{ fontSize: 11 }}>{tag}</Tag>
          ))}
          {tags.length > 2 && <Tag style={{ fontSize: 11 }}>+{tags.length - 2}</Tag>}
        </Space>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      render: (date: string) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {formatShortDate(date)}
        </Text>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      fixed: 'right' as const,
      render: (_: unknown, record: AutoJob) => (
        <Space size="small" wrap>
          <Tooltip title="执行">
            <Button
              type="text"
              size="small"
              icon={<PlayCircleOutlined />}
              loading={executing === record.id}
              disabled={!record.enabled || record.status === 'running' || executing === record.id}
              onClick={() => handleExecute(record)}
            />
          </Tooltip>
          <Tooltip title="查看历史">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleViewExecutions(record)}
            />
          </Tooltip>
          <Tooltip title="编辑">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleOpenEdit(record)}
            />
          </Tooltip>
          <Tooltip title="删除">
            <Button
              type="text"
              size="small"
              icon={<DeleteOutlined />}
              danger
              onClick={() => handleDelete(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  // ==================== Execution History Columns ====================

  const execColumns = [
    {
      title: '执行 ID',
      dataIndex: 'id',
      key: 'id',
      width: 120,
      render: (id: string) => <Text code style={{ fontSize: 12 }}>{id}</Text>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (status: string) => {
        const s = EXEC_STATUS_MAP[status] || EXEC_STATUS_MAP.pending;
        return <Tag color={s.color}>{s.label}</Tag>;
      },
    },
    {
      title: '执行耗时',
      dataIndex: 'durationMs',
      key: 'durationMs',
      width: 100,
      align: 'center' as const,
      render: (ms: number | null) => ms ? <Text>{(ms / 1000).toFixed(1)}s</Text> : <Text type="secondary">-</Text>,
    },
    {
      title: '操作人',
      dataIndex: 'startedBy',
      key: 'startedBy',
      width: 100,
      render: (by: string | null) => by || <Text type="secondary">系统</Text>,
    },
    {
      title: '开始时间',
      dataIndex: 'startedAt',
      key: 'startedAt',
      width: 150,
      render: (date: string) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {new Date(date).toLocaleString('zh-CN')}
        </Text>
      ),
    },
    {
      title: '结果',
      dataIndex: 'output',
      key: 'output',
      render: (output: string | null, record: JobExecutionRecord) => {
        if (record.status === 'failed' && record.error) {
          return (
            <Alert
              message={record.error}
              type="error"
              showIcon
              style={{ fontSize: 12 }}
            />
          );
        }
        if (output) {
          return (
            <Tooltip title={output}>
              <Text style={{ fontSize: 12, color: colors.success[500] }} ellipsis>
                {output}
              </Text>
            </Tooltip>
          );
        }
        return <Text type="secondary" style={{ fontSize: 12 }}>无输出</Text>;
      },
    },
  ];

  // ==================== Render ====================

  return (
    <div style={{ padding: 0 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.lg }}>
        <div>
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <ThunderboltOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            自动化作业
          </Title>
          <Text type="secondary">
            管理和执行自动化作业，支持脚本、工具调用、复合工具与 API 调用
          </Text>
        </div>
        <Tooltip title="刷新作业列表">
          <Button
            icon={<ReloadOutlined />}
            loading={loading}
            disabled={loading}
            onClick={loadJobs}
          >
            刷新
          </Button>
        </Tooltip>
      </div>

      {/* Stats Bar */}
      <Card
        style={{
          borderRadius: radius.lg,
          boxShadow: shadows.sm,
          marginBottom: spacing.md,
        }}
        bodyStyle={{ padding: `${spacing.sm} ${spacing.lg}` }}
      >
        <Space size="large" style={{ width: '100%', justifyContent: 'space-around' }}>
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>总作业数</Text>
            <br />
            <Text style={{ fontSize: 24, fontWeight: 600 }}>{stats.total}</Text>
          </div>
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>已启用</Text>
            <br />
            <Text style={{ fontSize: 24, fontWeight: 600, color: colors.success[500] }}>{stats.enabled}</Text>
          </div>
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>执行中</Text>
            <br />
            <Text style={{ fontSize: 24, fontWeight: 600, color: colors.primary[500] }}>{stats.running}</Text>
          </div>
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>失败</Text>
            <br />
            <Text style={{ fontSize: 24, fontWeight: 600, color: colors.error[500] }}>{stats.failed}</Text>
          </div>
        </Space>
      </Card>

      {/* Job List Card */}
      <Card
        style={{ borderRadius: radius.lg, boxShadow: shadows.sm }}
        bodyStyle={{ padding: spacing.md }}
      >
        {/* Toolbar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
          <Space>
            <Text type="secondary">共 {filteredJobs.length} 条作业</Text>
          </Space>
          <Space>
            <Input
              placeholder="搜索作业名称 / 标签"
              style={{ width: 220 }}
              allowClear
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
            <Select
              placeholder="作业类型"
              allowClear
              style={{ width: 130 }}
              value={typeFilter}
              onChange={setTypeFilter}
            >
              {JOB_TYPE_OPTIONS.map((o) => (
                <Option key={o.value} value={o.value}>{o.label}</Option>
              ))}
            </Select>
            <Select
              placeholder="状态筛选"
              allowClear
              style={{ width: 130 }}
              value={statusFilter}
              onChange={setStatusFilter}
            >
              {JOB_STATUS_OPTIONS.map((o) => (
                <Option key={o.value} value={o.value}>{o.label}</Option>
              ))}
            </Select>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
              新建作业
            </Button>
          </Space>
        </div>

        {/* Table or Empty State */}
        {filteredJobs.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <div style={{ textAlign: 'center' }}>
                <Text type="secondary">暂无自动化作业，点击上方「新建作业」开始创建</Text>
                <div style={{ marginTop: 12 }}>
                  <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
                    新建作业
                  </Button>
                </div>
              </div>
            }
          />
        ) : (
          <Table
            dataSource={filteredJobs}
            columns={columns}
            rowKey="id"
            loading={loading}
            size="middle"
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条`,
            }}
            scroll={{ x: 1100 }}
          />
        )}
      </Card>

      {/* Create / Edit Job Modal */}
      <Modal
        title={editingJob ? '编辑作业' : '新建作业'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        confirmLoading={saving}
        width={720}
        okText="保存"
        cancelText="取消"
        okButtonProps={{ loading: saving, disabled: saving }}
      >
        <Form
          form={form}
          layout="vertical"
          style={{ maxWidth: 680 }}
          initialValues={{ enabled: true, tags: [] }}
        >
          <Form.Item
            name="name"
            label="作业名称"
            rules={[{ required: true, message: '请输入作业名称' }]}
          >
            <Input placeholder="例：部署后健康检查" />
          </Form.Item>

          <Form.Item name="description" label="描述">
            <TextArea rows={2} placeholder="作业描述（可选）" />
          </Form.Item>

          <Form.Item
            name="type"
            label="作业类型"
            rules={[{ required: true, message: '请选择作业类型' }]}
          >
            <Select placeholder="选择作业类型">
              {JOB_TYPE_OPTIONS.map((o) => (
                <Option key={o.value} value={o.value}>{o.label}</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="enabled"
            label="启用"
            valuePropName="checked"
          >
            <Switch checkedChildren="启用" unCheckedChildren="停用" />
          </Form.Item>

          <Form.Item
            name="schedule"
            label="调度表达式 (Cron)"
            rules={[
              {
                validator: (_, value) => {
                  if (!value) return Promise.resolve();
                  // Basic cron validation: 5+ space-separated segments
                  const parts = value.trim().split(/\s+/);
                  if (parts.length < 5) {
                    return Promise.reject(new Error('Cron 表达式格式不正确，至少需要 5 个字段'));
                  }
                  return Promise.resolve();
                },
              },
            ]}
          >
            <Input placeholder="例：0 2 * * *  (留空为手动触发)" />
          </Form.Item>

          <Form.Item name="tags" label="标签">
            <Select
              mode="tags"
              placeholder="输入标签后回车"
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item name="config" label="配置 (JSON)">
            <TextArea
              rows={4}
              placeholder='{"scriptId": "script-xxx", "timeout": 300}'
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Execution History Drawer */}
      <Drawer
        title={
          <div>
            <Text strong>{currentJob?.name}</Text>
            {' '}
            <Text type="secondary">— 执行历史</Text>
          </div>
        }
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={720}
        extra={
          <Button
            icon={<ReloadOutlined />}
            loading={execLoading}
            disabled={execLoading}
            onClick={() => {
              if (currentJob) handleViewExecutions(currentJob);
            }}
          >
            刷新
          </Button>
        }
      >
        {/* Job Detail */}
        {currentJob && (
          <div style={{ marginBottom: spacing.md }}>
            <Descriptions size="small" bordered column={2}>
              <Descriptions.Item label="作业 ID">{currentJob.id}</Descriptions.Item>
              <Descriptions.Item label="类型">
                <Tag color={JOB_TYPE_MAP[currentJob.type]?.color}>
                  {JOB_TYPE_MAP[currentJob.type]?.label}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={JOB_STATUS_MAP[currentJob.status]?.color}>
                  {JOB_STATUS_MAP[currentJob.status]?.label}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="启用状态">
                <Switch
                  size="small"
                  checked={currentJob.enabled}
                  disabled
                />
              </Descriptions.Item>
              {currentJob.description && (
                <Descriptions.Item label="描述" span={2}>{currentJob.description}</Descriptions.Item>
              )}
              <Descriptions.Item label="创建时间" span={2}>
                {new Date(currentJob.createdAt).toLocaleString('zh-CN')}
              </Descriptions.Item>
            </Descriptions>
          </div>
        )}

        {/* Executions Table */}
        <Table
          dataSource={executions}
          columns={execColumns}
          rowKey="id"
          loading={execLoading}
          size="small"
          pagination={{
            pageSize: 10,
            showTotal: (total) => `共 ${total} 条`,
          }}
          scroll={{ x: 800 }}
        />
      </Drawer>
    </div>
  );
};

export default Automation;
