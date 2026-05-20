/**
 * Deployment Detail Page (TASK-905) - FIXED P0-2
 * Deployment detail with info, stage progress, health checks, and rollback.
 * Uses real API calls instead of mock data.
 *
 * Features:
 * - Deployment info from API
 * - Stage progress from API
 * - Health check status from API
 * - Real rollback via API
 */
import React, { useState, useEffect } from 'react';
import {
  Typography,
  Button,
  Space,
  Tag,
  Descriptions,
  Card,
  Modal,
  message,
  Result,
  Row,
  Col,
  Spin,
} from 'antd';
import { colors, spacing } from '@/tokens';
import {
  ArrowLeftOutlined,
  RollbackOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined,
  QuestionCircleOutlined,
  RocketOutlined,
} from '@ant-design/icons';
import StatusBadge from '@/components/StatusBadge';
import CardPanel from '@/components/CardPanel';
import {
  getDeployment,
  rollbackDeployment,
  type Deployment,
  type HealthCheckResult,
} from '@/api/deployments';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

// Environment display config
const envConfig: Record<string, { color: string; label: string }> = {
  prod: { color: 'red', label: '生产环境' },
  production: { color: 'red', label: '生产环境' },
  staging: { color: 'orange', label: '预发环境' },
  dev: { color: 'blue', label: '开发环境' },
  development: { color: 'blue', label: '开发环境' },
  test: { color: 'default', label: '测试环境' },
};

// Strategy display labels
const strategyLabels: Record<string, string> = {
  rolling: '滚动更新 (Rolling)',
  'blue-green': '蓝绿部署 (Blue-Green)',
  canary: '金丝雀发布 (Canary)',
  recreate: '重建部署 (Recreate)',
};

// Health check status icon
const healthCheckIcon: Record<string, React.ReactNode> = {
  healthy: <CheckCircleOutlined style={{ color: colors.success[500] }} />,
  unhealthy: <CloseCircleOutlined style={{ color: colors.error[500] }} />,
  degraded: <QuestionCircleOutlined style={{ color: colors.warning[500] }} />,
  unknown: <InfoCircleOutlined style={{ color: colors.neutral[400] }} />,
};

