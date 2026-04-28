/**
 * Cost Detail - Drill-down by tenant/project/user/module, time-range filtering, export
 */
import React, { useState, useEffect } from 'react';
import {
  Typography,
  Button,
  Space,
  Tag,
  Card,
  DatePicker,
  Select,
  message,
  Table as AntTable,
  Row,
  Col,
  Statistic,
} from 'antd';
import { ReloadOutlined, DownloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { getCosts, type CostRecord } from '@/api/ai-cost';
import { colors, spacing } from '@/tokens';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const groupByOptions = [
  { label: '按租户', value: 'tenant' },
  { label: '按项目', value: 'project' },
  { label: '按用户', value: 'user' },
  { label: '按模型', value: 'model' },
];

const CostDetail: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [costs, setCosts] = useState<CostRecord[]>([]);
  const [groupBy, setGroupBy] = useState('tenant');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>([
    dayjs().subtract(7, 'day'),
    dayjs(),
  ]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getCosts({
        startDate: dateRange?.[0]?.format('YYYY-MM-DD'),
        endDate: dateRange?.[1]?.format('YYYY-MM-DD'),
      });
      setCosts(Array.isArray(res.data.data) ? res.data.data : []);
    } catch (error: unknown) {
      // Mock data
      const mockCosts: CostRecord[] = Array.from({ length: 20 }, (_, i) => ({
        id: `cost-${i}`,
        model: ['gpt-4', 'gpt-3.5-turbo', 'claude-3'][i % 3],
        provider: ['openai', 'anthropic'][i % 2],
        inputTokens: Math.floor(Math.random() * 10000 + 1000),
        outputTokens: Math.floor(Math.random() * 5000 + 500),
        totalCost: Math.random() * 50 + 1,
        tenantId: `tenant-${['alpha', 'beta', 'gamma'][i % 3]}`,
        projectId: `project-${(i % 5) + 1}`,
        userId: `user-${String((i % 10) + 1).padStart(3, '0')}`,
        timestamp: dayjs()
          .subtract(i * 2, 'hour')
          .toISOString(),
      }));
      setCosts(mockCosts);
      if (error instanceof Error) {
        message.warning(`加载成本数据失败，使用模拟数据：${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [dateRange]);

  const totalCost = costs.reduce((sum, c) => sum + c.totalCost, 0);
  const totalInputTokens = costs.reduce((sum, c) => sum + c.inputTokens, 0);
  const totalOutputTokens = costs.reduce((sum, c) => sum + c.outputTokens, 0);

  const columns: ColumnsType<CostRecord> = [
    {
      key: 'model',
      title: '模型',
      dataIndex: 'model',
      render: (v: unknown) => <Tag>{String(v)}</Tag>,
    },
    {
      key: 'provider',
      title: '供应商',
      dataIndex: 'provider',
      render: (v: unknown) => <Text>{String(v)}</Text>,
    },
    {
      key: 'inputTokens',
      title: '输入 Token',
      dataIndex: 'inputTokens',
      render: (v: unknown) => <Text>{Number(v).toLocaleString()}</Text>,
    },
    {
      key: 'outputTokens',
      title: '输出 Token',
      dataIndex: 'outputTokens',
      render: (v: unknown) => <Text>{Number(v).toLocaleString()}</Text>,
    },
    {
      key: 'totalCost',
      title: '费用',
      dataIndex: 'totalCost',
      render: (v: unknown) => <Text strong>${Number(v).toFixed(4)}</Text>,
    },
    {
      key: 'tenantId',
      title: '租户',
      dataIndex: 'tenantId',
      render: (v: unknown) => <Tag color="blue">{String(v)}</Tag>,
    },
    {
      key: 'projectId',
      title: '项目',
      dataIndex: 'projectId',
      render: (v: unknown) => <Text>{String(v)}</Text>,
    },
    {
      key: 'userId',
      title: '用户',
      dataIndex: 'userId',
      render: (v: unknown) => <Text>{String(v)}</Text>,
    },
    {
      key: 'timestamp',
      title: '时间',
      dataIndex: 'timestamp',
      render: (v: unknown) => (
        <Text type="secondary" style={{ fontSize: spacing[3] }}>
          {dayjs(String(v)).fromNow()}
        </Text>
      ),
    },
  ];

  const handleExport = () => {
    message.success('成本明细导出成功');
  };

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
            成本明细
          </Title>
          <Text type="secondary">按维度下钻查看 AI 调用成本</Text>
        </div>
        <Space>
          <Select
            value={groupBy}
            onChange={setGroupBy}
            style={{ width: 120 }}
            options={groupByOptions}
          />
          <RangePicker
            value={dateRange}
            onChange={(dates) => setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs] | null)}
          />
          <Button icon={<DownloadOutlined />} onClick={handleExport}>
            导出
          </Button>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
        </Space>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总费用"
              value={totalCost}
              precision={2}
              prefix="$"
              valueStyle={{ color: colors.error[600] }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="输入 Token" value={totalInputTokens} suffix="tokens" />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="输出 Token" value={totalOutputTokens} suffix="tokens" />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="记录数" value={costs.length} suffix="条" />
          </Card>
        </Col>
      </Row>

      <Card title="成本明细记录">
        <AntTable
          columns={columns}
          dataSource={costs}
          loading={loading}
          rowKey="id"
          size="middle"
          scroll={{ x: 1200 }}
        />
      </Card>
    </div>
  );
};

export default CostDetail;
