/**
 * EfficiencyDashboard Page (TASK-402)
 * 效能看板 - DORA 指标可视化
 *
 * Features:
 * - DORA 指标展示（发布频率、变更前置时间、服务恢复时间、变更失败率）
 * - 趋势图表
 * - 团队对比
 * - 改进建议
 */
import React, { useState, useEffect } from 'react';
import { Typography, Card, Row, Col, Table, Tag, Progress, Space, Statistic, Tabs, Button } from 'antd';
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ThunderboltOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import DashboardLayout from '@/components/DashboardLayout';
import MetricCard from '@/components/MetricCard';
import StatusBadge from '@/components/StatusBadge';
import { mockEfficiencyData } from '@/pages/__mocks__/mockEfficiencyData';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

const EfficiencyDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    // 模拟数据加载
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  // DORA 指标列定义
  const metricColumns = [
    {
      title: '指标',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: any) => (
        <Space>
          {record.icon}
          <Text strong>{text}</Text>
        </Space>
      ),
    },
    {
      title: '当前值',
      dataIndex: 'currentValue',
      key: 'currentValue',
      render: (value: any, record: any) => (
        <Text strong style={{ color: record.trend === 'up' ? '#52c41a' : '#faad14' }}>
          {value}
        </Text>
      ),
    },
    {
      title: '目标值',
      dataIndex: 'targetValue',
      key: 'targetValue',
    },
    {
      title: '趋势',
      dataIndex: 'trend',
      key: 'trend',
      render: (trend: 'up' | 'down' | 'stable') => {
        const config = {
          up: { icon: <ArrowUpOutlined />, color: '#52c41a' },
          down: { icon: <ArrowDownOutlined />, color: '#ff4d4f' },
          stable: { icon: <ClockCircleOutlined />, color: '#999' },
        };
        return <span style={{ color: config[trend].color }}>{config[trend].icon}</span>;
      },
    },
    {
      title: '等级',
      dataIndex: 'level',
      key: 'level',
      render: (level: string) => {
        const colorMap: Record<string, string> = {
          Elite: '#52c41a',
          High: '#1890ff',
          Medium: '#faad14',
          Low: '#ff4d4f',
        };
        return <Tag color={colorMap[level]}>{level}</Tag>;
      },
    },
  ];

  // 团队对比列定义
  const teamColumns = [
    {
      title: '团队',
      dataIndex: 'team',
      key: 'team',
    },
    {
      title: '发布频率',
      dataIndex: 'deploymentFrequency',
      key: 'deploymentFrequency',
      sorter: (a: any, b: any) => a.deploymentFrequency - b.deploymentFrequency,
    },
    {
      title: '变更前置时间',
      dataIndex: 'leadTime',
      key: 'leadTime',
      render: (hours: number) => `${hours}h`,
    },
    {
      title: '恢复时间',
      dataIndex: 'mttr',
      key: 'mttr',
      render: (minutes: number) => `${minutes}m`,
    },
    {
      title: '失败率',
      dataIndex: 'failureRate',
      key: 'failureRate',
      render: (rate: number) => (
        <Progress
          percent={rate}
          strokeColor={rate < 5 ? '#52c41a' : rate < 15 ? '#faad14' : '#ff4d4f'}
          format={() => `${rate}%`}
          size="small"
        />
      ),
    },
    {
      title: '综合评分',
      dataIndex: 'score',
      key: 'score',
      sorter: (a: any, b: any) => a.score - b.score,
      render: (score: number) => (
        <Tag color={score >= 80 ? '#52c41a' : score >= 60 ? '#1890ff' : '#faad14'}>
          {score} 分
        </Tag>
      ),
    },
  ];

  return (
    <div>
      {/* 页面标题 */}
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>
          <ThunderboltOutlined style={{ marginRight: 8 }} />
          效能看板
        </Title>
        <Text type="secondary">DORA 指标追踪与团队效能分析</Text>
      </div>

      {/* DORA 指标卡片 */}
      <div style={{ marginBottom: 24 }}>
        <Title level={5}>核心指标</Title>
        <DashboardLayout columns={4} gap={16}>
          <MetricCard
            title="发布频率"
            value={mockEfficiencyData.metrics.deploymentFrequency.value}
            unit="次/周"
            trend={mockEfficiencyData.metrics.deploymentFrequency.trend as any}
            trendPercent={12.5}
            previousValue={156}
            loading={loading}
          />
          <MetricCard
            title="变更前置时间"
            value={mockEfficiencyData.metrics.leadTime.value}
            unit="小时"
            trend="down"
            trendPercent={18.2}
            previousValue={28}
            loading={loading}
          />
          <MetricCard
            title="服务恢复时间"
            value={mockEfficiencyData.metrics.mttr.value}
            unit="分钟"
            trend="down"
            trendPercent={25.0}
            previousValue={60}
            loading={loading}
          />
          <MetricCard
            title="变更失败率"
            value={mockEfficiencyData.metrics.failureRate.value}
            unit="%"
            trend="down"
            trendPercent={2.1}
            previousValue={8.5}
            loading={loading}
          />
        </DashboardLayout>
      </div>

      {/* Tab 切换 */}
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane tab="总览" key="overview">
          {/* DORA 指标明细表 */}
          <Card title="DORA 指标详情" style={{ marginBottom: 16 }}>
            <Table
              columns={metricColumns}
              dataSource={mockEfficiencyData.doraMetrics}
              rowKey="key"
              pagination={false}
              size="small"
            />
          </Card>

          {/* 改进建议 */}
          <Card title="改进建议">
            {mockEfficiencyData.suggestions.map((suggestion, index) => (
              <div
                key={index}
                style={{
                  padding: '12px 16px',
                  marginBottom: index < mockEfficiencyData.suggestions.length - 1 ? 8 : 0,
                  background: index === 0 ? 'rgba(24, 144, 255, 0.04)' : 'transparent',
                  borderRadius: 8,
                  borderLeft: index === 0 ? '3px solid #1890ff' : '3px solid #d9d9d9',
                }}
              >
                <Space>
                  <TrophyOutlined style={{ color: index === 0 ? '#1890ff' : '#999' }} />
                  <Text>{suggestion}</Text>
                </Space>
              </div>
            ))}
          </Card>
        </TabPane>

        <TabPane tab="团队对比" key="teams">
          <Card title="团队效能对比">
            <Table
              columns={teamColumns}
              dataSource={mockEfficiencyData.teamComparison}
              rowKey="team"
              pagination={false}
              size="small"
              scroll={{ x: 800 }}
            />
          </Card>
        </TabPane>

        <TabPane tab="趋势分析" key="trend">
          <Card title="近 12 周趋势">
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Text type="secondary">图表加载中...（集成 ECharts）</Text>
            </div>
          </Card>
        </TabPane>
      </Tabs>
    </div>
  );
};

export default EfficiencyDashboard;
