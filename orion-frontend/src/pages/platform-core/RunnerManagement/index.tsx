/**
 * Runner Pool Management Page (GAP-CN-07)
 *
 * Features:
 * - Table with runner pool overview (name, status, labels, jobs, heartbeat, OS/Arch)
 * - Status indicators with color (green=online, yellow=busy, gray=offline, red=draining)
 * - Filter by: Status, Labels
 * - Register runner modal: Name, Labels (tag input), Max concurrent jobs
 * - Deregister runner with confirmation
 * - Runner detail drawer: Recent jobs, heartbeat history
 * - Heartbeat timeout indicator (runners with stale heartbeat > 5 min shown as offline)
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Typography,
  Button,
  Space,
  Tag,
  message,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Drawer,
  Descriptions,
  Popconfirm,
  Tooltip,
} from 'antd';
import {
  PlusOutlined,
  ThunderboltOutlined,
  ReloadOutlined,
  DeleteOutlined,
  EyeOutlined,
  ClockCircleOutlined,
  CloudServerOutlined,
} from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import SearchFilterBar, { type FilterDefinition } from '@/components/SearchFilterBar';
import {
  getRunners,
  registerRunner,
  deregisterRunner,
  getRunnerJobs,
  type Runner,
  type RunnerStatus,
  type RunnerJob,
} from '@/api/runners';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { colors, spacing } from '@/tokens';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;

// ============================================================================
// Status Config
// ============================================================================

const STATUS_CONFIG: Record<RunnerStatus, { color: string; label: string }> = {
  online: { color: 'green', label: '在线' },
  busy: { color: 'gold', label: '忙碌' },
  offline: { color: 'default', label: '离线' },
  draining: { color: 'red', label: '下线中' },
};

const HEARTBEAT_TIMEOUT_MINUTES = 5;

/** Check if a runner's heartbeat is stale */
function isHeartbeatStale(lastHeartbeat: string): boolean {
  const timeoutMs = HEARTBEAT_TIMEOUT_MINUTES * 60 * 1000;
  return Date.now() - new Date(lastHeartbeat).getTime() > timeoutMs;
}

// ============================================================================
// Register Runner Modal
// ============================================================================

interface RegisterModalProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess: () => void;
}

const RegisterRunnerModal: React.FC<RegisterModalProps> = ({ visible, onCancel, onSuccess }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [labels, setLabels] = useState<string[]>([]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      await registerRunner({
        name: values.name,
        labels,
        maxConcurrent: values.maxConcurrent || 1,
        endpoint: values.endpoint,
        metadata: {
          os: values.os,
          arch: values.arch,
        },
      });

      message.success('Runner 注册成功');
      form.resetFields();
      setLabels([]);
      onSuccess();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`注册失败：${error.message}`);
      } else {
        message.error('注册失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="注册 Runner"
      open={visible}
      onCancel={onCancel}
      onOk={handleSubmit}
      confirmLoading={loading}
      okText="注册"
      cancelText="取消"
      width={520}
    >
      <Form form={form} layout="vertical" style={{ marginTop: spacing.md }}>
        <Form.Item
          name="name"
          label="Runner 名称"
          rules={[{ required: true, message: '请输入 Runner 名称' }]}
        >
          <Input placeholder="例如：runner-build-01" />
        </Form.Item>

        <Form.Item label="标签">
          <Select
            mode="tags"
            placeholder="输入标签后回车，例如：linux, docker, node18"
            value={labels}
            onChange={setLabels}
            tokenSeparators={[',', ' ']}
          />
        </Form.Item>

        <Form.Item
          name="maxConcurrent"
          label="最大并发任务数"
          rules={[{ required: true, message: '请输入最大并发数' }]}
        >
          <InputNumber min={1} max={32} style={{ width: '100%' }} placeholder="默认 1" />
        </Form.Item>

        <Form.Item name="endpoint" label="Runner 端点地址（可选）">
          <Input placeholder="例如：http://runner-01:8080" />
        </Form.Item>

        <Form.Item name="os" label="操作系统（可选）">
          <Select placeholder="选择操作系统">
            <Select.Option value="linux">Linux</Select.Option>
            <Select.Option value="macos">macOS</Select.Option>
            <Select.Option value="windows">Windows</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item name="arch" label="CPU 架构（可选）">
          <Select placeholder="选择架构">
            <Select.Option value="x86_64">x86_64</Select.Option>
            <Select.Option value="arm64">arm64</Select.Option>
            <Select.Option value="aarch64">aarch64</Select.Option>
          </Select>
        </Form.Item>
      </Form>
    </Modal>
  );
};

