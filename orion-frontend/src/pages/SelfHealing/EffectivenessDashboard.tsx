/**
 * Self-Healing - Effectiveness Dashboard
 * Metrics and analytics for self-healing effectiveness
 */
import React, { useState, useEffect } from 'react';
import { Typography, Card, Row, Col, Statistic, Table, Tag, Button, message } from 'antd';
import {
  ReloadOutlined,
  ThunderboltOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  LineChartOutlined,
} from '@ant-design/icons';
import { getEffectiveness, getHealingHistory } from '@/api/self-healing';
import type { SelfHealingEffectiveness, SelfHealingIncident } from '@/api/self-healing';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const EffectivenessDashboard: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [effectiveness, setEffectiveness] = useState<SelfHealingEffectiveness | null>(null);
  const [recentHistory, setRecentHistory] = useState<SelfHealingIncident[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [effRes, histRes] = await Promise.all([
        getEffectiveness(),
        getHealingHistory({ pageSize: 10 }),
      ]);
      setEffectiveness(effRes.data.data || null);
      setRecentHistory(histRes.data.data?.items || []);
    } catch (error) {
      console.error('Failed to load effectiveness data:', error);
      message.error('加载效能数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const statusColor = (status: string) => {
    switch (status) {
      case 'resolved': return 'green';
      case 'healing': return 'blue';
      case 'pending': return 'orange';
      case 'failed': return 'red';
      default: return 'default';
    }
  };

  const historyColumns = [
    { title: '事件 ID', dataIndex: 'id', key: 'id', width: 140, ellipsis: true },
    { title: '类型', dataIndex: 'type', key: 'type' },
    { title: '应用', dataIndex: 'appName', key: 'appName', width: 150 },
    { title: '策略', dataIndex: 'strategy', key: 'strategy', width: 120, render: (text?: string) => text || '-' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => <Tag color={statusColor(status)}>{status}</Tag>,
    },
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (ts: string) => dayjs(ts).format('YYYY-MM-DD HH:mm'),
    },
  ] as any[];

  const historyData = recentHistory.map((r) => ({ ...r, key: r.id }));

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>效能仪表盘</Title>
          <Text type="secondary">自愈合系统效能分析与趋势</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>刷新</Button>
      </div>

      {/* Summary Cards */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="自愈合率"
              value={effectiveness?.healingRate ? Math.round(effectiveness.healingRate * 100) : 0}
              suffix="%"
              valueStyle={{ color: '#52c41a' }}
              prefix={<ThunderboltOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="平均 MTTR"
              value={effectiveness?.avgMttr ? Math.round(effectiveness.avgMttr) : 0}
              suffix="min"
              valueStyle={{ color: '#1890ff' }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="总事件数"
              value={effectiveness?.totalIncidents || 0}
              valueStyle={{ color: '#722ed1' }}
              prefix={<LineChartOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="成功率"
              value={effectiveness?.successRate ? Math.round(effectiveness.successRate * 100) : 0}
              suffix="%"
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Detailed Metrics */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={12}>
          <Card title="效能指标">
            {effectiveness ? (
              <Table
                size="small"
                pagination={false}
                showHeader={false}
                columns={[
                  { title: '指标', dataIndex: 'metric', key: 'metric' },
                  { title: '值', dataIndex: 'value', key: 'value' },
                ]}
                dataSource={[
                  { key: '1', metric: '自愈合率', value: `${(effectiveness.healingRate * 100).toFixed(1)}%` },
                  { key: '2', metric: '平均修复时间 (MTTR)', value: `${effectiveness.avgMttr.toFixed(1)} 分钟` },
                  { key: '3', metric: '总事件数', value: effectiveness.totalIncidents },
                  { key: '4', metric: '成功率', value: `${(effectiveness.successRate * 100).toFixed(1)}%` },
                  { key: '5', metric: '自动处理事件', value: Math.round(effectiveness.totalIncidents * effectiveness.healingRate) },
                  { key: '6', metric: '需要人工干预', value: Math.round(effectiveness.totalIncidents * (1 - effectiveness.healingRate)) },
                ]}
              />
            ) : (
              <Text type="secondary">暂无数据</Text>
            )}
          </Card>
        </Col>
        <Col span={12}>
          <Card title="趋势分析">
            <Text type="secondary">
              自愈合系统持续运行中。当前自动处理率为 {effectiveness ? `${(effectiveness.healingRate * 100).toFixed(1)}%` : '0%'}，
              平均修复时间为 {effectiveness ? `${effectiveness.avgMttr.toFixed(1)}` : '0'} 分钟。
            </Text>
            <div style={{ marginTop: 16 }}>
              <Text strong>优化建议：</Text>
              <ul style={{ paddingLeft: 20, margin: '8px 0 0' }}>
                <li>增加更多自动化策略以提高自愈率</li>
                <li>优化策略置信度阈值以减少误判</li>
                <li>定期审查失败事件以改进策略</li>
              </ul>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Recent Activity */}
      <Card title="最近活动">
        <Table
          columns={historyColumns}
          dataSource={historyData}
          loading={loading}
          pagination={{ pageSize: 5 }}
          size="small"
        />
      </Card>
    </div>
  );
};

export default EffectivenessDashboard;
