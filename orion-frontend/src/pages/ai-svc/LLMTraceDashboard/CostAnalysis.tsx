/**
 * LLM Cost Analysis - Cost breakdown, model comparison
 */
import React, { useState, useEffect } from 'react';
import {
  Typography,
  Button,
  Card,
  Row,
  Col,
  Table,
  Tag,
  DatePicker,
  Space,
  message,
  Spin,
  Statistic,
} from 'antd';
import { ReloadOutlined, LineChartOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { getCostBreakdown, type CostBreakdown } from '@/api/llm-trace';
import { colors, spacing } from '@/tokens';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const CostAnalysis: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [costData, setCostData] = useState<CostBreakdown | null>(null);
  const [tenantId] = useState(1);
  const [dateRange, setDateRange] = useState<[string, string] | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const params: { tenantId: number; startDate?: string; endDate?: string } = { tenantId };
      if (dateRange) {
        params.startDate = dateRange[0];
        params.endDate = dateRange[1];
      }
      const response = await getCostBreakdown(params);
      setCostData(response.data.data as CostBreakdown | null);
    } catch (error: unknown) {
      setCostData(null);
      message.error(`加载成本数据失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [tenantId, dateRange]);

  const handleDateChange = (
    dates: [dayjs.Dayjs | null, dayjs.Dayjs | null] | null
  ) => {
    if (dates && dates[0] && dates[1]) {
      setDateRange([dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD')]);
    } else {
      setDateRange(null);
    }
  };

  const modelColumns: ColumnsType<{ modelId: string; traces: number; cost: number }> = [
    {
      key: 'modelId',
      title: '模型',
      dataIndex: 'modelId',
      render: (v: string) => <Tag color="blue">{v}</Tag>,
    },
    {
      key: 'traces',
      title: '调用次数',
      dataIndex: 'traces',
      render: (v: number) => <Text>{v.toLocaleString()}</Text>,
    },
    {
      key: 'cost',
      title: '成本',
      dataIndex: 'cost',
      render: (v: number) => <Text strong>¥{v.toFixed(2)}</Text>,
      sorter: (a, b) => a.cost - b.cost,
    },
    {
      key: 'avgCost',
      title: '平均单次成本',
      render: (_: unknown, record: { traces: number; cost: number }) => (
        <Text>¥{(record.cost / record.traces).toFixed(4)}</Text>
      ),
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
          <Title level={2} style={{ marginBottom: 8 }}>
            <LineChartOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            LLM 成本分析
          </Title>
          <Text type="secondary">按模型、时间范围分析成本构成</Text>
        </div>
        <Space>
          <RangePicker onChange={handleDateChange as any} />
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
        </Space>
      </div>

      {/* Summary Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: spacing[6] }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总调用次数"
              value={costData?.totalTraces || 0}
              suffix="次"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="输入 Token"
              value={costData?.totalInputTokens || 0}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="输出 Token"
              value={costData?.totalOutputTokens || 0}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="总成本"
              value={costData?.totalCost || 0}
              precision={2}
              prefix="¥"
              valueStyle={{ color: colors.error[600] }}
            />
          </Card>
        </Col>
      </Row>

      {/* Cost Breakdown */}
      <Row gutter={16}>
        <Col span={12}>
          <Card title="成本构成">
            <Row gutter={16}>
              <Col span={12}>
                <Statistic
                  title="输入成本"
                  value={costData?.inputCost || 0}
                  precision={2}
                  prefix="¥"
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="输出成本"
                  value={costData?.outputCost || 0}
                  precision={2}
                  prefix="¥"
                />
              </Col>
            </Row>
          </Card>
        </Col>
        <Col span={12}>
          <Card title="模型成本对比">
            <Table
              columns={modelColumns}
              dataSource={costData?.modelBreakdown || []}
              rowKey="modelId"
              size="small"
              pagination={false}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default CostAnalysis;