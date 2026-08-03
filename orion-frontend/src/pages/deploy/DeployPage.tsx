/**
 * Deploy Page
 * Deployment list, deployment windows, progressive deployment, emergency deploy
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
  Table as AntTable,
  Descriptions,
  Drawer,
  Row,
  Col,
  Statistic,
  Steps,
  Timeline,
  Tooltip,
  Alert,
  Tabs,
  Progress,
  DatePicker,
  Switch,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  EyeOutlined,
  RocketOutlined,
  PauseCircleOutlined,
  StopOutlined,
  ThunderboltOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  RiseOutlined,
  RollbackOutlined,
  CloudUploadOutlined,} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { api } from '@/api/client';
import type { Deployment, HealthCheckResult } from '@/api/deployments';
import { getDeployments, cancelDeployment, rollbackDeployment } from '@/api/deployments';
import { getReleaseNotes, generateReleaseNotes, type ReleaseNotes, type ReleaseNotesChange } from '@/api/deploy';
import { colors, spacing } from '@/tokens';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

// ---- Progressive Deploy Interfaces ----

interface ProgressiveStage {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  trafficPercent: number;
  startedAt?: string;
  completedAt?: string;
}

interface ProgressiveDeployment {
  id: string;
  appName: string;
  version: string;
  environment: string;
  currentStage: number;
  stages: ProgressiveStage[];
  status: 'pending' | 'running' | 'completed' | 'rolled_back' | 'failed';
  createdAt: string;
}

// ---- Deploy Window Interface ----

interface DeployWindow {
  id: string;
  name: string;
  environment: string;
  startTime: string;
  endTime: string;
  recurring: boolean;
  recurringPattern?: 'daily' | 'weekly' | 'monthly';
  description?: string;
  status: 'active' | 'expired' | 'upcoming';
}

// ---- Color / label maps ----

const statusColorMap: Record<string, string> = {
  pending: 'default',
  deploying: 'blue',
  success: 'green',
  failed: 'red',
  rolled_back: 'gold',
  cancelled: 'default',
};

const statusLabelMap: Record<string, string> = {
  pending: '等待中',
  deploying: '部署中',
  success: '成功',
  failed: '失败',
  rolled_back: '已回滚',
  cancelled: '已取消',
};

const statusIconMap: Record<string, React.ReactNode> = {
  pending: <ClockCircleOutlined />,
  deploying: <SyncOutlined spin />,
  success: <CheckCircleOutlined />,
  failed: <CloseCircleOutlined />,
  rolled_back: <PauseCircleOutlined />,
  cancelled: <StopOutlined />,
};

const strategyColorMap: Record<string, string> = {
  'blue-green': 'cyan',
  canary: 'orange',
  rolling: 'blue',
  recreate: 'purple',
};

const strategyLabelMap: Record<string, string> = {
  'blue-green': '蓝绿部署',
  canary: '金丝雀',
  rolling: '滚动部署',
  recreate: '重建部署',
};

const envColorMap: Record<string, string> = {
  dev: 'blue',
  staging: 'orange',
  prod: 'red',
};

const envLabelMap: Record<string, string> = {
  dev: '开发',
  staging: '预发',
  prod: '生产',
};

// ---- Stat Card ----

const StatCard: React.FC<{
  title: string;
  value: number;
  icon: React.ReactNode;
  color?: string;
}> = ({ title, value, icon, color }) => (
  <Card size="small">
    <Statistic
      title={<Text type="secondary">{title}</Text>}
      value={value}
      prefix={icon}
      valueStyle={{ color }}
    />
  </Card>
);

// ---- Main Component ----

const DeployPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});

  // Create modal
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  // Emergency deploy modal
  const [emergencyModalVisible, setEmergencyModalVisible] = useState(false);
  const [emergencyForm] = Form.useForm();
  const [emergencyLoading, setEmergencyLoading] = useState(false);

  // Detail drawer
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedDeployment, setSelectedDeployment] = useState<Deployment | null>(null);

  // Release Notes state
  const [releaseNotes, setReleaseNotes] = useState<ReleaseNotes | null>(null);
  const [releaseNotesLoading, setReleaseNotesLoading] = useState(false);
  const [generatingNotes, setGeneratingNotes] = useState(false);

  // Deploy Window state
  const [deployWindows, setDeployWindows] = useState<DeployWindow[]>([
    { id: '1', name: '生产窗口-工作日', environment: 'prod', startTime: '2026-05-06 10:00', endTime: '2026-05-06 16:00', recurring: true, recurringPattern: 'weekly', description: '生产环境工作日部署窗口', status: 'active' },
    { id: '2', name: '预发窗口', environment: 'staging', startTime: '2026-05-06 09:00', endTime: '2026-05-06 18:00', recurring: true, recurringPattern: 'daily', description: '预发环境日常部署窗口', status: 'active' },
    { id: '3', name: '开发窗口', environment: 'dev', startTime: '2026-05-01 00:00', endTime: '2026-05-31 23:59', recurring: false, description: '开发环境月度窗口', status: 'upcoming' },
  ]);
  const [deployWindowModalVisible, setDeployWindowModalVisible] = useState(false);
  const [deployWindowForm] = Form.useForm();
  const [deployWindowSubmitting, setDeployWindowSubmitting] = useState(false);

  // Progressive Deploy state
  const [progressiveDeploys, setProgressiveDeploys] = useState<ProgressiveDeployment[]>([
    {
      id: 'pd-001', appName: 'orion-platform', version: '2.1.0', environment: 'prod',
      currentStage: 2, status: 'running', createdAt: '2026-05-06 10:30',
      stages: [
        { name: 'Canary (5%)', status: 'completed', trafficPercent: 5, startedAt: '2026-05-06 10:30', completedAt: '2026-05-06 10:45' },
        { name: '25% 流量', status: 'completed', trafficPercent: 25, startedAt: '2026-05-06 10:45', completedAt: '2026-05-06 11:00' },
        { name: '50% 流量', status: 'running', trafficPercent: 50, startedAt: '2026-05-06 11:00' },
        { name: '75% 流量', status: 'pending', trafficPercent: 75 },
        { name: '100% 全量', status: 'pending', trafficPercent: 100 },
      ],
    },
    {
      id: 'pd-002', appName: 'orion-api', version: '1.5.3', environment: 'staging',
      currentStage: 4, status: 'running', createdAt: '2026-05-06 09:00',
      stages: [
        { name: 'Canary (5%)', status: 'completed', trafficPercent: 5 },
        { name: '25% 流量', status: 'completed', trafficPercent: 25 },
        { name: '50% 流量', status: 'completed', trafficPercent: 50 },
        { name: '75% 流量', status: 'completed', trafficPercent: 75 },
        { name: '100% 全量', status: 'running', trafficPercent: 100 },
      ],
    },
    {
      id: 'pd-003', appName: 'orion-frontend', version: '3.0.0-beta', environment: 'prod',
      currentStage: 0, status: 'pending', createdAt: '2026-05-06 14:00',
      stages: [
        { name: 'Canary (5%)', status: 'pending', trafficPercent: 5 },
        { name: '25% 流量', status: 'pending', trafficPercent: 25 },
        { name: '50% 流量', status: 'pending', trafficPercent: 50 },
        { name: '75% 流量', status: 'pending', trafficPercent: 75 },
        { name: '100% 全量', status: 'pending', trafficPercent: 100 },
      ],
    },
  ]);
  const [progressiveDeployModalVisible, setProgressiveDeployModalVisible] = useState(false);
  const [progressiveDeployForm] = Form.useForm();
  const [progressiveDeploySubmitting, setProgressiveDeploySubmitting] = useState(false);
  const [selectedProgressiveDeploy, setSelectedProgressiveDeploy] = useState<ProgressiveDeployment | null>(null);
  const [progressiveDetailVisible, setProgressiveDetailVisible] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getDeployments({ page: 1, pageSize: 100 });
      const raw = res.data;
      setDeployments(Array.isArray(raw) ? raw : []);
    } catch (error: unknown) {
      setDeployments([]);
      message.error(`加载部署列表失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredData = useMemo(() => {
    return deployments.filter((d) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !d.appName.toLowerCase().includes(q) &&
          !(d.version && d.version.toLowerCase().includes(q))
        )
          return false;
      }
      if (filters.environment && filters.environment !== 'all' && d.environment !== filters.environment) return false;
      if (filters.status && filters.status !== 'all' && d.status !== filters.status) return false;
      if (filters.strategy && filters.strategy !== 'all' && d.strategy !== filters.strategy) return false;
      return true;
    });
  }, [searchQuery, filters, deployments]);

  // Stats
  const stats = useMemo(() => {
    const total = deployments.length;
    const success = deployments.filter((d) => d.status === 'success').length;
    const deploying = deployments.filter((d) => d.status === 'deploying').length;
    const failed = deployments.filter((d) => d.status === 'failed').length;
    const successRate = total > 0 ? ((success / total) * 100).toFixed(1) : '0';
    return { total, success, deploying, failed, successRate };
  }, [deployments]);

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      setSubmitting(true);
      const payload = {
        appName: values.appName,
        version: values.version,
        environment: values.environment,
        strategy: values.strategy,
        pipelineRunId: values.pipelineRunId,
        commit: values.commit,
      };
      await api.post('/v1/deploy', payload);
      message.success('部署任务创建成功');
      setCreateModalVisible(false);
      createForm.resetFields();
      loadData();
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        message.error(`创建失败: ${(error as Error).message}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleEmergencyDeploy = async () => {
    try {
      const values = await emergencyForm.validateFields();
      setEmergencyLoading(true);
      await api.post('/v1/deploy', {
        appName: values.appName,
        version: values.version,
        environment: 'prod',
        strategy: 'rolling',
        commit: values.commit,
        pipelineRunId: values.pipelineRunId,
        isEmergency: true,
        reason: values.reason,
      });
      message.success('紧急部署任务已提交');
      setEmergencyModalVisible(false);
      emergencyForm.resetFields();
      loadData();
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        message.error(`紧急部署失败: ${(error as Error).message}`);
      }
    } finally {
      setEmergencyLoading(false);
    }
  };

  const handleExecute = async (id: string) => {
    try {
      await api.post(`/v1/deploy/${id}/execute`);
      message.success('部署已启动');
      loadData();
    } catch (error: unknown) {
      message.error(`启动失败: ${(error as Error).message}`);
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await cancelDeployment(id);
      message.success('部署已取消');
      loadData();
    } catch (error: unknown) {
      message.error(`取消失败: ${(error as Error).message}`);
    }
  };

  const handleRollback = async (id: string) => {
    try {
      await rollbackDeployment(id);
      message.success('回滚已启动');
      loadData();
    } catch (error: unknown) {
      message.error(`回滚失败: ${(error as Error).message}`);
    }
  };

  // ---- Deploy Window Handlers ----

  const handleCreateDeployWindow = async () => {
    try {
      const values = await deployWindowForm.validateFields();
      setDeployWindowSubmitting(true);
      const payload = {
        name: values.name,
        environment: values.environment,
        startTime: values.startTime.format('YYYY-MM-DD HH:mm'),
        endTime: values.endTime.format('YYYY-MM-DD HH:mm'),
        recurring: values.recurring || false,
        recurringPattern: values.recurring ? values.recurringPattern : undefined,
        description: values.description,
      };
      await api.post('/v1/deploy/windows', payload);
      message.success('部署窗口创建成功');
      setDeployWindowModalVisible(false);
      deployWindowForm.resetFields();
      setDeployWindows((prev) => [
        ...prev,
        {
          id: `dw-${Date.now()}`,
          ...payload,
          status: 'upcoming',
        },
      ]);
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        message.error(`创建失败: ${(error as Error).message}`);
      }
    } finally {
      setDeployWindowSubmitting(false);
    }
  };

  const handleDeleteDeployWindow = (id: string) => {
    setDeployWindows((prev) => prev.filter((w) => w.id !== id));
    message.success('部署窗口已删除');
  };

  // ---- Progressive Deploy Handlers ----

  const handleCreateProgressiveDeploy = async () => {
    try {
      const values = await progressiveDeployForm.validateFields();
      setProgressiveDeploySubmitting(true);
      const stages: ProgressiveStage[] = [
        { name: 'Canary (5%)', status: 'pending', trafficPercent: 5 },
        { name: '25% 流量', status: 'pending', trafficPercent: 25 },
        { name: '50% 流量', status: 'pending', trafficPercent: 50 },
        { name: '75% 流量', status: 'pending', trafficPercent: 75 },
        { name: '100% 全量', status: 'pending', trafficPercent: 100 },
      ];
      await api.post('/v1/deploy/progressive', {
        appName: values.appName,
        version: values.version,
        environment: values.environment,
        stages,
      });
      message.success('渐进式部署任务创建成功');
      setProgressiveDeployModalVisible(false);
      progressiveDeployForm.resetFields();
      setProgressiveDeploys((prev) => [
        ...prev,
        {
          id: `pd-${Date.now()}`,
          appName: values.appName,
          version: values.version,
          environment: values.environment,
          currentStage: 0,
          stages,
          status: 'pending',
          createdAt: dayjs().format('YYYY-MM-DD HH:mm'),
        },
      ]);
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        message.error(`创建失败: ${(error as Error).message}`);
      }
    } finally {
      setProgressiveDeploySubmitting(false);
    }
  };

  const handleAdvanceStage = async (deployId: string) => {
    try {
      setProgressiveDeploys((prev) =>
        prev.map((d) => {
          if (d.id !== deployId || d.currentStage >= d.stages.length - 1) return d;
          const newStages = d.stages.map((s, i) => {
            if (i === d.currentStage) {
              return { ...s, status: 'completed' as const, completedAt: dayjs().format('YYYY-MM-DD HH:mm') };
            }
            if (i === d.currentStage + 1) {
              return { ...s, status: 'running' as const, startedAt: dayjs().format('YYYY-MM-DD HH:mm') };
            }
            return s;
          });
          const newCurrentStage = d.currentStage + 1;
          const newStatus = newCurrentStage === d.stages.length - 1 && newStages[newCurrentStage].status === 'completed'
            ? 'completed' as const
            : d.status;
          return { ...d, currentStage: newCurrentStage, stages: newStages, status: newStatus };
        })
      );
      await api.post(`/v1/deploy/progressive/${deployId}/advance`);
      message.success('阶段已推进');
    } catch (error: unknown) {
      message.error(`推进失败: ${(error as Error).message}`);
    }
  };

  const handleRollbackProgressive = async (deployId: string) => {
    try {
      setProgressiveDeploys((prev) =>
        prev.map((d) => {
          if (d.id !== deployId) return d;
          return { ...d, status: 'rolled_back' as const };
        })
      );
      await api.post(`/v1/deploy/progressive/${deployId}/rollback`);
      message.success('渐进式部署已回滚');
    } catch (error: unknown) {
      message.error(`回滚失败: ${(error as Error).message}`);
    }
  };

  const openProgressiveDetail = (d: ProgressiveDeployment) => {
    setSelectedProgressiveDeploy(d);
    setProgressiveDetailVisible(true);
  };

  const openDetail = async (d: Deployment) => {
    setSelectedDeployment(d);
    setDetailDrawerVisible(true);
    setReleaseNotes(null);
    setReleaseNotesLoading(true);
    // 加载该部署的版本说明
    try {
      const notes = await getReleaseNotes(d.id);
      setReleaseNotes(notes);
    } catch {
      // 版本说明不存在时静默处理
    } finally {
      setReleaseNotesLoading(false);
    }
  };

  const handleGenerateReleaseNotes = async () => {
    if (!selectedDeployment) return;
    try {
      setGeneratingNotes(true);
      const notes = await generateReleaseNotes(selectedDeployment.id, {
        toCommit: selectedDeployment.commit,
      });
      setReleaseNotes(notes);
      message.success('版本说明生成成功');
    } catch (error: unknown) {
      message.error(`生成版本说明失败: ${(error as Error).message}`);
    } finally {
      setGeneratingNotes(false);
    }
  };

  // ---- Table columns ----

  const columns: ColumnsType<Deployment> = [
    {
      title: '应用',
      dataIndex: 'appName',
      key: 'appName',
      width: 160,
      sorter: (a, b) => a.appName.localeCompare(b.appName),
      render: (v: string, record) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ cursor: 'pointer' }} onClick={() => openDetail(record)}>
            {v}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>v{record.version}</Text>
        </Space>
      ),
    },
    {
      title: '环境',
      dataIndex: 'environment',
      key: 'environment',
      width: 80,
      render: (v: string) => (
        <Tag color={envColorMap[v] || 'default'}>{envLabelMap[v] || v}</Tag>
      ),
    },
    {
      title: '策略',
      dataIndex: 'strategy',
      key: 'strategy',
      width: 120,
      render: (v: string) => (
        <Tag color={strategyColorMap[v] || 'default'}>
          {strategyLabelMap[v] || v}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (v: string) => (
        <Tag color={statusColorMap[v] || 'default'} icon={statusIconMap[v]}>
          {statusLabelMap[v] || v}
        </Tag>
      ),
    },
    {
      title: '触发人',
      dataIndex: 'triggeredBy',
      key: 'triggeredBy',
      width: 120,
      render: (v: string) => <Text type="secondary">{v || '-'}</Text>,
    },
    {
      title: 'Commit',
      dataIndex: 'commit',
      key: 'commit',
      width: 100,
      render: (v: string) => (
        <Text type="secondary" style={{ fontSize: 12, fontFamily: 'monospace' }}>
          {v ? v.slice(0, 7) : '-'}
        </Text>
      ),
    },
    {
      title: '耗时',
      key: 'duration',
      width: 100,
      render: (_, record) => {
        if (record.duration) {
          const mins = Math.floor(record.duration / 60);
          const secs = record.duration % 60;
          return <Text>{mins > 0 ? `${mins}m ${secs}s` : `${secs}s`}</Text>;
        }
        if (record.startTime && record.endTime) {
          const diff = dayjs(record.endTime).diff(dayjs(record.startTime), 'second');
          const mins = Math.floor(diff / 60);
          const secs = diff % 60;
          return <Text>{mins > 0 ? `${mins}m ${secs}s` : `${secs}s`}</Text>;
        }
        return <Text type="secondary">-</Text>;
      },
    },
    {
      title: '开始时间',
      dataIndex: 'startTime',
      key: 'startTime',
      width: 160,
      render: (v: string) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-'}
        </Text>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 240,
      render: (_, record) => (
        <Space size="small" wrap>
          <Tooltip title="详情">
            <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => openDetail(record)}>
              详情
            </Button>
          </Tooltip>
          {record.status === 'pending' && (
            <Tooltip title="启动部署">
              <Button
                type="link"
                size="small"
                icon={<RocketOutlined />}
                onClick={() => handleExecute(record.id)}
              >
                启动
              </Button>
            </Tooltip>
          )}
          {record.status === 'deploying' && (
            <Tooltip title="取消部署">
              <Button
                type="link"
                size="small"
                danger
                icon={<StopOutlined />}
                onClick={() => handleCancel(record.id)}
              >
                取消
              </Button>
            </Tooltip>
          )}
          {record.status === 'success' && (
            <Tooltip title="回滚">
              <Button
                type="link"
                size="small"
                icon={<PauseCircleOutlined />}
                onClick={() => handleRollback(record.id)}
              >
                回滚
              </Button>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  // ---- Progressive Deploy Table Columns ----

  const progressiveColumns: ColumnsType<ProgressiveDeployment> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 100,
      render: (v: string) => <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</Text>,
    },
    {
      title: '应用',
      dataIndex: 'appName',
      key: 'appName',
      width: 140,
      render: (v: string, record) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ cursor: 'pointer' }} onClick={() => openProgressiveDetail(record)}>
            {v}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>v{record.version}</Text>
        </Space>
      ),
    },
    {
      title: '环境',
      dataIndex: 'environment',
      key: 'environment',
      width: 80,
      render: (v: string) => (
        <Tag color={envColorMap[v] || 'default'}>{envLabelMap[v] || v}</Tag>
      ),
    },
    {
      title: '当前阶段',
      dataIndex: 'currentStage',
      key: 'currentStage',
      width: 120,
      render: (_: number, record) => {
        const stage = record.stages[record.currentStage];
        return stage ? (
          <Tag color={stage.status === 'completed' ? 'green' : stage.status === 'running' ? 'blue' : 'default'}>
            {stage.name}
          </Tag>
        ) : '-';
      },
    },
    {
      title: '进度',
      key: 'progress',
      width: 160,
      render: (_, record) => {
        const completedStages = record.stages.filter((s) => s.status === 'completed').length;
        const percent = Math.round((completedStages / record.stages.length) * 100);
        return (
          <Progress
            percent={percent}
            size="small"
            status={record.status === 'rolled_back' ? 'exception' : record.status === 'completed' ? 'success' : 'active'}
          />
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: string) => {
        const colorMap: Record<string, string> = {
          pending: 'default',
          running: 'blue',
          completed: 'green',
          rolled_back: 'gold',
          failed: 'red',
        };
        const labelMap: Record<string, string> = {
          pending: '等待中',
          running: '进行中',
          completed: '已完成',
          rolled_back: '已回滚',
          failed: '失败',
        };
        return <Tag color={colorMap[v] || 'default'}>{labelMap[v] || v}</Tag>;
      },
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 140,
      render: (v: string) => (
        <Text type="secondary" style={{ fontSize: 12 }}>{v}</Text>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_, record) => (
        <Space size="small" wrap>
          <Tooltip title="查看详情">
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => openProgressiveDetail(record)}
            >
              详情
            </Button>
          </Tooltip>
          {record.status === 'running' && (
            <Tooltip title="推进到下一阶段">
              <Button
                type="link"
                size="small"
                icon={<RiseOutlined />}
                onClick={() => handleAdvanceStage(record.id)}
              >
                推进
              </Button>
            </Tooltip>
          )}
          {record.status === 'running' && (
            <Tooltip title="回滚部署">
              <Button
                type="link"
                size="small"
                danger
                icon={<RollbackOutlined />}
                onClick={() => handleRollbackProgressive(record.id)}
              >
                回滚
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
          marginBottom: spacing.lg,
        }}
      >
        <div>
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <CloudUploadOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            部署发布
          </Title>
          <Text type="secondary">管理部署任务、部署窗口、渐进式部署和紧急部署</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
          <Button
            icon={<ThunderboltOutlined />}
            danger
            onClick={() => {
              emergencyForm.resetFields();
              setEmergencyModalVisible(true);
            }}
          >
            紧急部署
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateModalVisible(true)}
          >
            创建部署
          </Button>
        </Space>
      </div>

      {/* Stats Panel */}
      <Row gutter={16} style={{ marginBottom: spacing.lg }}>
        <Col span={5}>
          <StatCard title="总部署数" value={stats.total} icon={<RocketOutlined />} />
        </Col>
        <Col span={5}>
          <StatCard title="部署中" value={stats.deploying} icon={<SyncOutlined spin />} color={colors.primary[500]} />
        </Col>
        <Col span={5}>
          <StatCard title="成功" value={stats.success} icon={<CheckCircleOutlined />} color={colors.success[500]} />
        </Col>
        <Col span={5}>
          <StatCard title="失败" value={stats.failed} icon={<CloseCircleOutlined />} color={colors.error[500]} />
        </Col>
        <Col span={4}>
          <Statistic
            title={<Text type="secondary">成功率</Text>}
            value={stats.successRate}
            suffix="%"
            valueStyle={{ color: parseFloat(stats.successRate) >= 90 ? colors.success[500] : colors.warning[500] }}
          />
        </Col>
      </Row>

      {/* Tabs: Deployments / Deploy Windows / Progressive Deploy */}
      <Tabs defaultActiveKey="deployments" size="large">
        {/* Tab 1: Deployments */}
        <TabPane
          tab={<><RocketOutlined style={{ marginRight: 6 }} />部署任务</>}
          key="deployments"
        >
          <Card>
            <div style={{ marginBottom: spacing.md, display: 'flex', gap: spacing[3] }}>
              <Input.Search
                placeholder="搜索应用、版本..."
                onSearch={setSearchQuery}
                style={{ width: 300 }}
                allowClear
              />
              <Select
                placeholder="环境"
                style={{ width: 120 }}
                allowClear
                onChange={(v) => setFilters((prev) => ({ ...prev, environment: v || 'all' }))}
                options={[
                  { label: '全部', value: 'all' },
                  { label: '开发', value: 'dev' },
                  { label: '预发', value: 'staging' },
                  { label: '生产', value: 'prod' },
                ]}
              />
              <Select
                placeholder="状态"
                style={{ width: 120 }}
                allowClear
                onChange={(v) => setFilters((prev) => ({ ...prev, status: v || 'all' }))}
                options={[
                  { label: '全部', value: 'all' },
                  { label: '等待中', value: 'pending' },
                  { label: '部署中', value: 'deploying' },
                  { label: '成功', value: 'success' },
                  { label: '失败', value: 'failed' },
                  { label: '已回滚', value: 'rolled_back' },
                ]}
              />
              <Select
                placeholder="策略"
                style={{ width: 140 }}
                allowClear
                onChange={(v) => setFilters((prev) => ({ ...prev, strategy: v || 'all' }))}
                options={[
                  { label: '全部', value: 'all' },
                  { label: '蓝绿部署', value: 'blue-green' },
                  { label: '金丝雀', value: 'canary' },
                  { label: '滚动部署', value: 'rolling' },
                  { label: '重建部署', value: 'recreate' },
                ]}
              />
            </div>
            <AntTable<Deployment>
              columns={columns}
              dataSource={filteredData}
              loading={loading}
              rowKey="id"
              size="middle"
              pagination={{ pageSize: 20, showSizeChanger: true, showQuickJumper: true }}
            />
          </Card>
        </TabPane>

        {/* Tab 2: Deploy Windows */}
        <TabPane
          tab={<><ClockCircleOutlined style={{ marginRight: 6 }} />部署窗口</>}
          key="windows"
        >
          <Card
            extra={
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  deployWindowForm.resetFields();
                  setDeployWindowModalVisible(true);
                }}
              >
                创建窗口
              </Button>
            }
          >
            <Alert
              message="部署窗口配置"
              description="生产环境仅允许在部署窗口内执行部署（工作日 10:00-16:00）。紧急部署可绕过窗口限制，但需要审批。"
              type="info"
              showIcon
              style={{ marginBottom: spacing.md }}
            />
            <AntTable<DeployWindow>
              columns={[
                {
                  title: '名称',
                  dataIndex: 'name',
                  key: 'name',
                  width: 160,
                  render: (v: string) => <Text strong>{v}</Text>,
                },
                {
                  title: '环境',
                  dataIndex: 'environment',
                  key: 'environment',
                  width: 100,
                  render: (v: string) => (
                    <Tag color={envColorMap[v] || 'default'}>{envLabelMap[v] || v}</Tag>
                  ),
                },
                {
                  title: '开始时间',
                  dataIndex: 'startTime',
                  key: 'startTime',
                  width: 160,
                  render: (v: string) => <Text style={{ fontSize: 12 }}>{v}</Text>,
                },
                {
                  title: '结束时间',
                  dataIndex: 'endTime',
                  key: 'endTime',
                  width: 160,
                  render: (v: string) => <Text style={{ fontSize: 12 }}>{v}</Text>,
                },
                {
                  title: '循环',
                  dataIndex: 'recurring',
                  key: 'recurring',
                  width: 100,
                  render: (v: boolean, record) =>
                    v ? (
                      <Tag color="green">{record.recurringPattern === 'daily' ? '每日' : record.recurringPattern === 'weekly' ? '每周' : '每月'}</Tag>
                    ) : (
                      <Tag>单次</Tag>
                    ),
                },
                {
                  title: '状态',
                  dataIndex: 'status',
                  key: 'status',
                  width: 80,
                  render: (v: string) => {
                    const sMap: Record<string, { color: string; label: string }> = {
                      active: { color: 'green', label: '生效中' },
                      expired: { color: 'default', label: '已过期' },
                      upcoming: { color: 'blue', label: '即将开始' },
                    };
                    const cfg = sMap[v] || { color: 'default', label: v };
                    return <Tag color={cfg.color}>{cfg.label}</Tag>;
                  },
                },
                {
                  title: '描述',
                  dataIndex: 'description',
                  key: 'description',
                  width: 200,
                  render: (v: string) => <Text type="secondary" style={{ fontSize: 12 }}>{v || '-'}</Text>,
                },
                {
                  title: '操作',
                  key: 'actions',
                  width: 80,
                  render: (_, record) => (
                    <Button
                      type="link"
                      size="small"
                      danger
                      onClick={() => handleDeleteDeployWindow(record.id)}
                    >
                      删除
                    </Button>
                  ),
                },
              ]}
              dataSource={deployWindows}
              rowKey="id"
              size="middle"
              pagination={false}
            />
          </Card>
        </TabPane>

        {/* Tab 3: Progressive Deploy */}
        <TabPane
          tab={<><RiseOutlined style={{ marginRight: 6 }} />渐进式部署</>}
          key="progressive"
        >
          <Card
            extra={
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  progressiveDeployForm.resetFields();
                  setProgressiveDeployModalVisible(true);
                }}
              >
                创建渐进式部署
              </Button>
            }
          >
            <AntTable<ProgressiveDeployment>
              columns={progressiveColumns}
              dataSource={progressiveDeploys}
              rowKey="id"
              size="middle"
              pagination={{ pageSize: 10, showSizeChanger: true }}
            />
          </Card>
        </TabPane>
      </Tabs>

      {/* Create Deployment Modal */}
      <Modal
        title="创建部署任务"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        onOk={handleCreate}
        confirmLoading={submitting}
        width={600}
        destroyOnClose
      >
        <Form form={createForm} layout="vertical">
          <Form.Item name="appName" label="应用名称" rules={[{ required: true, message: '请输入应用名称' }]}>
            <Input placeholder="如: orion-platform" />
          </Form.Item>
          <Form.Item name="version" label="版本" rules={[{ required: true, message: '请输入版本号' }]}>
            <Input placeholder="如: 1.2.3" />
          </Form.Item>
          <Form.Item name="environment" label="目标环境" rules={[{ required: true, message: '请选择环境' }]}>
            <Select options={[
              { label: '开发', value: 'dev' },
              { label: '预发', value: 'staging' },
              { label: '生产', value: 'prod' },
            ]} />
          </Form.Item>
          <Form.Item name="strategy" label="部署策略" rules={[{ required: true, message: '请选择策略' }]}>
            <Select options={[
              { label: '蓝绿部署', value: 'blue-green' },
              { label: '金丝雀', value: 'canary' },
              { label: '滚动部署', value: 'rolling' },
              { label: '重建部署', value: 'recreate' },
            ]} />
          </Form.Item>
          <Form.Item name="pipelineRunId" label="Pipeline Run ID">
            <Input placeholder="可选，关联的流水线运行 ID" />
          </Form.Item>
          <Form.Item name="commit" label="Commit SHA">
            <Input placeholder="可选，Git commit hash" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Emergency Deploy Modal */}
      <Modal
        title={<><ThunderboltOutlined style={{ marginRight: spacing.sm, color: colors.error[400] }} />紧急部署</>}
        open={emergencyModalVisible}
        onCancel={() => setEmergencyModalVisible(false)}
        footer={null}
        width={600}
        destroyOnClose
      >
        <Alert
          message="紧急部署将绕过部署窗口限制"
          description="此操作需要审批并记录审计日志，请确认紧急部署的必要性"
          type="warning"
          showIcon
          style={{ marginBottom: spacing.md }}
        />
        <Form form={emergencyForm} layout="vertical">
          <Form.Item name="appName" label="应用名称" rules={[{ required: true, message: '请输入应用名称' }]}>
            <Input placeholder="如: orion-platform" />
          </Form.Item>
          <Form.Item name="version" label="版本" rules={[{ required: true, message: '请输入版本号' }]}>
            <Input placeholder="如: 1.2.4-hotfix" />
          </Form.Item>
          <Form.Item name="pipelineRunId" label="Pipeline Run ID" rules={[{ required: true, message: '请输入 Pipeline Run ID' }]}>
            <Input placeholder="关联的流水线运行 ID" />
          </Form.Item>
          <Form.Item name="commit" label="Commit SHA">
            <Input placeholder="Git commit hash" />
          </Form.Item>
          <Form.Item
            name="reason"
            label="紧急原因"
            rules={[{ required: true, message: '请说明紧急部署原因' }]}
          >
            <Input.TextArea rows={4} placeholder="请详细说明紧急部署原因..." />
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              danger
              block
              onClick={handleEmergencyDeploy}
              loading={emergencyLoading}
            >
              确认提交紧急部署
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* Deploy Window Create Modal */}
      <Modal
        title={<><ClockCircleOutlined style={{ marginRight: spacing.sm, color: colors.primary[500] }} />创建部署窗口</>}
        open={deployWindowModalVisible}
        onCancel={() => setDeployWindowModalVisible(false)}
        onOk={() => deployWindowForm.submit()}
        confirmLoading={deployWindowSubmitting}
        width={600}
        destroyOnClose
      >
        <Form form={deployWindowForm} layout="vertical" onFinish={handleCreateDeployWindow}>
          <Form.Item name="name" label="窗口名称" rules={[{ required: true, message: '请输入窗口名称' }]}>
            <Input placeholder="如: 生产窗口-工作日" />
          </Form.Item>
          <Form.Item name="environment" label="目标环境" rules={[{ required: true, message: '请选择环境' }]}>
            <Select options={[
              { label: '开发', value: 'dev' },
              { label: '预发', value: 'staging' },
              { label: '生产', value: 'prod' },
            ]} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="startTime" label="开始时间" rules={[{ required: true, message: '请选择开始时间' }]}>
                <DatePicker showTime style={{ width: '100%' }} format="YYYY-MM-DD HH:mm" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="endTime" label="结束时间" rules={[{ required: true, message: '请选择结束时间' }]}>
                <DatePicker showTime style={{ width: '100%' }} format="YYYY-MM-DD HH:mm" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="recurring" label="循环执行" valuePropName="checked" initialValue={false}>
            <Switch />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, curr) => prev.recurring !== curr.recurring}>
            {({ getFieldValue }) =>
              getFieldValue('recurring') ? (
                <Form.Item name="recurringPattern" label="循环模式" rules={[{ required: true, message: '请选择循环模式' }]}>
                  <Select options={[
                    { label: '每日', value: 'daily' },
                    { label: '每周', value: 'weekly' },
                    { label: '每月', value: 'monthly' },
                  ]} />
                </Form.Item>
              ) : null
            }
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} placeholder="描述此部署窗口的用途..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Progressive Deploy Create Modal */}
      <Modal
        title={<><RiseOutlined style={{ marginRight: spacing.sm, color: colors.success[500] }} />创建渐进式部署</>}
        open={progressiveDeployModalVisible}
        onCancel={() => setProgressiveDeployModalVisible(false)}
        onOk={() => progressiveDeployForm.submit()}
        confirmLoading={progressiveDeploySubmitting}
        width={600}
        destroyOnClose
      >
        <Alert
          message="渐进式部署将分阶段逐步增加流量"
          description="流量将按 Canary (5%) → 25% → 50% → 75% → 100% 逐步推进，每个阶段需要确认后推进到下一阶段"
          type="info"
          showIcon
          style={{ marginBottom: spacing.md }}
        />
        <Form form={progressiveDeployForm} layout="vertical" onFinish={handleCreateProgressiveDeploy}>
          <Form.Item name="appName" label="应用名称" rules={[{ required: true, message: '请输入应用名称' }]}>
            <Input placeholder="如: orion-platform" />
          </Form.Item>
          <Form.Item name="version" label="版本" rules={[{ required: true, message: '请输入版本号' }]}>
            <Input placeholder="如: 2.1.0" />
          </Form.Item>
          <Form.Item name="environment" label="目标环境" rules={[{ required: true, message: '请选择环境' }]}>
            <Select options={[
              { label: '开发', value: 'dev' },
              { label: '预发', value: 'staging' },
              { label: '生产', value: 'prod' },
            ]} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Progressive Deploy Detail Drawer */}
      <Drawer
        title={selectedProgressiveDeploy ? `${selectedProgressiveDeploy.appName} v${selectedProgressiveDeploy.version} - 渐进式部署` : '渐进式部署详情'}
        open={progressiveDetailVisible}
        onClose={() => setProgressiveDetailVisible(false)}
        width={800}
        destroyOnClose
      >
        {selectedProgressiveDeploy && (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="应用">{selectedProgressiveDeploy.appName}</Descriptions.Item>
              <Descriptions.Item label="版本">v{selectedProgressiveDeploy.version}</Descriptions.Item>
              <Descriptions.Item label="环境">
                <Tag color={envColorMap[selectedProgressiveDeploy.environment]}>
                  {envLabelMap[selectedProgressiveDeploy.environment] || selectedProgressiveDeploy.environment}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                {(() => {
                  const sMap: Record<string, { color: string; label: string }> = {
                    pending: { color: 'default', label: '等待中' },
                    running: { color: 'blue', label: '进行中' },
                    completed: { color: 'green', label: '已完成' },
                    rolled_back: { color: 'gold', label: '已回滚' },
                    failed: { color: 'red', label: '失败' },
                  };
                  const cfg = sMap[selectedProgressiveDeploy.status] || { color: 'default', label: selectedProgressiveDeploy.status };
                  return <Tag color={cfg.color}>{cfg.label}</Tag>;
                })()}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">{selectedProgressiveDeploy.createdAt}</Descriptions.Item>
            </Descriptions>

            {/* Stage Progress */}
            <Card size="small" title="部署阶段">
              <Steps
                direction="vertical"
                current={selectedProgressiveDeploy.currentStage}
                items={selectedProgressiveDeploy.stages.map((stage) => ({
                  title: stage.name,
                  description: (
                    <div>
                      <Tag color={
                        stage.status === 'completed' ? 'green' :
                        stage.status === 'running' ? 'blue' :
                        stage.status === 'failed' ? 'red' : 'default'
                      }>
                        {stage.status === 'completed' ? '已完成' :
                         stage.status === 'running' ? '进行中' :
                         stage.status === 'failed' ? '失败' : '等待中'}
                      </Tag>
                      <Text type="secondary" style={{ marginLeft: spacing.sm }}>
                        流量 {stage.trafficPercent}%
                      </Text>
                      {stage.startedAt && (
                        <div>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            开始: {stage.startedAt}
                          </Text>
                        </div>
                      )}
                      {stage.completedAt && (
                        <div>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            完成: {stage.completedAt}
                          </Text>
                        </div>
                      )}
                    </div>
                  ),
                  status: stage.status === 'completed' ? 'finish' :
                          stage.status === 'running' ? 'process' :
                          stage.status === 'failed' ? 'error' : 'wait',
                }))}
              />
            </Card>

            {/* Overall Progress */}
            <Card size="small" title="总体进度">
              {(() => {
                const completed = selectedProgressiveDeploy.stages.filter((s) => s.status === 'completed').length;
                const percent = Math.round((completed / selectedProgressiveDeploy.stages.length) * 100);
                return (
                  <Progress
                    percent={percent}
                    status={selectedProgressiveDeploy.status === 'rolled_back' ? 'exception' : selectedProgressiveDeploy.status === 'completed' ? 'success' : 'active'}
                    strokeWidth={12}
                  />
                );
              })()}
            </Card>

            {/* Actions */}
            {selectedProgressiveDeploy.status === 'running' && (
              <Space>
                <Button
                  type="primary"
                  icon={<RiseOutlined />}
                  onClick={() => handleAdvanceStage(selectedProgressiveDeploy.id)}
                >
                  推进到下一阶段
                </Button>
                <Button
                  danger
                  icon={<RollbackOutlined />}
                  onClick={() => handleRollbackProgressive(selectedProgressiveDeploy.id)}
                >
                  回滚部署
                </Button>
              </Space>
            )}
          </Space>
        )}
      </Drawer>

      {/* Detail Drawer */}
      <Drawer
        title={selectedDeployment ? `${selectedDeployment.appName} v${selectedDeployment.version}` : '部署详情'}
        open={detailDrawerVisible}
        onClose={() => setDetailDrawerVisible(false)}
        width={800}
        destroyOnClose
      >
        {selectedDeployment && (
          <>
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="应用">{selectedDeployment.appName}</Descriptions.Item>
              <Descriptions.Item label="版本">v{selectedDeployment.version}</Descriptions.Item>
              <Descriptions.Item label="环境">
                <Tag color={envColorMap[selectedDeployment.environment]}>
                  {envLabelMap[selectedDeployment.environment] || selectedDeployment.environment}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="策略">
                <Tag color={strategyColorMap[selectedDeployment.strategy]}>
                  {strategyLabelMap[selectedDeployment.strategy] || selectedDeployment.strategy}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={statusColorMap[selectedDeployment.status]} icon={statusIconMap[selectedDeployment.status]}>
                  {statusLabelMap[selectedDeployment.status] || selectedDeployment.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="触发人">{selectedDeployment.triggeredBy || '-'}</Descriptions.Item>
              <Descriptions.Item label="Commit">
                {selectedDeployment.commit ? (
                  <Text copyable style={{ fontFamily: 'monospace' }}>
                    {selectedDeployment.commit}
                  </Text>
                ) : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Pipeline Run">
                {selectedDeployment.pipelineRunId || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="开始时间">
                {selectedDeployment.startTime ? dayjs(selectedDeployment.startTime).format('YYYY-MM-DD HH:mm:ss') : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="结束时间">
                {selectedDeployment.endTime ? dayjs(selectedDeployment.endTime).format('YYYY-MM-DD HH:mm:ss') : '-'}
              </Descriptions.Item>
            </Descriptions>

            {/* Deployment Stages */}
            {selectedDeployment.stages && selectedDeployment.stages.length > 0 && (
              <div style={{ marginTop: spacing.lg }}>
                <Title level={5}>部署阶段</Title>
                <Steps
                  direction="vertical"
                  current={
                    selectedDeployment.status === 'success'
                      ? selectedDeployment.stages.length
                      : selectedDeployment.stages.findIndex((s) => s.status === 'failed') >= 0
                        ? selectedDeployment.stages.findIndex((s) => s.status === 'failed')
                        : selectedDeployment.stages.findIndex((s) => s.status === 'running')
                  }
                  items={selectedDeployment.stages.map((stage) => ({
                    title: stage.name,
                    description: (
                      <div>
                        <Tag color={statusColorMap[stage.status] || 'default'}>
                          {statusLabelMap[stage.status] || stage.status}
                        </Tag>
                        {stage.duration && (
                          <Text type="secondary" style={{ marginLeft: spacing.sm }}>
                            {stage.duration}s
                          </Text>
                        )}
                        {stage.details && (
                          <div style={{ marginTop: 4 }}>
                            <Text type="secondary" style={{ fontSize: 12 }}>{stage.details}</Text>
                          </div>
                        )}
                      </div>
                    ),
                    status: stage.status === 'success' ? 'finish' : stage.status === 'failed' ? 'error' : 'process',
                  }))}
                />
              </div>
            )}

            {/* Health Checks */}
            {selectedDeployment.healthChecks && selectedDeployment.healthChecks.length > 0 && (
              <div style={{ marginTop: spacing.lg }}>
                <Title level={5}>健康检查</Title>
                <Timeline>
                  {selectedDeployment.healthChecks.map((check: HealthCheckResult, idx: number) => (
                    <Timeline.Item
                      key={idx}
                      color={check.status === 'healthy' ? 'green' : check.status === 'unhealthy' ? 'red' : 'orange'}
                    >
                      <Text strong>{check.name}</Text>
                      <Tag color={check.status === 'healthy' ? 'green' : 'orange'} style={{ marginLeft: spacing.sm }}>
                        {check.status}
                      </Tag>
                      {check.message && (
                        <div>
                          <Text type="secondary">{check.message}</Text>
                        </div>
                      )}
                    </Timeline.Item>
                  ))}
                </Timeline>
              </div>
            )}

            {/* Release Notes */}
            <div style={{ marginTop: spacing.lg }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
                <Title level={5} style={{ margin: 0 }}>版本说明</Title>
                {!releaseNotes && (
                  <Button
                    type="primary"
                    size="small"
                    icon={<CloudUploadOutlined />}
                    onClick={handleGenerateReleaseNotes}
                    loading={generatingNotes}
                  >
                    生成版本说明
                  </Button>
                )}
              </div>

              {releaseNotesLoading && <Card size="small"><Text type="secondary">加载中...</Text></Card>}

              {!releaseNotesLoading && releaseNotes && (
                <Card size="small">
                  <Space direction="vertical" style={{ width: '100%' }} size="middle">
                    {/* Summary */}
                    <Alert
                      message={releaseNotes.summary}
                      type="info"
                      showIcon
                    />

                    {/* Metrics */}
                    <Row gutter={16}>
                      <Col span={6}>
                        <Statistic
                          title={<Text type="secondary">总 Commits</Text>}
                          value={releaseNotes.metrics.totalCommits}
                        />
                      </Col>
                      <Col span={6}>
                        <Statistic
                          title={<Text type="secondary">变更数</Text>}
                          value={releaseNotes.metrics.totalChanges}
                        />
                      </Col>
                      <Col span={6}>
                        <Statistic
                          title={<Text type="secondary">新功能</Text>}
                          value={releaseNotes.metrics.features}
                          valueStyle={{ color: colors.success[500] }}
                        />
                      </Col>
                      <Col span={6}>
                        <Statistic
                          title={<Text type="secondary">Bug 修复</Text>}
                          value={releaseNotes.metrics.fixes}
                          valueStyle={{ color: colors.primary[500] }}
                        />
                      </Col>
                    </Row>

                    {releaseNotes.metrics.breakingChanges > 0 && (
                      <Alert
                        message={`包含 ${releaseNotes.metrics.breakingChanges} 个 Breaking Changes`}
                        type="warning"
                        showIcon
                      />
                    )}

                    {/* Changes List */}
                    {releaseNotes.changes.length > 0 && (
                      <div>
                        <Text strong>变更详情</Text>
                        <div style={{ marginTop: spacing.sm }}>
                          {releaseNotes.changes.map((change: ReleaseNotesChange, idx: number) => (
                            <Card
                              key={idx}
                              size="small"
                              style={{ marginBottom: spacing.sm }}
                              type={change.type === 'breaking' ? 'inner' : undefined}
                            >
                              <Space direction="vertical" style={{ width: '100%' }} size={0}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                                  <Tag
                                    color={
                                      change.type === 'feature' ? 'green' :
                                      change.type === 'fix' ? 'blue' :
                                      change.type === 'breaking' ? 'red' :
                                      change.type === 'improvement' ? 'cyan' :
                                      'default'
                                    }
                                  >
                                    {change.type}
                                  </Tag>
                                  <Text>{change.description}</Text>
                                </div>
                                <Space size="small">
                                  <Text type="secondary" style={{ fontSize: 12 }}>
                                    {change.commit.slice(0, 7)}
                                  </Text>
                                  <Text type="secondary" style={{ fontSize: 12 }}>
                                    by {change.author}
                                  </Text>
                                  {change.prNumber && (
                                    <Text type="secondary" style={{ fontSize: 12 }}>
                                      #{change.prNumber}
                                    </Text>
                                  )}
                                </Space>
                              </Space>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Manual Notes */}
                    {releaseNotes.notes && (
                      <div>
                        <Text strong>补充说明</Text>
                        <div style={{ marginTop: spacing.xs }}>
                          <Text type="secondary">{releaseNotes.notes}</Text>
                        </div>
                      </div>
                    )}

                    {/* Timestamps */}
                    <div>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        生成时间: {dayjs(releaseNotes.generatedAt).format('YYYY-MM-DD HH:mm:ss')}
                      </Text>
                    </div>
                  </Space>
                </Card>
              )}

              {!releaseNotesLoading && !releaseNotes && (
                <Alert
                  message="暂无版本说明"
                  description="点击上方按钮从 Git 提交历史自动生成版本说明"
                  type="info"
                  showIcon
                />
              )}
            </div>
          </>
        )}
      </Drawer>
    </div>
  );
};

export default DeployPage;
