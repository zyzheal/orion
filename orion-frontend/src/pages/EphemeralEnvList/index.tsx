/**
 * EphemeralEnvList Page
 * - Environment list with status/PR/repo filters
 * - Create environment modal
 * - Summary cards: total envs, running, idle, cost
 * - Actions: open preview, wake, teardown, view cost
 */
import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Typography,
  Button,
  Space,
  Tag,
  Badge,
  Modal,
  message,
  Form,
  Input,
  Select,
  Descriptions,
  Popconfirm,
  Drawer,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  LinkOutlined,
  PoweroffOutlined,
  ThunderboltOutlined,
  AppstoreOutlined,
  EyeOutlined,
  DollarOutlined,
  ClockCircleOutlined,
  CloudServerOutlined,
} from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import SearchFilterBar, { type FilterDefinition } from '@/components/SearchFilterBar';
import MetricCard from '@/components/MetricCard';
import {
  getEphemeralEnvs,
  createEphemeralEnv,
  wakeEphemeralEnv,
  teardownEphemeralEnv,
  getEphemeralEnvCost,
  getEnvironmentTemplates,
  type EphemeralEnvironment,
  type EnvironmentTemplate,
  type EphemeralEnvCost,
} from '@/api/ephemeral-envs';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const STATUS_OPTIONS = [
  { label: '全部', value: 'all' },
  { label: 'Provisioning', value: 'provisioning' },
  { label: 'Running', value: 'running' },
  { label: 'Idle', value: 'idle' },
  { label: 'Tearing Down', value: 'tearing_down' },
  { label: 'Destroyed', value: 'destroyed' },
];

const statusToColor: Record<string, string> = {
  provisioning: 'processing',
  running: 'success',
  idle: 'warning',
  tearing_down: 'default',
  destroyed: 'error',
};

const statusLabel: Record<string, string> = {
  provisioning: '创建中',
  running: '运行中',
  idle: '空闲',
  tearing_down: '销毁中',
  destroyed: '已销毁',
};

// ============================================================================
// Cost Drawer
// ============================================================================

interface CostDrawerProps {
  env: EphemeralEnvironment | null;
  open: boolean;
  onClose: () => void;
}

const CostDrawer: React.FC<CostDrawerProps> = ({ env, open, onClose }) => {
  const [cost, setCost] = useState<EphemeralEnvCost | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && env) {
      setLoading(true);
      getEphemeralEnvCost(env.id)
        .then((res) => setCost(res.data?.data || null))
        .catch(() => setCost(null))
        .finally(() => setLoading(false));
    }
  }, [open, env]);

  if (!env) return null;

  return (
    <Drawer
      title={`环境成本 - ${env.namespace}`}
      placement="right"
      width={480}
      onClose={onClose}
      open={open}
      loading={loading}
      data-testid="cost-drawer"
    >
      {loading ? (
        <Text type="secondary">加载成本数据...</Text>
      ) : cost ? (
        <>
          <Descriptions column={1} bordered size="small" style={{ marginBottom: 24 }}>
            <Descriptions.Item label="环境 ID">
              <Text code>{env.id}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="统计周期">
              {cost.periodStart && cost.periodEnd
                ? `${dayjs(cost.periodStart).format('YYYY-MM-DD')} ~ ${dayjs(cost.periodEnd).format('YYYY-MM-DD')}`
                : '-'}
            </Descriptions.Item>
          </Descriptions>

          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="CPU 成本">
              <Text strong>{cost.cpuCost.toFixed(2)}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="内存成本">
              <Text strong>{cost.memoryCost.toFixed(2)}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="存储成本">
              <Text strong>{cost.storageCost.toFixed(2)}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="网络成本">
              <Text strong>{cost.networkCost.toFixed(2)}</Text>
            </Descriptions.Item>
          </Descriptions>

          <div style={{
            marginTop: 24,
            padding: 16,
            background: '#f6ffed',
            borderRadius: 8,
            textAlign: 'center',
            border: '1px solid #b7eb8f',
          }}>
            <Text type="secondary" style={{ fontSize: 12 }}>总成本</Text>
            <br />
            <Text strong style={{ fontSize: 24, color: '#52c41a' }}>
              {cost.totalCost.toFixed(2)} {cost.currency}
            </Text>
          </div>
        </>
      ) : (
        <Text type="secondary">暂无成本数据</Text>
      )}
    </Drawer>
  );
};

