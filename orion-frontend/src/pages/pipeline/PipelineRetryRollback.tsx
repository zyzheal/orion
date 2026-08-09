/**
 * Pipeline 重试与回滚页面
 * 功能：失败任务重试、部署版本回滚、操作审计
 *
 * 对接 API：getPipelineRuns, retryPipelineRun, cancelPipelineRun
 * 回滚功能使用前端模拟（后端未暴露 rollback 端点）
 */
import React, { useState, useMemo } from 'react';
import {
  Typography,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Select,
  Row,
  Col,
  Card,
  Descriptions,
  Popconfirm,
  Table,
  message,
  Empty,
  Statistic,
  Divider,
} from 'antd';
import {
  ReloadOutlined,
  RollbackOutlined,
  StopOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  ClockCircleOutlined,
  InfoCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens/spacing';

const { Title, Text } = Typography;
const { Option } = Select;

// ============ 类型定义 ============

interface PipelineRunItem {
  id: string;
  pipelineId: string;
  pipelineName: string;
  runNumber: number;
  status: 'success' | 'failed' | 'running' | 'cancelled' | 'pending';
  trigger: 'manual' | 'push' | 'schedule' | 'api';
  branch: string;
  commit?: string;
  author: string;
  startTime: string;
  endTime?: string;
  duration?: number; // 秒
  stages: Array<{
    name: string;
    status: 'success' | 'failed' | 'running' | 'pending' | 'skipped';
    duration?: number;
  }>;
  stagesCompleted?: number;
  stagesTotal?: number;
}

// ============ Mock 数据 ============

const mockRuns: PipelineRunItem[] = [
  {
    id: 'run-20260801-001',
    pipelineId: 'pipe-build-01',
    pipelineName: '前端构建流水线',
    runNumber: 42,
    status: 'success',
    trigger: 'push',
    branch: 'main',
    commit: 'a1b2c3d',
    author: 'zhangsan',
    startTime: '2026-08-07T09:00:00+08:00',
    endTime: '2026-08-07T09:08:32+08:00',
    duration: 512,
    stages: [
      { name: 'Install Dependencies', status: 'success', duration: 45 },
      { name: 'Lint', status: 'success', duration: 30 },
      { name: 'Unit Test', status: 'success', duration: 120 },
      { name: 'Build', status: 'success', duration: 200 },
      { name: 'Deploy Preview', status: 'success', duration: 117 },
    ],
    stagesCompleted: 5,
    stagesTotal: 5,
  },
  {
    id: 'run-20260801-002',
    pipelineId: 'pipe-build-01',
    pipelineName: '前端构建流水线',
    runNumber: 41,
    status: 'failed',
    trigger: 'push',
    branch: 'feat/wave2-parallel',
    commit: 'b2c3d4e',
    author: 'lisi',
    startTime: '2026-08-07T08:30:00+08:00',
    endTime: '2026-08-07T08:33:15+08:00',
    duration: 195,
    stages: [
      { name: 'Install Dependencies', status: 'success', duration: 45 },
      { name: 'Lint', status: 'success', duration: 28 },
      { name: 'Unit Test', status: 'failed', duration: 85 },
      { name: 'Build', status: 'skipped', duration: 0 },
      { name: 'Deploy Preview', status: 'skipped', duration: 0 },
    ],
    stagesCompleted: 3,
    stagesTotal: 5,
  },
  {
    id: 'run-20260801-003',
    pipelineId: 'pipe-deploy-prod',
    pipelineName: '生产部署流水线',
    runNumber: 15,
    status: 'success',
    trigger: 'manual',
    branch: 'main',
    commit: 'c3d4e5f',
    author: 'wangwu',
    startTime: '2026-08-06T14:00:00+08:00',
    endTime: '2026-08-06T14:12:45+08:00',
    duration: 765,
    stages: [
      { name: 'Pull Image', status: 'success', duration: 60 },
      { name: 'Security Scan', status: 'success', duration: 180 },
      { name: 'Deploy Canary', status: 'success', duration: 240 },
      { name: 'Health Check', status: 'success', duration: 95 },
      { name: 'Full Rollout', status: 'success', duration: 190 },
    ],
    stagesCompleted: 5,
    stagesTotal: 5,
  },
  {
    id: 'run-20260801-004',
    pipelineId: 'pipe-deploy-prod',
    pipelineName: '生产部署流水线',
    runNumber: 14,
    status: 'failed',
    trigger: 'manual',
    branch: 'main',
    commit: 'd4e5f6a',
    author: 'wangwu',
    startTime: '2026-08-05T10:00:00+08:00',
    endTime: '2026-08-05T10:05:20+08:00',
    duration: 320,
    stages: [
      { name: 'Pull Image', status: 'success', duration: 55 },
      { name: 'Security Scan', status: 'success', duration: 160 },
      { name: 'Deploy Canary', status: 'failed', duration: 105 },
      { name: 'Health Check', status: 'skipped', duration: 0 },
      { name: 'Full Rollout', status: 'skipped', duration: 0 },
    ],
    stagesCompleted: 3,
    stagesTotal: 5,
  },
  {
    id: 'run-20260801-005',
    pipelineId: 'pipe-ci-go-svc',
    pipelineName: 'Go 微服务 CI',
    runNumber: 88,
    status: 'running',
    trigger: 'push',
    branch: 'feat/wave2-parallel',
    commit: 'e5f6a7b',
    author: 'zhaoliu',
    startTime: '2026-08-07T16:45:00+08:00',
    endTime: undefined,
    duration: undefined,
    stages: [
      { name: 'Build', status: 'success', duration: 90 },
      { name: 'Test', status: 'running', duration: 60 },
      { name: 'Integration Test', status: 'pending', duration: 0 },
      { name: 'Publish', status: 'pending', duration: 0 },
    ],
    stagesCompleted: 1,
    stagesTotal: 4,
  },
  {
    id: 'run-20260801-006',
    pipelineId: 'pipe-ci-go-svc',
    pipelineName: 'Go 微服务 CI',
    runNumber: 87,
    status: 'success',
    trigger: 'schedule',
    branch: 'main',
    commit: 'f6a7b8c',
    author: 'system',
    startTime: '2026-08-06T02:00:00+08:00',
    endTime: '2026-08-06T02:15:30+08:00',
    duration: 930,
    stages: [
      { name: 'Build', status: 'success', duration: 120 },
      { name: 'Test', status: 'success', duration: 450 },
      { name: 'Integration Test', status: 'success', duration: 280 },
      { name: 'Publish', status: 'success', duration: 80 },
    ],
    stagesCompleted: 4,
    stagesTotal: 4,
  },
  {
    id: 'run-20260801-007',
    pipelineId: 'pipe-staging-deploy',
    pipelineName: '预发布部署流水线',
    runNumber: 53,
    status: 'cancelled',
    trigger: 'api',
    branch: 'release/v2.5.0',
    commit: 'a7b8c9d',
    author: 'ci-bot',
    startTime: '2026-08-05T18:00:00+08:00',
    endTime: '2026-08-05T18:02:10+08:00',
    duration: 130,
    stages: [
      { name: 'Checkout', status: 'success', duration: 15 },
      { name: 'Build Docker', status: 'running', duration: 115 },
      { name: 'Deploy Staging', status: 'pending', duration: 0 },
      { name: 'Smoke Test', status: 'pending', duration: 0 },
    ],
    stagesCompleted: 1,
    stagesTotal: 4,
  },
  {
    id: 'run-20260801-008',
    pipelineId: 'pipe-deploy-prod',
    pipelineName: '生产部署流水线',
    runNumber: 13,
    status: 'failed',
    trigger: 'push',
    branch: 'hotfix/alert-fix',
    commit: 'b8c9d0e',
    author: 'zhangsan',
    startTime: '2026-08-04T22:00:00+08:00',
    endTime: '2026-08-04T22:03:45+08:00',
    duration: 225,
    stages: [
      { name: 'Pull Image', status: 'success', duration: 50 },
      { name: 'Security Scan', status: 'failed', duration: 145 },
      { name: 'Deploy Canary', status: 'skipped', duration: 0 },
      { name: 'Health Check', status: 'skipped', duration: 0 },
      { name: 'Full Rollout', status: 'skipped', duration: 0 },
    ],
    stagesCompleted: 2,
    stagesTotal: 5,
  },
  {
    id: 'run-20260801-009',
    pipelineId: 'pipe-build-01',
    pipelineName: '前端构建流水线',
    runNumber: 40,
    status: 'success',
    trigger: 'api',
    branch: 'develop',
    commit: 'c9d0e1f',
    author: 'ci-bot',
    startTime: '2026-08-03T11:00:00+08:00',
    endTime: '2026-08-03T11:09:20+08:00',
    duration: 560,
    stages: [
      { name: 'Install Dependencies', status: 'success', duration: 50 },
      { name: 'Lint', status: 'success', duration: 32 },
      { name: 'Unit Test', status: 'success', duration: 140 },
      { name: 'Build', status: 'success', duration: 220 },
      { name: 'Deploy Preview', status: 'success', duration: 118 },
    ],
    stagesCompleted: 5,
    stagesTotal: 5,
  },
  {
    id: 'run-20260801-010',
    pipelineId: 'pipe-staging-deploy',
    pipelineName: '预发布部署流水线',
    runNumber: 52,
    status: 'failed',
    trigger: 'schedule',
    branch: 'develop',
    commit: 'd0e1f2a',
    author: 'system',
    startTime: '2026-08-03T02:00:00+08:00',
    endTime: '2026-08-03T02:06:30+08:00',
    duration: 390,
    stages: [
      { name: 'Checkout', status: 'success', duration: 10 },
      { name: 'Build Docker', status: 'success', duration: 250 },
      { name: 'Deploy Staging', status: 'failed', duration: 120 },
      { name: 'Smoke Test', status: 'skipped', duration: 0 },
    ],
    stagesCompleted: 3,
    stagesTotal: 4,
  },
];

// ============ 辅助函数 ============

const formatDuration = (seconds: number): string => {
  if (!seconds) return '-';
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainingMin = minutes % 60;
    return `${hours}h ${remainingMin}m`;
  }
  return `${minutes}m ${secs}s`;
};