// ============================================================================
// Runner Detail Drawer
// ============================================================================

interface RunnerDetailDrawerProps {
  visible: boolean;
  runner: Runner | null;
  onClose: () => void;
}

const RunnerDetailDrawer: React.FC<RunnerDetailDrawerProps> = ({ visible, runner, onClose }) => {
  const [jobs, setJobs] = useState<RunnerJob[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);

  const loadJobs = useCallback(async (runnerId: string) => {
    setJobsLoading(true);
    try {
      const response = await getRunnerJobs(runnerId);
      const apiData = response.data;
      setJobs(Array.isArray(apiData) ? apiData : []);
    } catch {
      setJobs([]);
    } finally {
      setJobsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible && runner) {
      loadJobs(runner.id);
    }
  }, [visible, runner?.id, loadJobs]);

  if (!runner) return null;

  const statusCfg = STATUS_CONFIG[runner.status];
  const stale = isHeartbeatStale(runner.lastHeartbeat);
  const utilization =
    runner.maxConcurrent > 0
      ? Math.round((runner.currentJobs / runner.maxConcurrent) * 100)
      : 0;

  return (
    <Drawer
      title={`Runner: ${runner.name}`}
      open={visible}
      onClose={onClose}
      width={640}
    >
      {/* Basic Info */}
      <Descriptions bordered column={2} size="small" style={{ marginBottom: spacing.lg }}>
        <Descriptions.Item label="状态" span={2}>
          <Tag color={statusCfg.color}>{statusCfg.label}</Tag>
          {stale && (
            <Tooltip title="心跳超时超过 5 分钟">
              <Tag color="orange" icon={<ClockCircleOutlined />} style={{ marginLeft: spacing.sm }}>
                心跳超时
              </Tag>
            </Tooltip>
          )}
        </Descriptions.Item>
        <Descriptions.Item label="Runner ID">{runner.id}</Descriptions.Item>
        <Descriptions.Item label="端点">{runner.endpoint || '-'}</Descriptions.Item>
        <Descriptions.Item label="操作系统">{runner.metadata?.os || '-'}</Descriptions.Item>
        <Descriptions.Item label="CPU 架构">{runner.metadata?.arch || '-'}</Descriptions.Item>
        <Descriptions.Item label="当前任务">{runner.currentJobs}</Descriptions.Item>
        <Descriptions.Item label="最大并发">{runner.maxConcurrent}</Descriptions.Item>
        <Descriptions.Item label="利用率" span={2}>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
            <div
              style={{
                width: 120,
                height: 8,
                background: colors.neutral[200],
                borderRadius: 4,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${Math.min(utilization, 100)}%`,
                  height: '100%',
                  background: utilization > 80 ? colors.error[400] : utilization > 50 ? colors.warning[500] : colors.success[500],
                  borderRadius: 4,
                  transition: 'width 0.3s',
                }}
              />
            </div>
            <Text>{utilization}%</Text>
          </div>
        </Descriptions.Item>
        <Descriptions.Item label="标签" span={2}>
          {runner.labels.length > 0
            ? runner.labels.map((label) => (
                <Tag key={label} color="blue" style={{ marginBottom: 4 }}>
                  {label}
                </Tag>
              ))
            : '-'}
        </Descriptions.Item>
        <Descriptions.Item label="最后心跳">{dayjs(runner.lastHeartbeat).fromNow()}</Descriptions.Item>
        <Descriptions.Item label="注册时间">{dayjs(runner.createdAt).fromNow()}</Descriptions.Item>
      </Descriptions>

      {/* Recent Jobs */}
      <Title level={5} style={{ marginBottom: spacing[3] }}>
        最近任务
      </Title>
      {jobsLoading ? (
        <Text type="secondary">加载中...</Text>
      ) : jobs.length === 0 ? (
        <Text type="secondary">暂无任务记录</Text>
      ) : (
        <Table
          columns={
            [
              {
                key: 'taskId',
                title: 'Task ID',
                dataIndex: 'taskId',
                width: 180,
                ellipsis: true,
              },
              {
                key: 'status',
                title: '状态',
                dataIndex: 'status',
                width: 100,
                render: (value: unknown) => {
                  const statusMap: Record<string, { color: string; label: string }> = {
                    pending: { color: 'default', label: '等待中' },
                    running: { color: 'processing', label: '运行中' },
                    completed: { color: 'success', label: '已完成' },
                    failed: { color: 'error', label: '失败' },
                    cancelled: { color: 'default', label: '已取消' },
                  };
                  const cfg = statusMap[String(value)] || { color: 'default', label: String(value) };
                  return <Tag color={cfg.color}>{cfg.label}</Tag>;
                },
              },
              {
                key: 'createdAt',
                title: '创建时间',
                dataIndex: 'createdAt',
                width: 140,
                render: (value: unknown) => (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {dayjs(String(value)).fromNow()}
                  </Text>
                ),
              },
              {
                key: 'completedAt',
                title: '完成时间',
                dataIndex: 'completedAt',
                width: 140,
                render: (value: unknown) =>
                  value ? (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {dayjs(String(value)).fromNow()}
                    </Text>
                  ) : (
                    <Text type="secondary">-</Text>
                  ),
              },
            ] as TableColumn<RunnerJob>[]
          }
          dataSource={jobs.slice(0, 20)}
          rowKey="id"
          size="small"
          pagination={false}
        />
      )}
    </Drawer>
  );
};

// ============================================================================
// Main Page
// ============================================================================

const RunnerManagement: React.FC = () => {
  const [runners, setRunners] = useState<Runner[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});
  const [registerVisible, setRegisterVisible] = useState(false);
  const [selectedRunner, setSelectedRunner] = useState<Runner | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);

  // Load runners
  const loadRunners = async () => {
    setLoading(true);
    try {
      const response = await getRunners();
      const apiData = response.data;
      const runnerList = Array.isArray(apiData) ? apiData : (apiData as { items?: unknown[] })?.items ?? [];
      setRunners(runnerList as Runner[]);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`加载 Runner 列表失败：${error.message}`);
      } else {
        message.error('加载 Runner 列表失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRunners();
  }, []);

  // Filter runners
  const filteredRunners = useMemo(() => {
    return runners.filter((runner) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const searchable = [runner.name, runner.labels.join(' '), runner.metadata?.os || '', runner.metadata?.arch || '']
          .join(' ')
          .toLowerCase();
        if (!searchable.includes(query)) return false;
      }

      // Status filter
      const statusFilter = filters.status;
      if (statusFilter && statusFilter !== 'all') {
        if (statusFilter === 'stale') {
          // Special filter for stale heartbeat
          if (!isHeartbeatStale(runner.lastHeartbeat)) return false;
        } else if (runner.status !== statusFilter) {
          return false;
        }
      }

      return true;
    });
  }, [searchQuery, filters, runners]);

  // Deregister runner
  const handleDeregister = async (id: string) => {
    try {
      await deregisterRunner(id);
      message.success('Runner 已注销');
      loadRunners();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`注销失败：${error.message}`);
      } else {
        message.error('注销失败，请稍后重试');
      }
    }
  };

  // View runner detail
  const handleViewDetail = (runner: Runner) => {
    setSelectedRunner(runner);
    setDrawerVisible(true);
  };

  // Filter definitions
  const filterDefs: FilterDefinition[] = [
    {
      key: 'status',
      label: '状态',
      options: [
        { label: '全部', value: 'all' },
        { label: '在线', value: 'online' },
        { label: '忙碌', value: 'busy' },
        { label: '离线', value: 'offline' },
        { label: '下线中', value: 'draining' },
        { label: '心跳超时', value: 'stale' },
      ],
    },
  ];

  // Table columns
  const columns: TableColumn<Runner>[] = [
    {
      key: 'name',
      title: 'Runner',
      dataIndex: 'name',
      width: 220,
      sortable: true,
      filterable: true,
      render: (_value: unknown, record) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ cursor: 'pointer', color: colors.primary[500] }}>
            <CloudServerOutlined style={{ marginRight: 6, color: colors.neutral[500] }} />
            {record.name}
          </Text>
          <Text type="secondary" style={{ fontSize: 12, fontFamily: 'monospace' }}>
            {record.id.slice(0, 8)}...
          </Text>
        </Space>
      ),
    },
    {
      key: 'status',
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (value: unknown, record) => {
        const status = value as RunnerStatus;
        const cfg = STATUS_CONFIG[status];
        const stale = isHeartbeatStale(record.lastHeartbeat);
        return (
          <Space>
            <Tag color={cfg.color}>{cfg.label}</Tag>
            {stale && (
              <Tooltip title="心跳超时（> 5 分钟）">
                <ClockCircleOutlined style={{ color: colors.warning[500], fontSize: 14 }} />
              </Tooltip>
            )}
          </Space>
        );
      },
    },
    {
      key: 'labels',
      title: '标签',
      dataIndex: 'labels',
      width: 200,
      render: (value: unknown) => {
        const labels = value as string[];
        return (
          <div style={{ maxWidth: 200 }}>
            {labels.slice(0, 3).map((label) => (
              <Tag key={label} color="blue" style={{ marginBottom: 2 }}>
                {label}
              </Tag>
            ))}
            {labels.length > 3 && (
              <Tag color="default">+{labels.length - 3}</Tag>
            )}
            {labels.length === 0 && <Text type="secondary">-</Text>}
          </div>
        );
      },
    },
    {
      key: 'jobs',
      title: '任务',
      dataIndex: 'currentJobs',
      width: 120,
      sortable: true,
      render: (_value: unknown, record) => (
        <Text>
          {record.currentJobs} / {record.maxConcurrent}
        </Text>
      ),
    },
    {
      key: 'osArch',
      title: 'OS / 架构',
      width: 130,
      render: (_value: unknown, record) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {record.metadata?.os || '-'} / {record.metadata?.arch || '-'}
        </Text>
      ),
    },
    {
      key: 'lastHeartbeat',
      title: '最后心跳',
      dataIndex: 'lastHeartbeat',
      width: 140,
      sortable: true,
      render: (value: unknown) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {dayjs(String(value)).fromNow()}
        </Text>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      width: 160,
      render: (_: unknown, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
          >
            详情
          </Button>
          <Popconfirm
            title="确认注销"
            description={`确定要注销 Runner "${record.name}" 吗？此操作不可撤销。`}
            onConfirm={() => handleDeregister(record.id)}
            okText="确认注销"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              注销
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 0 }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: spacing.lg,
        }}
      >
        <div>
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <ThunderboltOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            Runner 资源池
          </Title>
          <Text type="secondary">
            共 {filteredRunners.length} 个 Runner
            {runners.filter((r) => r.status === 'online').length > 0 && (
              <> · {runners.filter((r) => r.status === 'online').length} 个在线</>
            )}
            {runners.filter((r) => r.status === 'busy').length > 0 && (
              <> · {runners.filter((r) => r.status === 'busy').length} 个忙碌</>
            )}
          </Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadRunners} loading={loading}>
            刷新
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setRegisterVisible(true)}
          >
            注册 Runner
          </Button>
        </Space>
      </div>

      {/* Search and filter */}
      <div style={{ marginBottom: spacing.md }}>
        <SearchFilterBar
          onSearch={setSearchQuery}
          onFilter={setFilters}
          filters={filterDefs}
          searchPlaceholder="搜索 Runner 名称、标签、OS..."
        />
      </div>

      {/* Runner Table */}
      <Table
        columns={columns}
        dataSource={filteredRunners}
        loading={loading}
        rowKey="id"
        size="middle"
        striped
      />

      {/* Register Runner Modal */}
      <RegisterRunnerModal
        visible={registerVisible}
        onCancel={() => setRegisterVisible(false)}
        onSuccess={() => {
          setRegisterVisible(false);
          loadRunners();
        }}
      />

      {/* Runner Detail Drawer */}
      <RunnerDetailDrawer
        visible={drawerVisible}
        runner={selectedRunner}
        onClose={() => {
          setDrawerVisible(false);
          setSelectedRunner(null);
        }}
      />
    </div>
  );
};

export default RunnerManagement;