// ============================================================================
// Create Environment Modal
// ============================================================================

interface CreateEnvModalProps {
  open: boolean;
  onCancel: () => void;
  onSuccess: () => void;
}

const CreateEnvModal: React.FC<CreateEnvModalProps> = ({ open, onCancel, onSuccess }) => {
  const [form] = Form.useForm();
  const [creating, setCreating] = useState(false);
  const [templates, setTemplates] = useState<EnvironmentTemplate[]>([]);

  useEffect(() => {
    if (open) {
      getEnvironmentTemplates()
        .then((res) => setTemplates(res.data?.data || []))
        .catch(() => setTemplates([]));
    }
  }, [open]);

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      setCreating(true);

      await createEphemeralEnv({
        prId: values.prId,
        repoId: values.repoId,
        branchName: values.branchName,
        templateId: values.templateId || undefined,
        commitSha: values.commitSha,
      });

      message.success('临时环境创建成功');
      form.resetFields();
      setCreating(false);
      onSuccess();
    } catch (err: any) {
      setCreating(false);
      if (err.errorFields) return;
      message.error(`创建失败：${err.message}`);
    }
  };

  return (
    <Modal
      title={
        <Space>
          <PlusOutlined />
          创建临时环境
        </Space>
      }
      open={open}
      onCancel={onCancel}
      onOk={handleCreate}
      confirmLoading={creating}
      okText="创建"
      cancelText="取消"
      width={600}
      data-testid="create-env-modal"
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item label="PR ID" name="prId" rules={[{ required: true, message: '请输入 PR ID' }]}>
          <Input placeholder="例如：123" />
        </Form.Item>

        <Form.Item label="仓库 ID" name="repoId" rules={[{ required: true, message: '请输入仓库 ID' }]}>
          <Input placeholder="例如：org/repo" />
        </Form.Item>

        <Form.Item label="分支名称" name="branchName" rules={[{ required: true, message: '请输入分支名称' }]}>
          <Input placeholder="例如：feature/my-feature" />
        </Form.Item>

        <Form.Item label="Commit SHA" name="commitSha" rules={[{ required: true, message: '请输入 Commit SHA' }]}>
          <Input placeholder="例如：abc1234" />
        </Form.Item>

        <Form.Item label="环境模板" name="templateId">
          <Select placeholder="选择模板 (可选)" allowClear>
            {templates.map((t) => (
              <Select.Option key={t.id} value={t.id}>
                {t.name}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>
      </Form>
    </Modal>
  );
};

// ============================================================================
// Main EphemeralEnvList Component
// ============================================================================

const EphemeralEnvList: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});
  const [loading, setLoading] = useState(false);
  const [envs, setEnvs] = useState<EphemeralEnvironment[]>([]);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [costDrawerOpen, setCostDrawerOpen] = useState(false);
  const [selectedEnv, setSelectedEnv] = useState<EphemeralEnvironment | null>(null);

  useEffect(() => {
    loadEnvs();
  }, []);

  const loadEnvs = async () => {
    setLoading(true);
    try {
      const response = await getEphemeralEnvs({});
      setEnvs(response.data?.data || []);
    } catch (err: any) {
      console.error('Failed to load environments:', err);
      message.error('加载环境列表失败');
    } finally {
      setLoading(false);
    }
  };

  const filteredEnvs = useMemo(() => {
    return envs.filter((env) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const searchable = [
          env.prId,
          env.repoId,
          env.branchName,
          env.namespace,
          env.commitSha,
        ].join(' ').toLowerCase();
        if (!searchable.includes(query)) return false;
      }

      const statusFilter = filters.status;
      if (statusFilter && statusFilter !== 'all' && env.status !== statusFilter) return false;

      const repoFilter = filters.repo;
      if (repoFilter && repoFilter !== 'all' && env.repoId !== repoFilter) return false;

      return true;
    });
  }, [searchQuery, filters, envs]);

  // Unique repos for filter
  const uniqueRepos = useMemo(() => {
    const repos = [...new Set(envs.map((e) => e.repoId))];
    return repos.map((r) => ({ label: r, value: r }));
  }, [envs]);

  // Summary metrics
  const totalCount = envs.length;
  const runningCount = envs.filter((e) => e.status === 'running').length;
  const idleCount = envs.filter((e) => e.status === 'idle').length;
  const activeCount = envs.filter((e) => ['provisioning', 'running'].includes(e.status)).length;

  const filterDefs: FilterDefinition[] = [
    {
      key: 'status',
      label: '状态',
      options: STATUS_OPTIONS,
    },
    {
      key: 'repo',
      label: '仓库',
      options: [{ label: '全部', value: 'all' }, ...uniqueRepos],
    },
  ];

  const handleViewDetail = (env: EphemeralEnvironment) => {
    navigate(`/ephemeral-envs/${env.id}`);
  };

  const handleOpenPreview = (env: EphemeralEnvironment) => {
    if (env.previewUrl) {
      window.open(env.previewUrl, '_blank');
    } else {
      message.warning('该环境暂无 Preview URL');
    }
  };

  const handleWake = async (env: EphemeralEnvironment) => {
    try {
      await wakeEphemeralEnv(env.id);
      message.success('环境已唤醒');
      await loadEnvs();
    } catch (err: any) {
      message.error(`唤醒失败：${err.message}`);
    }
  };

  const handleTeardown = async (env: EphemeralEnvironment) => {
    try {
      await teardownEphemeralEnv(env.id);
      message.success('环境销毁已触发');
      await loadEnvs();
    } catch (err: any) {
      message.error(`销毁失败：${err.message}`);
    }
  };

  const handleViewCost = (env: EphemeralEnvironment) => {
    setSelectedEnv(env);
    setCostDrawerOpen(true);
  };

  const columns: TableColumn<EphemeralEnvironment>[] = [
    {
      key: 'namespace',
      title: '环境',
      dataIndex: 'namespace',
      width: 180,
      render: (value: unknown, record: EphemeralEnvironment) => (
        <Space direction="vertical" size={0}>
          <Button
            type="link"
            size="small"
            onClick={() => handleViewDetail(record)}
            style={{ padding: 0, height: 'auto' }}
          >
            <Text strong>{String(value)}</Text>
          </Button>
          <Text type="secondary" style={{ fontSize: 11 }}>
            PR #{record.prId}
          </Text>
        </Space>
      ),
    },
    {
      key: 'repo',
      title: '仓库',
      dataIndex: 'repoId',
      width: 160,
      render: (value: unknown) => (
        <Space>
          <CloudServerOutlined style={{ color: '#1890ff' }} />
          <Text style={{ fontSize: 12 }}>{String(value)}</Text>
        </Space>
      ),
    },
    {
      key: 'branch',
      title: '分支',
      dataIndex: 'branchName',
      width: 160,
      render: (value: unknown) => <Tag color="cyan">{String(value)}</Tag>,
    },
    {
      key: 'status',
      title: '状态',
      dataIndex: 'status',
      width: 130,
      render: (value: unknown) => {
        const status = String(value);
        return (
          <Badge
            status={statusToColor[status] as any}
            text={statusLabel[status] || status}
          />
        );
      },
    },
    {
      key: 'previewUrl',
      title: 'Preview',
      dataIndex: 'previewUrl',
      width: 100,
      render: (value: unknown, record: EphemeralEnvironment) =>
        value ? (
          <Button
            type="link"
            size="small"
            icon={<LinkOutlined />}
            onClick={() => handleOpenPreview(record)}
          >
            打开
          </Button>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
    {
      key: 'resources',
      title: '资源',
      dataIndex: 'resources',
      width: 140,
      render: (value: unknown) => {
        if (!value) return <Text type="secondary">-</Text>;
        const res = value as { cpu?: string; memory?: string };
        return (
          <Text style={{ fontSize: 11 }}>
            CPU: {res.cpu || '-'} / MEM: {res.memory || '-'}
          </Text>
        );
      },
    },
    {
      key: 'createdAt',
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 160,
      render: (value: unknown, record: EphemeralEnvironment) => (
        <Space direction="vertical" size={0}>
          <Text style={{ fontSize: 12 }}>
            {value ? dayjs(String(value)).format('YYYY-MM-DD HH:mm') : '-'}
          </Text>
          {record.idleSince && (
            <Text type="secondary" style={{ fontSize: 11 }}>
              空闲自 {dayjs(record.idleSince).format('HH:mm')}
            </Text>
          )}
        </Space>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      width: 240,
      render: (_: unknown, record: EphemeralEnvironment) => {
        const isTeardownable = ['running', 'idle'].includes(record.status);
        const isWakable = record.status === 'idle';

        return (
          <Space size="small" wrap>
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleViewDetail(record)}
            >
              详情
            </Button>
            {record.previewUrl && (
              <Button
                type="link"
                size="small"
                icon={<LinkOutlined />}
                onClick={() => handleOpenPreview(record)}
              >
                Preview
              </Button>
            )}
            {isWakable && (
              <Button
                type="link"
                size="small"
                icon={<ThunderboltOutlined />}
                onClick={() => handleWake(record)}
              >
                唤醒
              </Button>
            )}
            <Button
              type="link"
              size="small"
              icon={<DollarOutlined />}
              onClick={() => handleViewCost(record)}
            >
              成本
            </Button>
            {isTeardownable && (
              <Popconfirm
                title="确认销毁"
                description="确定要销毁该环境吗？此操作不可撤销。"
                onConfirm={() => handleTeardown(record)}
                okText="销毁"
                cancelText="取消"
                okButtonProps={{ danger: true }}
              >
                <Button
                  type="link"
                  size="small"
                  danger
                  icon={<PoweroffOutlined />}
                >
                  销毁
                </Button>
              </Popconfirm>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <div style={{ padding: 0 }} data-testid="ephemeral-env-list-page">
      {/* Page header */}
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
            临时开发环境
          </Title>
          <Text type="secondary">
            共 {filteredEnvs.length} 个环境
          </Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadEnvs} loading={loading}>
            刷新
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateModalOpen(true)}
            data-testid="create-env-button"
          >
            创建环境
          </Button>
        </Space>
      </div>

      {/* Summary cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 24,
        }}
        data-testid="env-summary-cards"
      >
        <MetricCard
          title="环境总数"
          value={totalCount}
          icon={<AppstoreOutlined />}
          color="#1890ff"
          footer="所有环境 (含已销毁)"
        />
        <MetricCard
          title="活跃环境"
          value={activeCount}
          icon={<ThunderboltOutlined />}
          color="#52c41a"
          footer="创建中 + 运行中"
        />
        <MetricCard
          title="运行中"
          value={runningCount}
          icon={<CloudServerOutlined />}
          color="#722ed1"
          footer="正在运行的环境"
        />
        <MetricCard
          title="空闲"
          value={idleCount}
          icon={<ClockCircleOutlined />}
          color="#faad14"
          footer="空闲等待回收"
        />
      </div>

      {/* Search and filter bar */}
      <div style={{ marginBottom: 16 }}>
        <SearchFilterBar
          onSearch={setSearchQuery}
          onFilter={setFilters}
          filters={filterDefs}
          searchPlaceholder="搜索 PR、仓库、分支、Namespace..."
        />
      </div>

      {/* Environment table */}
      <Table
        columns={columns as any}
        dataSource={filteredEnvs as any}
        loading={loading}
        rowKey="id"
        size="middle"
        striped
        data-testid="env-table"
      />

      {/* Create environment modal */}
      <CreateEnvModal
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        onSuccess={() => {
          setCreateModalOpen(false);
          loadEnvs();
        }}
      />

      {/* Cost drawer */}
      <CostDrawer
        env={selectedEnv}
        open={costDrawerOpen}
        onClose={() => {
          setCostDrawerOpen(false);
          setSelectedEnv(null);
        }}
      />
    </div>
  );
};

export default EphemeralEnvList;