const DeploymentDetail: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [deployment, setDeployment] = useState<Deployment | null>(null);
  const [loading, setLoading] = useState(false);
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [rollbackModalVisible, setRollbackModalVisible] = useState(false);

  // Load deployment from API
  const loadDeployment = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const response = await getDeployment(id);
      const data = response.data.data || response.data;
      setDeployment(data as Deployment);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`加载部署详情失败：${error.message}`);
      } else {
        message.error('加载部署详情失败');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDeployment();
  }, [id]);

  // Handle rollback
  const handleRollback = async () => {
    if (!deployment) return;
    setIsRollingBack(true);
    setRollbackModalVisible(false);
    try {
      await rollbackDeployment(deployment.id);
      message.success('回滚操作已触发，正在执行中...');
      // Reload to get updated status
      await loadDeployment();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`回滚操作失败：${error.message}`);
      } else {
        message.error('回滚操作失败');
      }
    } finally {
      setIsRollingBack(false);
    }
  };

  if (loading && !deployment) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!deployment) {
    return (
      <Result
        status="404"
        title="部署不存在"
        subTitle="未找到该部署记录"
        extra={
          <Button type="primary" onClick={() => navigate('/deployments')}>
            返回列表
          </Button>
        }
      />
    );
  }

  const env = envConfig[deployment.environment] || {
    color: 'default',
    label: deployment.environment,
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '-';
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return minutes > 0 ? `${minutes}m ${secs}s` : `${secs}s`;
  };

  const stageStatusColor: Record<string, string> = {
    success: colors.success[500],
    running: colors.primary[500],
    failed: colors.error[500],
    pending: colors.neutral[300],
  };

  const canRollback = deployment.status === 'success';

  return (
    <div style={{ padding: 0 }}>
      {/* Back button and page title */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/deployments')}>
          返回列表
        </Button>
        <div style={{ flex: 1 }}>
          <Title level={2} style={{ marginBottom: 8 }}>
            <RocketOutlined style={{ marginRight: spacing[2], color: colors.primary[500] }} />
            部署详情: {deployment.appName}
          </Title>
          <Text type="secondary">
            版本 {deployment.version} · 部署于 {env.label}
          </Text>
        </div>
        <Space>
          <StatusBadge status={deployment.status as any} size="medium" />
          {canRollback && (
            <Button
              danger
              icon={<RollbackOutlined />}
              onClick={() => setRollbackModalVisible(true)}
              loading={isRollingBack}
            >
              回滚到此版本
            </Button>
          )}
        </Space>
      </div>

      {/* Rollback confirmation modal */}
      <Modal
        title="确认回滚"
        open={rollbackModalVisible}
        onOk={handleRollback}
        onCancel={() => setRollbackModalVisible(false)}
        okText="确认回滚"
        cancelText="取消"
        okButtonProps={{ danger: true, loading: isRollingBack }}
      >
        <Result
          status="warning"
          title={`确定要回滚 ${deployment.appName} 到 ${deployment.version} 吗？`}
          subTitle="回滚操作将恢复此版本的部署，当前版本将被替换。"
          icon={<QuestionCircleOutlined />}
        />
      </Modal>

      {/* Deployment info card */}
      <CardPanel>
        <Descriptions column={4} size="small" bordered labelStyle={{ width: 120 }}>
          <Descriptions.Item label="应用名称">
            <Text strong>{deployment.appName}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="部署版本">
            <Tag color="purple">{deployment.version}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="目标环境">
            <Tag color={env.color}>{env.label}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="部署策略">
            {strategyLabels[deployment.strategy] || deployment.strategy}
          </Descriptions.Item>
          <Descriptions.Item label="触发人">
            <Text code>{deployment.triggeredBy}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="开始时间">
            {deployment.startTime ? dayjs(deployment.startTime).format('YYYY-MM-DD HH:mm:ss') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="结束时间">
            {deployment.endTime
              ? dayjs(deployment.endTime).format('YYYY-MM-DD HH:mm:ss')
              : '进行中...'}
          </Descriptions.Item>
          <Descriptions.Item label="耗时">{formatDuration(deployment.duration)}</Descriptions.Item>
          {deployment.commit && (
            <Descriptions.Item label="提交 Hash">
              <Tag color="default">{deployment.commit}</Tag>
            </Descriptions.Item>
          )}
          {deployment.pipelineRunId && (
            <Descriptions.Item label="关联 Pipeline">
              <Button
                type="link"
                size="small"
                onClick={() => navigate(`/pipelines/${deployment.pipelineRunId}`)}
              >
                {deployment.pipelineRunId}
              </Button>
            </Descriptions.Item>
          )}
          {deployment.rollbackFrom && (
            <Descriptions.Item label="回滚来源">
              <Button
                type="link"
                size="small"
                onClick={() => navigate(`/deployments/${deployment.rollbackFrom}`)}
              >
                {deployment.rollbackFrom}
              </Button>
            </Descriptions.Item>
          )}
        </Descriptions>
      </CardPanel>

      {/* Stage progress and health checks */}
      <Row gutter={[16, 16]}>
        {/* Stage progress */}
        <Col xs={24} xl={14}>
          <CardPanel title="部署阶段">
            {deployment.stages && deployment.stages.length > 0 ? (
              <Space direction="vertical" style={{ width: '100%' }} size={12}>
                {deployment.stages.map((stage, index) => (
                  <Card
                    key={stage.id || stage.name}
                    size="small"
                    style={{
                      borderLeft: `4px solid ${stageStatusColor[stage.status] || colors.neutral[300]}`,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <Space>
                        <Text strong style={{ fontSize: spacing[4] }}>
                          {index + 1}. {stage.name}
                        </Text>
                      </Space>
                      <Space>
                        {stage.details && (
                          <Text type="secondary" style={{ fontSize: spacing[3] }}>
                            {stage.details}
                          </Text>
                        )}
                        <StatusBadge status={stage.status as any} size="small" />
                      </Space>
                    </div>
                  </Card>
                ))}
              </Space>
            ) : (
              <Text type="secondary">暂无阶段数据</Text>
            )}
          </CardPanel>
        </Col>

        {/* Health check status */}
        <Col xs={24} xl={10}>
          <CardPanel title="健康检查">
            <Space direction="vertical" style={{ width: '100%' }} size={12}>
              {deployment.healthChecks && deployment.healthChecks.length > 0 ? (
                deployment.healthChecks.map((check: HealthCheckResult) => (
                  <div
                    key={check.name}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '12px 16px',
                      background:
                        check.status === 'healthy'
                          ? 'rgba(82, 196, 26, 0.04)'
                          : check.status === 'unhealthy'
                            ? 'rgba(245, 34, 45, 0.04)'
                            : 'rgba(250, 173, 20, 0.04)',
                      borderRadius: 6,
                    }}
                  >
                    <span style={{ fontSize: spacing[5] }}>{healthCheckIcon[check.status]}</span>
                    <div style={{ flex: 1 }}>
                      <Text strong style={{ fontSize: spacing[4] }}>
                        {check.name}
                      </Text>
                      {check.message && (
                        <div>
                          <Text type="secondary" style={{ fontSize: spacing[3] }}>
                            {check.message}
                          </Text>
                        </div>
                      )}
                    </div>
                    {check.latency !== undefined && (
                      <Tag
                        color={
                          check.latency < 50 ? 'green' : check.latency < 200 ? 'orange' : 'red'
                        }
                      >
                        {check.latency}ms
                      </Tag>
                    )}
                  </div>
                ))
              ) : (
                <Text type="secondary">暂无健康检查数据</Text>
              )}
            </Space>
          </CardPanel>
        </Col>
      </Row>
    </div>
  );
};

export default DeploymentDetail;
