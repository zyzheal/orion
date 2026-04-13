/**
 * Deployment Detail Page (TASK-905)
 * Deployment detail with info, stage progress, health checks, and rollback.
 *
 * Features:
 * - Deployment info
 * - Stage progress
 * - Health check status
 * - Rollback button
 */
import React, { useState } from 'react';
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
} from 'antd';
import {
  ArrowLeftOutlined,
  RollbackOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined,
  SyncOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';
import StatusBadge from '@/components/StatusBadge';
import CardPanel from '@/components/CardPanel';
import { mockDeployments } from '@/pages/__mocks__/mockData';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

// Environment display config
const envConfig: Record<string, { color: string; label: string }> = {
  production: { color: 'red', label: '生产环境' },
  staging: { color: 'orange', label: '预发环境' },
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
  healthy: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
  unhealthy: <CloseCircleOutlined style={{ color: '#f5222d' }} />,
  degraded: <QuestionCircleOutlined style={{ color: '#faad14' }} />,
  unknown: <InfoCircleOutlined style={{ color: '#8c8c8c' }} />,
};

const DeploymentDetail: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [rollbackModalVisible, setRollbackModalVisible] = useState(false);

  // Find the deployment from mock data
  const deployment = mockDeployments.find((d) => d.id === id) || mockDeployments[0];

  const env = envConfig[deployment.environment] || { color: 'default', label: deployment.environment };

  // Format duration
  const formatDuration = (seconds?: number) => {
    if (!seconds) return '-';
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return minutes > 0 ? `${minutes}m ${secs}s` : `${secs}s`;
  };

  // Stage status color
  const stageStatusColor: Record<string, string> = {
    success: '#52c41a',
    running: '#1890ff',
    failed: '#f5222d',
    pending: '#d9d9d9',
  };

  // Handle rollback
  const handleRollback = () => {
    setIsRollingBack(true);
    setRollbackModalVisible(false);
    // Simulate rollback
    setTimeout(() => {
      setIsRollingBack(false);
      message.success('回滚操作已触发，正在执行中...');
    }, 2000);
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
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/deployments')}
        >
          返回列表
        </Button>
        <div style={{ flex: 1 }}>
          <Title level={3} style={{ margin: 0 }}>
            部署详情: {deployment.appName}
          </Title>
          <Text type="secondary">
            版本 {deployment.version} · 部署于 {env.label}
          </Text>
        </div>
        <Space>
          <StatusBadge status={deployment.status} size="medium" />
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
        <Descriptions
          column={4}
          size="small"
          bordered
          labelStyle={{ width: 120 }}
        >
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
            {dayjs(deployment.startTime).format('YYYY-MM-DD HH:mm:ss')}
          </Descriptions.Item>
          <Descriptions.Item label="结束时间">
            {deployment.endTime
              ? dayjs(deployment.endTime).format('YYYY-MM-DD HH:mm:ss')
              : '进行中...'}
          </Descriptions.Item>
          <Descriptions.Item label="耗时">
            {formatDuration(deployment.duration)}
          </Descriptions.Item>
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
            <Space direction="vertical" style={{ width: '100%' }} size={12}>
              {deployment.stages?.map((stage, index) => (
                <Card
                  key={stage.name}
                  size="small"
                  style={{
                    borderLeft: `4px solid ${stageStatusColor[stage.status] || '#d9d9d9'}`,
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
                      <Text strong style={{ fontSize: 14 }}>
                        {index + 1}. {stage.name}
                      </Text>
                      {stage.status === 'running' && (
                        <SyncOutlined spin style={{ color: '#1890ff' }} />
                      )}
                    </Space>
                    <Space>
                      {stage.details && (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {stage.details}
                        </Text>
                      )}
                      <StatusBadge status={stage.status as any} size="small" />
                    </Space>
                  </div>
                </Card>
              ))}
            </Space>
          </CardPanel>
        </Col>

        {/* Health check status */}
        <Col xs={24} xl={10}>
          <CardPanel title="健康检查">
            <Space direction="vertical" style={{ width: '100%' }} size={12}>
              {deployment.healthChecks && deployment.healthChecks.length > 0 ? (
                deployment.healthChecks.map((check) => (
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
                    <span style={{ fontSize: 20 }}>
                      {healthCheckIcon[check.status]}
                    </span>
                    <div style={{ flex: 1 }}>
                      <Text strong style={{ fontSize: 14 }}>
                        {check.name}
                      </Text>
                      {check.message && (
                        <div>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {check.message}
                          </Text>
                        </div>
                      )}
                    </div>
                    {check.latency !== undefined && (
                      <Tag
                        color={check.latency < 50 ? 'green' : check.latency < 200 ? 'orange' : 'red'}
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