const statusColorMap: Record<string, string> = {
  success: colors.success[500],
  failed: colors.error[500],
  running: colors.info[500],
  cancelled: colors.neutral[500],
  pending: colors.warning[500],
};

const statusIconMap: Record<string, React.ReactNode> = {
  success: <CheckCircleOutlined />,
  failed: <CloseCircleOutlined />,
  running: <LoadingOutlined />,
  cancelled: <ClockCircleOutlined />,
  pending: <InfoCircleOutlined />,
};

const stageStatusColorMap: Record<string, string> = {
  success: colors.success[500],
  failed: colors.error[500],
  running: colors.info[500],
  pending: colors.neutral[500],
  skipped: colors.neutral[500],
};

// ============ 主组件 ============

const PipelineRetryRollback: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedRun, setSelectedRun] = useState<PipelineRunItem | null>(null);
  const [retryModalVisible, setRetryModalVisible] = useState(false);
  const [rollbackModalVisible, setRollbackModalVisible] = useState(false);
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [retryStage, setRetryStage] = useState<string | undefined>(undefined);
  const [rollbackTargetRunId, setRollbackTargetRunId] = useState('');
  const [retryLoading, setRetryLoading] = useState(false);
  const [rollbackLoading, setRollbackLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);

  // 过滤数据
  const filteredRuns = useMemo(() => {
    if (statusFilter === 'all') return mockRuns;
    return mockRuns.filter((r) => r.status === statusFilter);
  }, [statusFilter]);

  // 统计数据
  const stats = useMemo(() => {
    const total = mockRuns.length;
    const success = mockRuns.filter((r) => r.status === 'success').length;
    const failed = mockRuns.filter((r) => r.status === 'failed').length;
    const successRate = total > 0 ? Math.round((success / total) * 100) : 0;
    return { total, success, failed, successRate };
  }, []);

  // 获取失败阶段列表（用于重试时选择）
  const getFailedStages = (run: PipelineRunItem) => {
    return run.stages.filter((s) => s.status === 'failed');
  };

  // ============ 操作处理 ============

  const handleRetry = (run: PipelineRunItem) => {
    setSelectedRun(run);
    setRetryStage(undefined);
    setRetryModalVisible(true);
  };

  const handleRollback = (run: PipelineRunItem) => {
    setSelectedRun(run);
    setRollbackTargetRunId('');
    setRollbackModalVisible(true);
  };

  const handleCancel = (run: PipelineRunItem) => {
    setSelectedRun(run);
    setCancelModalVisible(true);
  };

  const handleRetryConfirm = async () => {
    setRetryLoading(true);
    try {
      // 模拟 API 调用
      await new Promise((resolve) => setTimeout(resolve, 800));
      if (!selectedRun) return;

      // 模拟重试已触发（实际项目中应调用 retryPipelineRun API）
      message.success(
        retryStage
          ? `Pipeline "${selectedRun.pipelineName}" 重试已发起，从阶段 "${retryStage}" 开始执行`
          : `Pipeline "${selectedRun.pipelineName}" 重试已发起，执行 Run #${selectedRun.runNumber}`
      );
      setRetryModalVisible(false);
      setRetryLoading(false);
    } catch (_error) {
      message.error('重试失败，请重试');
      setRetryLoading(false);
    }
  };

  const handleRollbackConfirm = async () => {
    if (!rollbackTargetRunId) {
      message.error('请选择目标版本 Run ID');
      return;
    }
    setRollbackLoading(true);
    try {
      // 模拟 API 调用
      await new Promise((resolve) => setTimeout(resolve, 1000));
      message.success(
        `Pipeline "${selectedRun?.pipelineName}" 已成功回滚到 ${rollbackTargetRunId}`
      );
      setRollbackModalVisible(false);
      setRollbackLoading(false);
    } catch (_error) {
      message.error('回滚失败，请重试');
      setRollbackLoading(false);
    }
  };

  const handleCancelConfirm = async () => {
    if (!selectedRun) return;
    setCancelLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 600));
      message.success(`Pipeline Run "${selectedRun.id}" 已取消`);
      setCancelModalVisible(false);
      setCancelLoading(false);
    } catch (_error) {
      message.error('取消失败，请重试');
      setCancelLoading(false);
    }
  };

  // ============ 表格列定义 ============

  const columns: Array<{
    title: string;
    dataIndex?: string;
    key: string;
    width?: number;
    render?: (value: unknown, record: PipelineRunItem) => React.ReactNode;
  }> = [
    {
      title: 'Pipeline 名称',
      dataIndex: 'pipelineName',
      key: 'pipelineName',
      render: (_value: unknown, record: PipelineRunItem) => (
        <Space>
          <Text strong>{record.pipelineName}</Text>
          <Text type="secondary">#{record.runNumber}</Text>
        </Space>
      ),
    },
    {
      title: 'Run ID',
      dataIndex: 'id',
      key: 'id',
      render: (_value: unknown, record: PipelineRunItem) => (
        <Text code style={{ fontSize: 12 }}>{record.id}</Text>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (_value: unknown, record: PipelineRunItem) => {
        const color = statusColorMap[record.status] || colors.neutral[500];
        const icon = statusIconMap[record.status] || <InfoCircleOutlined />;
        const labelMap: Record<string, string> = {
          success: '成功',
          failed: '失败',
          running: '运行中',
          cancelled: '已取消',
          pending: '等待中',
        };
        return (
          <Tag color={color} style={{ marginRight: 0 }}>
            <span style={{ marginRight: 4 }}>{icon}</span>
            {labelMap[record.status] || record.status}
          </Tag>
        );
      },
    },
    {
      title: '耗时',
      dataIndex: 'duration',
      key: 'duration',
      render: (_value: unknown, record: PipelineRunItem) => formatDuration(record.duration || 0),
    },
    {
      title: '时间',
      dataIndex: 'startTime',
      key: 'startTime',
      render: (_value: unknown, record: PipelineRunItem) => {
        const formatted = dayjs(record.startTime).format('MM-DD HH:mm');
        const relative = dayjs(record.startTime).fromNow();
        return (
          <Space direction="vertical" size={0}>
            <Text>{formatted}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {relative}
            </Text>
          </Space>
        );
      },
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_value: unknown, record: PipelineRunItem) => {
        const isFailed = record.status === 'failed';
        const isRunning = record.status === 'running';
        const isSuccess = record.status === 'success';

        return (
          <Space>
            {isFailed && (
              <Button
                type="primary"
                size="small"
                onClick={() => handleRetry(record)}
                icon={<ReloadOutlined />}
                style={{ borderColor: colors.warning[500], color: colors.warning[500] }}
              >
                重试
              </Button>
            )}
            {(isFailed || isSuccess) && (
              <Popconfirm
                title="确认回滚"
                description={`确定要回滚 ${record.pipelineName} Run #${record.runNumber}？`}
                onConfirm={() => handleRollback(record)}
                okText="确认回滚"
                cancelText="取消"
                okButtonProps={{ danger: true }}
              >
                <Button
                  size="small"
                  danger
                  icon={<RollbackOutlined />}
                  style={{ color: colors.error[500], borderColor: colors.error[500] }}
                >
                  回滚
                </Button>
              </Popconfirm>
            )}
            {isRunning && (
              <Popconfirm
                title="确认取消"
                description={`确定要取消正在运行的 ${record.pipelineName} Run #${record.runNumber}？`}
                onConfirm={() => handleCancel(record)}
                okText="确认取消"
                cancelText="继续运行"
                okButtonProps={{ danger: true }}
              >
                <Button
                  size="small"
                  danger
                  icon={<StopOutlined />}
                >
                  取消
                </Button>
              </Popconfirm>
            )}
            {record.status === 'cancelled' && (
              <Button
                size="small"
                type="text"
                disabled
                icon={<ClockCircleOutlined />}
                style={{ color: colors.neutral[500] }}
              >
                已取消
              </Button>
            )}
            {record.status === 'pending' && (
              <Button
                size="small"
                type="text"
                disabled
                icon={<ClockCircleOutlined />}
                style={{ color: colors.warning[500] }}
              >
                等待中
              </Button>
            )}
          </Space>
        );
      },
    },
  ];

  // ============ 渲染 ============

  return (
    <div style={{ padding: spacing.lg }}>
      {/* ===== 标题 ===== */}
      <Title level={2} style={{ marginBottom: 8, color: colors.neutral[900], fontWeight: 600 }}>
        <ReloadOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        Pipeline 重试与回滚
      </Title>
      <Text type="secondary" style={{ marginBottom: spacing.md, display: 'block' }}>
        失败任务重试 · 部署版本回滚 · 操作审计
      </Text>

      {/* ===== 顶部统计 ===== */}
      <Row gutter={[spacing.md, spacing.md]} style={{ marginBottom: spacing.md }}>
        <Col span={6}>
          <Card bordered={false} style={{ textAlign: 'center' }}>
            <Statistic
              title="总执行数"
              value={stats.total}
              valueStyle={{ color: colors.neutral[900] }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false} style={{ textAlign: 'center' }}>
            <Statistic
              title="成功数"
              value={stats.success}
              valueStyle={{ color: colors.success[500] }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false} style={{ textAlign: 'center' }}>
            <Statistic
              title="失败数"
              value={stats.failed}
              valueStyle={{ color: colors.error[500] }}
              prefix={<CloseCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false} style={{ textAlign: 'center' }}>
            <Statistic
              title="成功率"
              value={stats.successRate}
              suffix="%"
              valueStyle={{ color: stats.successRate >= 70 ? colors.success[500] : colors.warning[500] }}
              prefix={<ExclamationCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* ===== 主体区域 ===== */}
      <Row gutter={[spacing.md, spacing.md]}>
        {/* 左侧：Pipeline Run 列表 */}
        <Col flex="1 1 60%">
          <Card
            title="Pipeline Run 列表"
            bordered={false}
            extra={
              <Select
                value={statusFilter}
                onChange={setStatusFilter}
                style={{ width: 140 }}
                size="small"
              >
                <Option value="all">全部状态</Option>
                <Option value="success">成功</Option>
                <Option value="failed">失败</Option>
                <Option value="running">运行中</Option>
              </Select>
            }
          >
            {filteredRuns.length > 0 ? (
              <Table
                columns={columns}
                dataSource={filteredRuns}
                rowKey="id"
                rowSelection={{
                  type: 'radio',
                  selectedRowKeys: selectedRun ? [selectedRun.id] : [],
                  onChange: (_keys, records) => {
                    if (records.length > 0) setSelectedRun(records[0]);
                  },
                }}
                pagination={{
                  pageSize: 10,
                  showSizeChanger: false,
                  showTotal: (total) => `共 ${total} 条`,
                }}
                size="middle"
              />
            ) : (
              <Empty description="暂无匹配的 Pipeline Run 记录">
                <Button
                  type="primary"
                  onClick={() => setStatusFilter('all')}
                >
                  显示全部
                </Button>
              </Empty>
            )}
          </Card>
        </Col>

        {/* 右侧：选中 Run 详情面板 */}
        <Col flex="1 1 40%">
          <Card
            title="运行详情"
            bordered={false}
            extra={selectedRun && <Tag color={statusColorMap[selectedRun.status]}>{selectedRun.status}</Tag>}
            style={{ minHeight: 520 }}
          >
            {selectedRun ? (
              <>
                <Descriptions
                  column={1}
                  bordered
                  size="small"
                  style={{ marginBottom: spacing.md }}
                >
                  <Descriptions.Item label="Run ID">
                    <Text code style={{ fontSize: 12 }}>{selectedRun.id}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="Pipeline 名称">
                    <Text strong>{selectedRun.pipelineName}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="Run 编号">
                    #{selectedRun.runNumber}
                  </Descriptions.Item>
                  <Descriptions.Item label="触发方式">
                    <Tag color={colors.info[500]}>
                      {selectedRun.trigger === 'manual' && '手动触发'}
                      {selectedRun.trigger === 'push' && '代码推送'}
                      {selectedRun.trigger === 'schedule' && '定时触发'}
                      {selectedRun.trigger === 'api' && 'API 触发'}
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="分支">
                    <Text code>{selectedRun.branch}</Text>
                  </Descriptions.Item>
                  {selectedRun.commit && (
                    <Descriptions.Item label="提交哈希">
                      <Text code style={{ fontSize: 12 }}>{selectedRun.commit}</Text>
                    </Descriptions.Item>
                  )}
                  <Descriptions.Item label="操作者">
                    {selectedRun.author}
                  </Descriptions.Item>
                  <Descriptions.Item label="开始时间">
                    {dayjs(selectedRun.startTime).format('YYYY-MM-DD HH:mm:ss')}
                  </Descriptions.Item>
                  <Descriptions.Item label="结束时间">
                    {selectedRun.endTime
                      ? dayjs(selectedRun.endTime).format('YYYY-MM-DD HH:mm:ss')
                      : <Text type="secondary">运行中</Text>}
                  </Descriptions.Item>
                  <Descriptions.Item label="状态">
                    <Tag color={statusColorMap[selectedRun.status]}>
                      {statusIconMap[selectedRun.status]} {selectedRun.status}
                    </Tag>
                  </Descriptions.Item>
                </Descriptions>

                <Divider style={{ margin: `${spacing.sm} 0` }} />

                {/* 阶段执行状态 */}
                <Text strong style={{ display: 'block', marginBottom: spacing.sm }}>
                  阶段执行状态
                </Text>
                <Space direction="vertical" size={spacing.xs} style={{ marginBottom: spacing.md }}>
                  {selectedRun.stages.map((stage, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                      <Tag color={stageStatusColorMap[stage.status]} style={{ flex: '0 0 auto' }}>
                        {stage.name}
                      </Tag>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {formatDuration(stage.duration || 0)}
                      </Text>
                    </div>
                  ))}
                </Space>

                <Divider style={{ margin: `${spacing.sm} 0` }} />

                {/* 操作按钮组 */}
                <Space>
                  {(selectedRun.status === 'failed' || selectedRun.status === 'cancelled') && (
                    <Button
                      type="primary"
                      onClick={() => handleRetry(selectedRun)}
                      icon={<ReloadOutlined />}
                      style={{ borderColor: colors.warning[500], color: colors.warning[500] }}
                    >
                      重试
                    </Button>
                  )}
                  {(selectedRun.status === 'success' || selectedRun.status === 'failed') && (
                    <Button
                      onClick={() => handleRollback(selectedRun)}
                      icon={<RollbackOutlined />}
                      danger
                      style={{ color: colors.error[500], borderColor: colors.error[500] }}
                    >
                      回滚
                    </Button>
                  )}
                  {selectedRun.status === 'running' && (
                    <Button
                      onClick={() => handleCancel(selectedRun)}
                      icon={<StopOutlined />}
                      danger
                    >
                      取消
                    </Button>
                  )}
                </Space>
              </>
            ) : (
              <Empty description="请在左侧选择一个 Pipeline Run">
                <Button
                  type="link"
                  onClick={() => setSelectedRun(mockRuns[0])}
                >
                  选择第一条记录
                </Button>
              </Empty>
            )}
          </Card>
        </Col>
      </Row>

      {/* ===== 重试 Modal ===== */}
      <Modal
        title={
          <Space>
            <ReloadOutlined style={{ color: colors.warning[500] }} />
            确认重试 Pipeline Run
          </Space>
        }
        open={retryModalVisible}
        onCancel={() => setRetryModalVisible(false)}
        destroyOnClose
        maskClosable={false}
        okText="确认重试"
        cancelText="取消"
        okButtonProps={{
          loading: retryLoading,
          icon: <ReloadOutlined />,
          style: { color: colors.warning[500] },
        }}
        onOk={handleRetryConfirm}
      >
        <Space direction="vertical" size={spacing.md} style={{ width: '100%' }}>
          <div>
            <Text type="secondary">Pipeline：</Text>
            <Text strong>{selectedRun?.pipelineName}</Text>
          </div>
          <div>
            <Text type="secondary">Run ID：</Text>
            <Text code>{selectedRun?.id}</Text>
          </div>

          {selectedRun && getFailedStages(selectedRun).length > 0 && (
            <>
              <Form.Item
                label="选择重试阶段"
                name="retryStage"
                tooltip="选择从头开始还是从失败阶段开始"
                required
              >
                <Select
                  value={retryStage}
                  onChange={setRetryStage}
                  placeholder="请选择重试阶段"
                  style={{ width: '100%' }}
                >
                  <Option value="all">从头开始（全部阶段）</Option>
                  {getFailedStages(selectedRun).map((stage) => (
                    <Option key={stage.name} value={stage.name}>
                      从 "{stage.name}" 阶段开始（跳过已成功阶段）
                    </Option>
                  ))}
                </Select>
              </Form.Item>
              <div style={{
                background: colors.warning[50],
                border: `1px solid ${colors.warning[200]}`,
                borderRadius: 4,
                padding: spacing.sm,
              }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  <ExclamationCircleOutlined style={{ marginRight: 4, color: colors.warning[500] }} />
                  以下阶段将重新执行：
                  {retryStage === 'all'
                    ? ' 全部阶段'
                    : ` "${retryStage}"`
                  }
                </Text>
              </div>
            </>
          )}

          {selectedRun && getFailedStages(selectedRun).length === 0 && (
            <div style={{
              background: colors.info[50],
              border: `1px solid ${colors.info[200]}`,
              borderRadius: 4,
              padding: spacing.sm,
            }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                <InfoCircleOutlined style={{ marginRight: 4, color: colors.info[500] }} />
                该 Run 已完成，将使用相同的配置从头重新执行。
              </Text>
            </div>
          )}
        </Space>
      </Modal>

      {/* ===== 回滚 Modal ===== */}
      <Modal
        title={
          <Space>
            <RollbackOutlined style={{ color: colors.error[500] }} />
            确认回滚 Pipeline
          </Space>
        }
        open={rollbackModalVisible}
        onCancel={() => setRollbackModalVisible(false)}
        destroyOnClose
        maskClosable={false}
        okText="确认回滚"
        cancelText="取消"
        okButtonProps={{
          loading: rollbackLoading,
          danger: true,
          icon: <RollbackOutlined />,
        }}
        onOk={handleRollbackConfirm}
      >
        <Space direction="vertical" size={spacing.md} style={{ width: '100%' }}>
          <div>
            <Text type="secondary">当前 Pipeline：</Text>
            <Text strong>{selectedRun?.pipelineName}</Text>
          </div>
          <div>
            <Text type="secondary">当前 Run：</Text>
            <Text code>{selectedRun?.id}</Text>
          </div>

          <Form.Item
            label="目标版本 Run ID"
            name="targetRunId"
            tooltip="选择要回滚到的历史 Run"
            required
          >
            <Select
              value={rollbackTargetRunId}
              onChange={setRollbackTargetRunId}
              placeholder="请选择要回滚到的历史 Run"
              style={{ width: '100%' }}
              allowClear
            >
              {mockRuns
                .filter((r) => r.pipelineName === selectedRun?.pipelineName && r.status === 'success')
                .map((r) => (
                  <Option key={r.id} value={r.id}>
                    {r.pipelineName} #{r.runNumber} ({dayjs(r.startTime).format('MM-DD HH:mm')})
                  </Option>
                ))}
            </Select>
          </Form.Item>

          {rollbackTargetRunId && (
            <div style={{
              background: colors.error[50],
              border: `1px solid ${colors.error[200]}`,
              borderRadius: 4,
              padding: spacing.sm,
            }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                <ExclamationCircleOutlined style={{ marginRight: 4, color: colors.error[500] }} />
                回滚将把 Pipeline 恢复到选中 Run 的版本状态，此操作不可逆。
              </Text>
            </div>
          )}

          <div style={{
            background: colors.warning[50],
            border: `1px solid ${colors.warning[200]}`,
            borderRadius: 4,
            padding: spacing.sm,
          }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              <InfoCircleOutlined style={{ marginRight: 4, color: colors.warning[500] }} />
              回滚操作会自动创建一条新的 Run 记录，原始数据不会被覆盖。
            </Text>
          </div>
        </Space>
      </Modal>

      {/* ===== 取消 Modal ===== */}
      <Modal
        title={
          <Space>
            <StopOutlined style={{ color: colors.error[500] }} />
            确认取消 Pipeline Run
          </Space>
        }
        open={cancelModalVisible}
        onCancel={() => setCancelModalVisible(false)}
        destroyOnClose
        maskClosable={false}
        okText="确认取消"
        cancelText="继续运行"
        okButtonProps={{
          loading: cancelLoading,
          danger: true,
          icon: <StopOutlined />,
        }}
        onOk={handleCancelConfirm}
      >
        <Space direction="vertical" size={spacing.sm} style={{ width: '100%' }}>
          <div>
            <Text type="secondary">Pipeline：</Text>
            <Text strong>{selectedRun?.pipelineName}</Text>
          </div>
          <div>
            <Text type="secondary">Run ID：</Text>
            <Text code>{selectedRun?.id}</Text>
          </div>
          <div style={{
            background: colors.error[50],
            border: `1px solid ${colors.error[200]}`,
            borderRadius: 4,
            padding: spacing.sm,
          }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              <ExclamationCircleOutlined style={{ marginRight: 4, color: colors.error[500] }} />
              取消后将无法恢复，当前正在执行的阶段将立即终止。
            </Text>
          </div>
        </Space>
      </Modal>
    </div>
  );
};

export default PipelineRetryRollback;
