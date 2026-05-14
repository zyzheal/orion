/**
 * LLM Trace List - Call history with filters
 */
import React, { useState, useEffect } from 'react';
import {
  Typography,
  Button,
  Card,
  Table,
  Tag,
  Input,
  Select,
  Space,
  message,
  Spin,
  Tooltip,
} from 'antd';
import { ReloadOutlined, SearchOutlined, InfoCircleOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { getTraces, type LLMTrace } from '@/api/llm-trace';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

const STATUS_COLORS: Record<string, string> = {
  pending: 'default',
  completed: 'success',
  failed: 'error',
  timeout: 'warning',
};

const TraceList: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [traces, setTraces] = useState<LLMTrace[]>([]);
  const [total, setTotal] = useState(0);
  const [tenantId, setTenantId] = useState<number | undefined>(1);
  const [scenarioId, setScenarioId] = useState<string | undefined>();
  const [limit, setLimit] = useState(50);

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await getTraces({ tenantId, scenarioId, limit });
      const data = response.data.data as { data: LLMTrace[]; total: number };
      setTraces(data.data || []);
      setTotal(data.total || 0);
    } catch (error: unknown) {
      setTraces([]);
      setTotal(0);
      message.error(`加载调用记录失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [tenantId, scenarioId, limit]);

  const columns: ColumnsType<LLMTrace> = [
    {
      key: 'traceId',
      title: 'Trace ID',
      dataIndex: 'traceId',
      width: 120,
      render: (v: string) => (
        <Tooltip title={v}>
          <Text style={{ fontSize: 12 }}>{v.slice(0, 8)}...</Text>
        </Tooltip>
      ),
    },
    {
      key: 'scenarioId',
      title: '场景',
      dataIndex: 'scenarioId',
      width: 100,
      render: (v: string) => <Tag>{v}</Tag>,
    },
    {
      key: 'modelId',
      title: '模型',
      dataIndex: 'modelId',
      width: 100,
      render: (v: string) => <Tag color="blue">{v}</Tag>,
    },
    {
      key: 'providerId',
      title: '供应商',
      dataIndex: 'providerId',
      width: 80,
      render: (v: string) => <Text>{v}</Text>,
    },
    {
      key: 'tokens',
      title: 'Token',
      width: 120,
      render: (_: unknown, record: LLMTrace) => (
        <Text>
          {record.inputTokens} → {record.outputTokens}
        </Text>
      ),
    },
    {
      key: 'cost',
      title: '成本',
      dataIndex: 'estimatedCost',
      width: 80,
      render: (v: number) => <Text strong>¥{v.toFixed(2)}</Text>,
    },
    {
      key: 'latency',
      title: '延迟',
      dataIndex: 'responseLatencyMs',
      width: 80,
      render: (v: number | null) => (
        <Text>{v !== null ? `${v}ms` : '-'}</Text>
      ),
    },
    {
      key: 'status',
      title: '状态',
      dataIndex: 'status',
      width: 80,
      render: (v: string) => <Tag color={STATUS_COLORS[v]}>{v}</Tag>,
    },
    {
      key: 'time',
      title: '时间',
      dataIndex: 'requestStartedAt',
      width: 150,
      render: (v: Date | string) => (
        <Text style={{ fontSize: 12 }}>
          {new Date(v).toLocaleString('zh-CN')}
        </Text>
      ),
    },
  ];

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
            LLM 调用记录
          </Title>
          <Text type="secondary">
            查看 LLM 调用详情、Token 消耗、成本统计
            <Tooltip title="每次 LLM 调用都会生成一条 Trace 记录">
              <InfoCircleOutlined style={{ marginLeft: 4, color: colors.light.text.secondary }} />
            </Tooltip>
          </Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
          刷新
        </Button>
      </div>

      {/* Filters */}
      <Card size="small" style={{ marginBottom: spacing[4] }}>
        <Space>
          <Text>租户:</Text>
          <Input
            type="number"
            placeholder="租户ID"
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value ? Number(e.target.value) : undefined)}
            style={{ width: 100 }}
          />
          <Text>场景:</Text>
          <Select
            placeholder="选择场景"
            allowClear
            value={scenarioId}
            onChange={(v) => setScenarioId(v)}
            style={{ width: 150 }}
            options={[
              { value: 'autofix', label: 'AutoFix' },
              { value: 'code-review', label: 'Code Review' },
              { value: 'diagnosis', label: 'Diagnosis' },
              { value: 'knowledge', label: 'Knowledge Q&A' },
              { value: 'summary', label: 'Summary' },
            ]}
          />
          <Text>数量:</Text>
          <Select
            value={limit}
            onChange={(v) => setLimit(v)}
            style={{ width: 100 }}
            options={[
              { value: 20, label: '20' },
              { value: 50, label: '50' },
              { value: 100, label: '100' },
              { value: 200, label: '200' },
            ]}
          />
          <Button icon={<SearchOutlined />} onClick={loadData}>
            查询
          </Button>
        </Space>
      </Card>

      {/* Table */}
      <Card>
        {loading ? (
          <div style={{ textAlign: 'center', padding: spacing[8] }}>
            <Spin />
          </div>
        ) : (
          <Table
            columns={columns}
            dataSource={traces}
            rowKey="traceId"
            pagination={{
              total,
              pageSize: limit,
              showSizeChanger: true,
              showTotal: (t) => `共 ${t} 条记录`,
            }}
          />
        )}
      </Card>
    </div>
  );
};

export default TraceList;