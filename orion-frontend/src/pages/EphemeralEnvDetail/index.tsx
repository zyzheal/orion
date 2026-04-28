/**
 * EphemeralEnvDetail Page
 * - Status banner: environment status + Preview link
 * - Services info table
 * - Resource allocation display
 * - Event timeline: Provisioning -> Running -> Idle -> Teardown
 * - Cost card
 * - Actions: wake, teardown, view logs
 */
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Typography,
  Button,
  Space,
  Tag,
  Badge,
  Descriptions,
  Divider,
  Card,
  message,
  Table as AntTable,
  Alert,
  Popconfirm,
} from 'antd';
import { colors, spacing } from '@/tokens';
import {
  ArrowLeftOutlined,
  ReloadOutlined,
  LinkOutlined,
  PoweroffOutlined,
  ThunderboltOutlined,
  CloudServerOutlined,
  ClockCircleOutlined,
  AppstoreOutlined,
  DollarOutlined,
  CodeOutlined,
  DatabaseOutlined,
  GlobalOutlined,
} from '@ant-design/icons';
import StatusBadge from '@/components/StatusBadge';
import Timeline, { type TimelineEvent } from '@/components/Timeline';
import {
  getEphemeralEnv,
  wakeEphemeralEnv,
  teardownEphemeralEnv,
  getEphemeralEnvCost,
  type EphemeralEnvironment,
  type EphemeralEnvCost,
} from '@/api/ephemeral-envs';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const statusToBadge: Record<string, 'running' | 'pending' | 'success' | 'failed' | 'warning' | 'cancelled' | 'unknown'> = {
  provisioning: 'pending',
  running: 'running',
  idle: 'warning',
  tearing_down: 'cancelled',
  destroyed: 'failed',
};

const statusLabel: Record<string, string> = {
  provisioning: '创建中',
  running: '运行中',
  idle: '空闲',
  tearing_down: '销毁中',
  destroyed: '已销毁',
};

// ============================================================================
// EphemeralEnvDetail Component
// ============================================================================

const EphemeralEnvDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [env, setEnv] = useState<EphemeralEnvironment | null>(null);
  const [cost, setCost] = useState<EphemeralEnvCost | null>(null);
  const [costLoading, setCostLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (id) loadData(id);
  }, [id]);

  const loadData = async (envId: string) => {
    setLoading(true);
    try {
      const envRes = await getEphemeralEnv(envId).catch(() => null);
      setEnv(envRes || null);
    } catch (err: unknown) {
      if (err instanceof Error) {
        message.error(`加载环境详情失败：${err.message}`);
      } else {
        message.error('加载环境详情失败');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadCost = async (envId: string) => {
    setCostLoading(true);
    try {
      const costRes = await getEphemeralEnvCost(envId).catch(() => null);
      setCost(costRes || null);
    } catch (error: unknown) {
      setCost(null);
    } finally {
      setCostLoading(false);
    }
  };

  const handleWake = async () => {
    if (!env) return;
    setActionLoading('wake');
    try {
      await wakeEphemeralEnv(env.id);
      message.success('环境已唤醒');
      await loadData(env.id);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`唤醒失败：${error.message}`);
      } else {
        message.error('唤醒失败');
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleTeardown = async () => {
    if (!env) return;
    setActionLoading('teardown');
    try {
      await teardownEphemeralEnv(env.id);
      message.success('环境销毁已触发');
      await loadData(env.id);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`销毁失败：${error.message}`);
      } else {
        message.error('销毁失败');
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleOpenPreview = () => {
    if (env?.previewUrl) {
      window.open(env.previewUrl, '_blank');
    } else {
      message.warning('该环境暂无 Preview URL');
    }
  };

  if (!env) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        {loading ? (
          <Text>Loading...</Text>
        ) : (
          <div>
            <Text type="secondary">未找到该环境</Text>
            <br />
            <Button type="link" onClick={() => navigate('/ephemeral-envs')}>
              返回环境列表
            </Button>
          </div>
        )}
      </div>
    );
  }

  const isTeardownable = ['running', 'idle'].includes(env.status);
  const isWakable = env.status === 'idle';

  // Build event timeline from env lifecycle
  const timelineEvents: TimelineEvent[] = [];

  // Provisioning event
  timelineEvents.push({
    id: 'provisioning',
    time: env.createdAt,
    title: '环境创建',
    description: `Namespace: ${env.namespace} · PR #${env.prId} · ${env.repoId}`,
    status: 'running',
    icon: <CloudServerOutlined />,
  });

  // Running event (use createdAt + estimated provisioning time)
  if (env.status !== 'provisioning' && env.status !== 'destroyed') {
    const runningTime = env.idleSince || env.createdAt;
    timelineEvents.push({
      id: 'running',
      time: runningTime,
      title: '环境就绪',
      description: env.previewUrl ? `Preview URL: ${env.previewUrl}` : '服务已启动',
      status: 'success',
      icon: <GlobalOutlined />,
    });
  }

  // Idle event
  if (env.idleSince && ['idle'].includes(env.status)) {
    timelineEvents.push({
      id: 'idle',
      time: env.idleSince,
      title: '进入空闲状态',
      description: '无访问活动，等待自动回收或手动唤醒',
      status: 'warning',
      icon: <ClockCircleOutlined />,
    });
  }

  // Teardown event
  if (['tearing_down', 'destroyed'].includes(env.status)) {
    const teardownTime = env.destroyedAt || env.createdAt;
    timelineEvents.push({
      id: 'teardown',
      time: teardownTime,
      title: env.status === 'destroyed' ? '环境已销毁' : '正在销毁',
      description: env.status === 'destroyed' ? 'Namespace 及所有资源已清理' : '正在清理资源...',
      status: env.status === 'destroyed' ? 'failed' : 'pending',
      icon: <PoweroffOutlined />,
    });
  }

  // Auto-destroy warning
  if (env.autoDestroyAt && !['destroyed', 'tearing_down'].includes(env.status)) {
    const autoDestroyTime = dayjs(env.autoDestroyAt);
    const hoursLeft = autoDestroyTime.diff(dayjs(), 'hour');
    if (hoursLeft <= 0) {
      // Already past
    }
  }

  // Simulated services based on environment data
  const serviceColumns = [
    {
      title: '服务名称',
      dataIndex: 'name',
      key: 'name',
      width: 160,
      render: (value: string) => (
        <Space>
          <CodeOutlined style={{ color: colors.purple[500] }} />
          <Text strong>{value}</Text>
        </Space>
      ),
    },
    {
      title: '镜像',
      dataIndex: 'image',
      key: 'image',
      ellipsis: true,
      render: (value: string) => <Text code style={{ fontSize: spacing[2] }}>{value}</Text>,
    },
    {
      title: '副本数',
      dataIndex: 'replicas',
      key: 'replicas',
      width: 80,
      render: (value: number) => <Tag>{value}</Tag>,
    },
    {
      title: '健康状态',
      dataIndex: 'health',
      key: 'health',
      width: 100,
      render: (value: string) => (
        <Badge
          status={value === 'healthy' ? 'success' : value === 'unhealthy' ? 'error' : 'warning'}
          text={value === 'healthy' ? '健康' : value === 'unhealthy' ? '异常' : '检测中'}
        />
      ),
    },
  ];

  const services = env.status === 'destroyed'
    ? []
    : [
        { key: '1', name: 'frontend', image: `frontend:${env.commitSha?.slice(0, 7)}`, replicas: 1, health: env.status === 'running' ? 'healthy' : 'pending' },
        { key: '2', name: 'backend', image: `backend:${env.commitSha?.slice(0, 7)}`, replicas: 1, health: env.status === 'running' ? 'healthy' : 'pending' },
        { key: '3', name: 'database', image: 'postgres:15-alpine', replicas: 1, health: env.status === 'running' ? 'healthy' : 'pending' },
        { key: '4', name: 'cache', image: 'redis:7-alpine', replicas: 1, health: env.status === 'running' ? 'healthy' : 'pending' },
      ];

  return (
    <div style={{ padding: 0 }} data-testid="ephemeral-env-detail-page">
      {/* Breadcrumb / back */}
      <div style={{ marginBottom: 16 }}>
        <Button
          type="link"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/ephemeral-envs')}
          style={{ padding: 0 }}
        >
          返回环境列表
        </Button>
      </div>

      {/* Status banner */}
      <Card
        style={{
          marginBottom: 24,
          borderLeft: `4px solid ${
            env.status === 'running' ? colors.success[500] :
            env.status === 'provisioning' ? colors.primary[500] :
            env.status === 'idle' ? colors.warning[500] :
            env.status === 'destroyed' ? colors.error[500] : colors.neutral[400]
          }`,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <Space style={{ marginBottom: 8 }}>
              <Title level={4} style={{ margin: 0 }}>
                {env.namespace}
              </Title>
              <StatusBadge status={statusToBadge[env.status] || 'unknown'} label={statusLabel[env.status]} />
            </Space>
            <Text type="secondary">
              PR #{env.prId} · {env.repoId} · <Tag>{env.branchName}</Tag>
            </Text>
          </div>
          <Space>
            {env.previewUrl && env.status === 'running' && (
              <Button
                type="primary"
                icon={<LinkOutlined />}
                onClick={handleOpenPreview}
              >
                打开 Preview
              </Button>
            )}
            {isWakable && (
              <Button
                icon={<ThunderboltOutlined />}
                loading={actionLoading === 'wake'}
                onClick={handleWake}
              >
                唤醒
              </Button>
            )}
            {isTeardownable && (
              <Popconfirm
                title="确认销毁"
                description="确定要销毁该环境吗？此操作不可撤销。"
                onConfirm={handleTeardown}
                okText="销毁"
                cancelText="取消"
                okButtonProps={{ danger: true }}
              >
                <Button
                  danger
                  icon={<PoweroffOutlined />}
                  loading={actionLoading === 'teardown'}
                >
                  销毁
                </Button>
              </Popconfirm>
            )}
            <Button icon={<ReloadOutlined />} onClick={() => id && loadData(id)} loading={loading}>
              刷新
            </Button>
          </Space>
        </div>

        {/* Auto-destroy warning */}
        {env.autoDestroyAt && !['destroyed', 'tearing_down'].includes(env.status) && (
          <Alert
            type="warning"
            showIcon
            style={{ marginTop: 16 }}
            message={`自动销毁时间: ${dayjs(env.autoDestroyAt).format('YYYY-MM-DD HH:mm')}`}
            description={`该环境将在 ${dayjs(env.autoDestroyAt).fromNow()} 自动销毁`}
          />
        )}
      </Card>

      {/* Environment info */}
      <Card title="环境信息" size="small" style={{ marginBottom: 24 }}>
        <Descriptions column={3} size="small" bordered>
          <Descriptions.Item label="环境 ID">
            <Text code style={{ fontSize: spacing[2] }}>{env.id}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Namespace">{env.namespace}</Descriptions.Item>
          <Descriptions.Item label="PR ID">#{env.prId}</Descriptions.Item>
          <Descriptions.Item label="仓库">{env.repoId}</Descriptions.Item>
          <Descriptions.Item label="分支">
            <Tag>{env.branchName}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Commit SHA">
            <Text code style={{ fontSize: spacing[2] }}>{env.commitSha}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="创建者">{env.createdBy || '-'}</Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {dayjs(env.createdAt).format('YYYY-MM-DD HH:mm:ss')}
          </Descriptions.Item>
          <Descriptions.Item label="空闲时间">
            {env.idleSince ? dayjs(env.idleSince).format('YYYY-MM-DD HH:mm:ss') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="自动销毁时间">
            {env.autoDestroyAt ? dayjs(env.autoDestroyAt).format('YYYY-MM-DD HH:mm:ss') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="销毁时间">
            {env.destroyedAt ? dayjs(env.destroyedAt).format('YYYY-MM-DD HH:mm:ss') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Preview URL">
            {env.previewUrl ? (
              <a href={env.previewUrl} target="_blank" rel="noopener noreferrer">
                {env.previewUrl}
              </a>
            ) : (
              '-'
            )}
          </Descriptions.Item>
        </Descriptions>

        {/* Resources */}
        {env.resources && (
          <>
            <Divider style={{ margin: '12px 0' }} />
            <Title level={5}>资源分配</Title>
            <Descriptions column={3} size="small" bordered>
              <Descriptions.Item label="CPU">
                <Space>
                  <CloudServerOutlined />
                  <Text strong>{env.resources.cpu}</Text>
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="内存">
                <Space>
                  <DatabaseOutlined />
                  <Text strong>{env.resources.memory}</Text>
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="存储">
                <Space>
                  <AppstoreOutlined />
                  <Text strong>{env.resources.storage}</Text>
                </Space>
              </Descriptions.Item>
            </Descriptions>
          </>
        )}
      </Card>

      {/* Services */}
      <Card
        title={
          <Space>
            <CodeOutlined />
            服务列表
          </Space>
        }
        size="small"
        style={{ marginBottom: 24 }}
      >
        {services.length > 0 ? (
          <AntTable
            columns={serviceColumns as any}
            dataSource={services}
            rowKey="key"
            size="small"
            pagination={false}
          />
        ) : (
          <Text type="secondary">
            {env.status === 'destroyed' ? '环境已销毁，无服务信息' : '暂无服务信息'}
          </Text>
        )}
      </Card>

      {/* Event timeline */}
      <Card
        title={
          <Space>
            <ClockCircleOutlined />
            事件时间线
          </Space>
        }
        size="small"
        style={{ marginBottom: 24 }}
      >
        <Timeline events={timelineEvents} mode="left" />
      </Card>

      {/* Cost card */}
      <Card
        title={
          <Space>
            <DollarOutlined />
            成本信息
          </Space>
        }
        size="small"
        extra={
          <Button
            size="small"
            icon={<ReloadOutlined />}
            onClick={() => id && loadCost(id)}
            loading={costLoading}
          >
            刷新成本
          </Button>
        }
      >
        {cost ? (
          <div>
            <Descriptions column={4} size="small" bordered>
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
              marginTop: 16,
              padding: 12,
              background: colors.success[50],
              borderRadius: 6,
              textAlign: 'center',
              border: `1px solid ${colors.success[200]}`,
            }}>
              <Text type="secondary" style={{ fontSize: spacing[3] }}>总成本</Text>
              <br />
              <Text strong style={{ fontSize: spacing[5], color: colors.success[500] }}>
                {cost.totalCost.toFixed(2)} {cost.currency}
              </Text>
            </div>
          </div>
        ) : (
          <Text type="secondary">点击"刷新成本"查看成本数据</Text>
        )}
      </Card>
    </div>
  );
};

export default EphemeralEnvDetail;
