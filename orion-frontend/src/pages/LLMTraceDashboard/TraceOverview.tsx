/**
 * LLM Trace Overview - Stats cards, daily trends, model distribution
 */
import React, { useState, useEffect } from 'react';
import {
  Typography,
  Button,
  Card,
  Row,
  Col,
  Table as AntTable,
  Tag,
  message,
  Spin,
} from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
  getDailyStats,
  getPricing,
  type DailyStats,
  type ModelPricing,
} from '@/api/llm-trace';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

const TraceOverview: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [dailyStats, setDailyStats] = useState<DailyStats | null>(null);
  const [pricing, setPricing] = useState<ModelPricing[]>([]);
  const [tenantId] = useState(1); // Default tenant for demo

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, pricingRes] = await Promise.all([
        getDailyStats({ tenantId }),
        getPricing(),
      ]);
      setDailyStats(statsRes.data as DailyStats | null);
      const pricingData = pricingRes.data as { pricing?: ModelPricing[] } | null;
      setPricing(pricingData?.pricing || []);
    } catch (error: unknown) {
      setDailyStats(null);
      setPricing([]);
      message.error(`加载追踪数据失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [tenantId]);

  const modelColumns: ColumnsType<{ modelId: string; count: number; cost: number }> = [
    {
      key: 'modelId',
      title: '模型',
      dataIndex: 'modelId',
      render: (v: string) => <Tag color="blue">{v}</Tag>,
    },
    {
      key: 'count',
      title: '调用次数',
      dataIndex: 'count',
      render: (v: number) => <Text>{v.toLocaleString()}</Text>,
    },
    {
      key: 'cost',
      title: '成本',
      dataIndex: 'cost',
      render: (v: number) => <Text strong>¥{v.toFixed(2)}</Text>,
    },
  ];

  const scenarioColumns: ColumnsType<{ scenarioId: string; count: number; cost: number }> = [
    {
      key: 'scenarioId',
      title: '场景',
      dataIndex: 'scenarioId',
      render: (v: string) => <Tag>{v}</Tag>,
    },
    {
      key: 'count',
      title: '调用次数',
      dataIndex: 'count',
      render: (v: number) => <Text>{v.toLocaleString()}</Text>,
    },
    {
      key: 'cost',
      title: '成本',
      dataIndex: 'cost',
      render: (v: number) => <Text strong>¥{v.toFixed(2)}</Text>,
    },
  ];

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: spacing[8] }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ padding: 0 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: spacing[6],
        }}
      >
        <div>
          <Title level={3} style={{ margin: 0 }}>
            LLM 追踪总览
          </Title>
          <Text type="secondary">LLM 调用追踪与成本监控</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
          刷新
        </Button>
      </div>

      {/* Stats Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: spacing[6] }}>
        <Col span={6}>
          <Card>
            <div style={{ marginBottom: 8 }}>
              <Text type="secondary">今日调用</Text>
            </div>
            <Title level={2} style={{ margin: 0, color: colors.primary[600] }}>
              {dailyStats?.totalTraces || 0}
            </Title>
            <Text type="secondary" style={{ fontSize: 12 }}>
              成功 {dailyStats?.completedTraces || 0} / 失败 {dailyStats?.failedTraces || 0}
            </Text>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <div style={{ marginBottom: 8 }}>
              <Text type="secondary">输入 Token</Text>
            </div>
            <Title level={2} style={{ margin: 0 }}>
              {(dailyStats?.totalInputTokens || 0).toLocaleString()}
            </Title>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <div style={{ marginBottom: 8 }}>
              <Text type="secondary">输出 Token</Text>
            </div>
            <Title level={2} style={{ margin: 0 }}>
              {(dailyStats?.totalOutputTokens || 0).toLocaleString()}
            </Title>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <div style={{ marginBottom: 8 }}>
              <Text type="secondary">今日成本</Text>
            </div>
            <Title level={2} style={{ margin: 0, color: colors.error[600] }}>
              ¥{(dailyStats?.totalCost || 0).toFixed(2)}
            </Title>
            <Text type="secondary" style={{ fontSize: 12 }}>
              平均延迟 {dailyStats?.averageLatencyMs || 0}ms
            </Text>
          </Card>
        </Col>
      </Row>

      {/* Model & Scenario Distribution */}
      <Row gutter={16} style={{ marginBottom: spacing[6] }}>
        <Col span={12}>
          <Card title="模型分布" size="small">
            <AntTable
              columns={modelColumns}
              dataSource={dailyStats?.topModels || []}
              rowKey="modelId"
              size="small"
              pagination={false}
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="场景分布" size="small">
            <AntTable
              columns={scenarioColumns}
              dataSource={dailyStats?.topScenarios || []}
              rowKey="scenarioId"
              size="small"
              pagination={false}
            />
          </Card>
        </Col>
      </Row>

      {/* Model Pricing */}
      {pricing.length > 0 && (
        <Card title="模型定价表">
          <AntTable
            columns={[
              {
                key: 'modelId',
                title: '模型',
                dataIndex: 'modelId',
                render: (v: string) => <Tag color="blue">{v}</Tag>,
              },
              {
                key: 'provider',
                title: '供应商',
                dataIndex: 'provider',
                render: (v: string) => <Text>{v}</Text>,
              },
              {
                key: 'inputPrice',
                title: '输入价格 (每Token)',
                dataIndex: 'inputPricePerToken',
                render: (v: number) => <Text>¥{v.toFixed(6)}</Text>,
              },
              {
                key: 'outputPrice',
                title: '输出价格 (每Token)',
                dataIndex: 'outputPricePerToken',
                render: (v: number) => <Text>¥{v.toFixed(6)}</Text>,
              },
            ]}
            dataSource={pricing}
            rowKey="modelId"
            size="small"
          />
        </Card>
      )}
    </div>
  );
};

export default TraceOverview;