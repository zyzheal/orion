/**
 * Monitoring Dashboard
 * Overview of monitoring health, alerts summary, metrics count, and anomaly detection
 */
import React, { useState, useEffect } from 'react';
import { Typography, Card, Space, Tag, Spin, Button, message, Row, Col, Statistic } from 'antd';
import {
  DashboardOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  ReloadOutlined,
  AlertOutlined,
  CheckCircleOutlined,
  LineChartOutlined,
} from '@ant-design/icons';
import { getDashboardData, getMonitoringHealth, startMonitoring, stopMonitoring, getAnomalySummary } from '@/api/monitoring';
import { colors, spacing } from '@/tokens';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const MonitoringDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [health, setHealth] = useState<any>(null);
  const [anomalies, setAnomalies] = useState<any>(null);
  const [monitoring, setMonitoring] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [dashRes, healthRes, anomalyRes] = await Promise.all([
        getDashboardData(),
        getMonitoringHealth(),
        getAnomalySummary(),
      ]);
      setDashboardData(dashRes.data.data);
      setHealth(healthRes.data.data);
      setAnomalies(anomalyRes.data.data);
      setMonitoring(healthRes.data.data?.status === 'running');
    } catch (error) {
      console.error('Failed to load monitoring dashboard data:', error);
      message.error('加载监控数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleStart = async () => {
    setActionLoading(true);
    try {
      await startMonitoring();
      message.success('监控已启动');
      setMonitoring(true);
    } catch (error) {
      message.error('启动监控失败');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStop = async () => {
    setActionLoading(true);
    try {
      await stopMonitoring();
      message.success('监控已停止');
      setMonitoring(false);
    } catch (error) {
      message.error('停止监控失败');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <DashboardOutlined style={{ marginRight: 8 }} />
            监控总览
          </Title>
          <Text type="secondary">监控中心运行状态与关键指标</Text>
        </div>
        <Space>
          <Tag color={monitoring ? 'green' : 'red'}>
            {monitoring ? '运行中' : '已停止'}
          </Tag>
          {monitoring ? (
            <Button danger icon={<PauseCircleOutlined />} onClick={handleStop} loading={actionLoading}>
              停止监控
            </Button>
          ) : (
            <Button type="primary" icon={<PlayCircleOutlined />} onClick={handleStart} loading={actionLoading}>
              启动监控
            </Button>
          )}
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
        </Space>
      </div>

      {/* Stats Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="告警总数"
              value={dashboardData?.alerts?.total || 0}
              prefix={<AlertOutlined />}
            />
            <Text type="secondary" style={{ fontSize: spacing[3] }}>
              活跃 {dashboardData?.alerts?.active || 0} / 已解决 {dashboardData?.alerts?.resolved || 0}
            </Text>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="规则数"
              value={dashboardData?.rules?.total || 0}
              prefix={<AlertOutlined />}
            />
            <Text type="secondary" style={{ fontSize: spacing[3] }}>
              已启用 {dashboardData?.rules?.enabled || 0}
            </Text>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="指标数"
              value={dashboardData?.metrics?.total || 0}
              prefix={<LineChartOutlined />}
            />
            <Text type="secondary" style={{ fontSize: spacing[3] }}>
              速率 {dashboardData?.metrics?.rate || 0}/s
            </Text>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="通知渠道"
              value={dashboardData?.channels?.total || 0}
              prefix={<CheckCircleOutlined />}
            />
            <Text type="secondary" style={{ fontSize: spacing[3] }}>
              活跃 {dashboardData?.channels?.active || 0}
            </Text>
          </Card>
        </Col>
      </Row>

      {/* Health Status */}
      <Card title="系统健康状态" style={{ marginBottom: 16 }}>
        <Space size="large">
          <div>
            <Text type="secondary">状态:</Text>{' '}
            <Tag color={health?.status === 'ok' ? 'green' : 'orange'}>{health?.status || 'unknown'}</Tag>
          </div>
          <div>
            <Text type="secondary">运行时间:</Text>{' '}
            <Text strong>{health?.uptime ? `${Math.floor(health.uptime / 3600)}h ${Math.floor((health.uptime % 3600) / 60)}m` : '-'}</Text>
          </div>
          <div>
            <Text type="secondary">指标计数:</Text>{' '}
            <Text strong>{health?.metricsCount || 0}</Text>
          </div>
        </Space>
      </Card>

      {/* Anomaly Summary */}
      <Card title="异常检测摘要">
        {anomalies?.anomalies && anomalies.anomalies.length > 0 ? (
          <Space direction="vertical" style={{ width: '100%' }}>
            {anomalies.anomalies.slice(0, 10).map((a: any, idx: number) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${colors.light.border.light}` }}>
                <Space>
                  <Tag color={a.severity === 'high' ? 'red' : a.severity === 'medium' ? 'orange' : 'blue'}>
                    {a.severity}
                  </Tag>
                  <Text>{a.metric}</Text>
                </Space>
                <Text type="secondary">{dayjs(a.time).format('YYYY-MM-DD HH:mm:ss')}</Text>
              </div>
            ))}
          </Space>
        ) : (
          <Text type="secondary">未发现异常</Text>
        )}
        {anomalies?.totalCount && anomalies.totalCount > 10 && (
          <div style={{ marginTop: 8, textAlign: 'right' }}>
            <Text type="secondary">共 {anomalies.totalCount} 条异常记录</Text>
          </div>
        )}
      </Card>
    </div>
  );
};

export default MonitoringDashboard;
