/**
 * OverviewTab.tsx - 容量概览 Tab
 * 抽取自 CapacityPlanningPage.tsx (P2-9 Phase 92)
 */
import React, { useState, useEffect } from 'react';
import { Table, Button, Tag, Space, Typography, Card, Progress, Popconfirm, message } from 'antd';
import { BarChartOutlined, ReloadOutlined, RiseOutlined } from '@ant-design/icons';
import {
  generateCapacityForecast,
  listCapacityAlerts,
  deleteCapacityAlert,
  analyzeBottlenecks,
  type CapacityAlert,
  type Bottleneck,
} from '@/api/capacity';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';
import { impactColorMap, severityColorMap } from '../constants';

const { Title, Text } = Typography;

export const OverviewTab: React.FC = () => {
  const [bottlenecks, setBottlenecks] = useState<Bottleneck[]>([]);
  const [alerts, setAlerts] = useState<CapacityAlert[]>([]);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [bnRes, alertRes] = await Promise.all([analyzeBottlenecks(), listCapacityAlerts()]);
      setBottlenecks((bnRes.data as { data?: Bottleneck[] })?.data ?? []);
      setAlerts((alertRes.data as { data?: CapacityAlert[] })?.data ?? []);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleForecast = async () => {
    try {
      await generateCapacityForecast();
      message.success('预测生成成功');
      loadData();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '预测失败');
    }
  };

  const handleDeleteAlert = async (id: string) => {
    try {
      await deleteCapacityAlert(id);
      message.success('告警已清除');
      loadData();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '删除失败');
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bottleneckColumns = [
    { title: '资源 ID', dataIndex: 'resourceId', key: 'resourceId' },
    { title: '资源类型', dataIndex: 'resourceType', key: 'resourceType' },
    { title: '指标', dataIndex: 'metricName', key: 'metricName' },
    {
      title: '使用率',
      dataIndex: 'utilization',
      key: 'utilization',
      render: (v: number) => (
        <Progress
          percent={Math.round(v)}
          size="small"
          status={v >= 80 ? 'exception' : v >= 60 ? 'normal' : 'success'}
          style={
            { width: 100 } as React.CSSProperties
          }
        />
      ),
    },
    {
      title: '影响',
      dataIndex: 'impact',
      key: 'impact',
      render: (i: string) => <Tag color={impactColorMap[i]}>{i}</Tag>,
    },
    { title: '建议', dataIndex: 'recommendation', key: 'recommendation', ellipsis: true },
  ];

  const alertColumns = [
    { title: '资源', dataIndex: 'resourceId', key: 'resourceId' },
    { title: '指标', dataIndex: 'metricName', key: 'metricName' },
    {
      title: '使用率',
      dataIndex: 'currentUtilization',
      key: 'currentUtilization',
      render: (v: number) => `${v.toFixed(1)}%`,
    },
    {
      title: '级别',
      dataIndex: 'severity',
      key: 'severity',
      render: (s: string) => <Tag color={severityColorMap[s]}>{s}</Tag>,
    },
    { title: '消息', dataIndex: 'message', key: 'message', ellipsis: true },
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v: string) => new Date(v).toLocaleString(),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, record: CapacityAlert) => (
        <Popconfirm title="确认清除？" onConfirm={() => handleDeleteAlert(record.id)}>
          <Button size="small" type="link" danger>
            清除
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.md }}>
        <div>
          <Title level={3} style={{ marginBottom: spacing.sm }}>
            <BarChartOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            容量概览
          </Title>
          <Text type="secondary">资源使用瓶颈与容量预警</Text>
        </div>
        <Space>
          <Button icon={<RiseOutlined />} onClick={handleForecast}>
            生成预测
          </Button>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
        </Space>
      </div>

      {/* Bottlenecks */}
      <Card title="瓶颈分析" style={{ marginBottom: spacing.md }}>
        <Table
          columns={bottleneckColumns}
          dataSource={bottlenecks}
          rowKey={(r) => `${r.resourceId}-${r.metricName}`}
          pagination={false}
          size="small"
          locale={{ emptyText: bottlenecks.length === 0 ? '暂无瓶颈数据' : undefined }}
        />
      </Card>

      {/* Alerts */}
      <Card title="容量预警">
        <Table
          columns={alertColumns}
          dataSource={alerts}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          size="small"
          locale={{ emptyText: alerts.length === 0 ? '暂无容量预警' : undefined }}
        />
      </Card>
    </div>
  );
};
