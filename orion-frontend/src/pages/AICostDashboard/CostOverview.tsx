/**
 * Cost Overview - Stats cards, 7-day trend, top tenants/users, model distribution
 */
import React, { useState, useEffect } from 'react';
import { Typography, Button, Tag, Card, Row, Col, Statistic, Table as AntTable, message } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { getDashboardData, getModelPricing, type DashboardData, type ModelPricing } from '@/api/ai-cost';
import { colors, spacing } from '@/tokens';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const CostOverview: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [pricing, setPricing] = useState<ModelPricing[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [dashRes, pricingRes] = await Promise.all([
        getDashboardData(),
        getModelPricing(),
      ]);
      setDashboard(dashRes.data.data as DashboardData | null);
      setPricing(Array.isArray(pricingRes.data.data) ? pricingRes.data.data : []);
    } catch (error: unknown) {
      // Set mock data for demo
      setDashboard({
        todayCost: 128.45,
        totalTokens: 4523000,
        totalRequests: 1247,
        budgetUsage: 67.3,
        dailyTrend: Array.from({ length: 7 }, (_, i) => ({
          date: dayjs().subtract(6 - i, 'day').format('MM-DD'),
          cost: Math.random() * 200 + 50,
          tokens: Math.floor(Math.random() * 500000 + 100000),
        })),
        topTenants: [
          { tenantId: 'tenant-alpha', cost: 342.10 },
          { tenantId: 'tenant-beta', cost: 218.55 },
          { tenantId: 'tenant-gamma', cost: 156.80 },
        ],
        topUsers: [
          { userId: 'user-001', cost: 89.20 },
          { userId: 'user-003', cost: 67.40 },
          { userId: 'user-007', cost: 45.10 },
        ],
        modelDistribution: [
          { model: 'gpt-4', cost: 420.00 },
          { model: 'gpt-3.5-turbo', cost: 180.00 },
          { model: 'claude-3', cost: 120.00 },
        ],
      });
      if (error instanceof Error) {
        message.warning(`加载成本数据失败，使用模拟数据：${error.message}`);
      } else {
        message.warning('加载成本数据失败，使用模拟数据');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const tenantColumns: ColumnsType<{ tenantId: string; cost: number }> = [
    { key: 'tenantId', title: '租户', dataIndex: 'tenantId', render: (v: unknown) => <Tag color="blue">{String(v)}</Tag> },
    { key: 'cost', title: '费用', dataIndex: 'cost', render: (v: unknown) => <Text strong>${Number(v).toFixed(2)}</Text> },
  ];

  const userColumns: ColumnsType<{ userId: string; cost: number }> = [
    { key: 'userId', title: '用户', dataIndex: 'userId', render: (v: unknown) => <Text>{String(v)}</Text> },
    { key: 'cost', title: '费用', dataIndex: 'cost', render: (v: unknown) => <Text strong>${Number(v).toFixed(2)}</Text> },
  ];

  const modelColumns: ColumnsType<{ model: string; cost: number }> = [
    { key: 'model', title: '模型', dataIndex: 'model', render: (v: unknown) => <Tag>{String(v)}</Tag> },
    { key: 'cost', title: '费用', dataIndex: 'cost', render: (v: unknown) => <Text strong>${Number(v).toFixed(2)}</Text> },
  ];

  return (
    <div style={{ padding: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing[6] }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>成本总览</Title>
          <Text type="secondary">AI 模型调用成本与资源使用统计</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>刷新</Button>
      </div>

      {/* Stats Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: spacing[6] }}>
        <Col span={6}>
          <Card>
            <Statistic title="今日费用" value={dashboard?.todayCost || 0} precision={2} prefix="$"
              valueStyle={{ color: colors.error[600] }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Token 用量" value={dashboard?.totalTokens || 0} suffix="tokens" />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="请求数" value={dashboard?.totalRequests || 0} suffix="次" />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="预算使用" value={dashboard?.budgetUsage || 0} precision={1} suffix="%"
              valueStyle={{ color: (dashboard?.budgetUsage || 0) > 80 ? colors.error[600] : colors.success[600] }} />
          </Card>
        </Col>
      </Row>

      {/* 7-Day Trend */}
      <Card title="7 日趋势" style={{ marginBottom: 24 }}>
        {dashboard?.dailyTrend && (
          <AntTable
            columns={[
              { key: 'date', title: '日期', dataIndex: 'date' },
              { key: 'cost', title: '费用', dataIndex: 'cost', render: (v: unknown) => <Text strong>${Number(v).toFixed(2)}</Text> },
              { key: 'tokens', title: 'Token', dataIndex: 'tokens', render: (v: unknown) => <Text>{Number(v).toLocaleString()}</Text> },
            ]}
            dataSource={dashboard.dailyTrend}
            rowKey="date"
            size="small"
            pagination={false}
          />
        )}
      </Card>

      <Row gutter={16}>
        <Col span={8}>
          <Card title="Top 租户" size="small">
            <AntTable columns={tenantColumns as ColumnsType<unknown>} dataSource={dashboard?.topTenants || []} rowKey="tenantId" size="small" pagination={false} />
          </Card>
        </Col>
        <Col span={8}>
          <Card title="Top 用户" size="small">
            <AntTable columns={userColumns as ColumnsType<unknown>} dataSource={dashboard?.topUsers || []} rowKey="userId" size="small" pagination={false} />
          </Card>
        </Col>
        <Col span={8}>
          <Card title="模型分布" size="small">
            <AntTable columns={modelColumns as ColumnsType<unknown>} dataSource={dashboard?.modelDistribution || []} rowKey="model" size="small" pagination={false} />
          </Card>
        </Col>
      </Row>

      {/* Model Pricing */}
      {pricing.length > 0 && (
        <Card title="模型定价" style={{ marginTop: 16 }}>
          <AntTable
            columns={[
              { key: 'model', title: '模型', dataIndex: 'model', render: (v: unknown) => <Tag>{String(v)}</Tag> },
              { key: 'provider', title: '供应商', dataIndex: 'provider', render: (v: unknown) => <Text>{String(v)}</Text> },
              { key: 'inputPrice', title: '输入价格 (每1K tokens)', dataIndex: 'inputPricePer1K', render: (v: unknown) => <Text>${Number(v).toFixed(4)}</Text> },
              { key: 'outputPrice', title: '输出价格 (每1K tokens)', dataIndex: 'outputPricePer1K', render: (v: unknown) => <Text>${Number(v).toFixed(4)}</Text> },
            ]}
            dataSource={pricing}
            rowKey="model"
            size="small"
          />
        </Card>
      )}
    </div>
  );
};

export default CostOverview;
