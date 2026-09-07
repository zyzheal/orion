/**
 * Module Cost Dashboard — AI cost aggregated by business scenario/module
 * GET /api/v1/llm/cost/module-dashboard
 * P4d: Cost attribution to TR-09/10/11 business scenarios.
 */
import { useState, useEffect, useMemo } from 'react';
import {
  Card,
  Table,
  Tag,
  Typography,
  Space,
  Button,
  Empty,
  Statistic,
  Row,
  Col,
  message,
  Select,
} from 'antd';
import { ReloadOutlined, BarChartOutlined, DownloadOutlined } from '@ant-design/icons';
import { getModuleCostDashboard, type ModuleCostSummary } from '@/api/ai-cost';
import { colors, spacing } from '@/tokens';
import { useQuery } from '@/providers/QueryProvider';

const { Title, Text } = Typography;

// Human-readable labels for scenario IDs (mirrors backend ModuleNameMap)
const SCENARIO_LABEL: Record<string, { label: string; color: string }> = {
  'dev-agent': { label: '研发流程 Agent (TR-09)', color: 'purple' },
  pipeline: { label: 'AI 流水线 (TR-09)', color: 'cyan' },
  lowcode: { label: 'LowCode (TR-10)', color: 'blue' },
  'ai-generate': { label: 'LowCode AI 生成 (TR-10)', color: 'magenta' },
  ops: { label: 'Ops 问答助手 (TR-11)', color: 'green' },
  runbook: { label: 'Runbook (TR-11)', color: 'orange' },
  assistant: { label: 'AI 助手', color: 'blueviolet' },
  chatops: { label: 'ChatOps', color: 'gold' },
  eval: { label: '评测集 (TR-05)', color: 'red' },
  unknown: { label: '未分类', color: 'default' },
};

const ModuleCostDashboard: React.FC = () => {
  const {
    data = [],
    isLoading: loading,
    isError,
    error: queryError,
    refetch,
  } = useQuery<ModuleCostSummary[]>({
    queryKey: ['aicost-module-dashboard'],
    queryFn: () =>
      getModuleCostDashboard().then((res) => (Array.isArray(res.data) ? res.data : [])),
    staleTime: 30_000,
  });
  const [filterScenario, setFilterScenario] = useState<string>('all');

  const filteredData = useMemo(() => {
    if (filterScenario === 'all') return data;
    return data.filter((d) => d.scenario === filterScenario);
  }, [data, filterScenario]);

  const handleExport = () => {
    const headers = ['模块', '请求数', 'Token用量', '费用', '成功率'];
    const rows = filteredData.map((d) => [
      d.scenario,
      d.requests,
      d.tokens,
      d.cost.toFixed(4),
      `${Math.round(d.successRate * 100)}%`,
    ]);
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `module-cost-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    message.success('导出完成');
  };

  // 加载失败反馈：本仓库锁定的 react-query 构建不触发 useQuery 的 onError 选项
  // （QueryObserver 未实现 observer 级回调），统一用 isError + useEffect 呈现。
  useEffect(() => {
    if (isError)
      message.error(
        queryError instanceof Error ? `加载模块成本数据失败: ${queryError.message}` : '加载模块成本数据失败'
      );
  }, [isError, queryError]);

  const totalCost = filteredData.reduce((sum, d) => sum + (d.cost || 0), 0);
  const totalRequests = filteredData.reduce((sum, d) => sum + (d.requests || 0), 0);
  const totalTokens = filteredData.reduce((sum, d) => sum + (d.tokens || 0), 0);

  const columns = [
    {
      key: 'scenario',
      title: '模块 / 场景',
      dataIndex: 'scenario',
      render: (v: string) => {
        const info = SCENARIO_LABEL[v] || { label: v, color: 'default' };
        return <Tag color={info.color}>{info.label}</Tag>;
      },
    },
    {
      key: 'requests',
      title: '请求数',
      dataIndex: 'requests',
      sorter: (a: ModuleCostSummary, b: ModuleCostSummary) => a.requests - b.requests,
      render: (v: number) => <Text strong>{v.toLocaleString()}</Text>,
    },
    {
      key: 'tokens',
      title: 'Token 用量',
      dataIndex: 'tokens',
      sorter: (a: ModuleCostSummary, b: ModuleCostSummary) => a.tokens - b.tokens,
      render: (v: number) => <Text>{v.toLocaleString()}</Text>,
    },
    {
      key: 'cost',
      title: '费用',
      dataIndex: 'cost',
      sorter: (a: ModuleCostSummary, b: ModuleCostSummary) => a.cost - b.cost,
      render: (v: number, row: ModuleCostSummary) => (
        <Text strong>
          ${(v || 0).toFixed(4)} {row.currency ? <Text type="secondary">{row.currency}</Text> : ''}
        </Text>
      ),
    },
    {
      key: 'successRate',
      title: '成功率',
      dataIndex: 'successRate',
      sorter: (a: ModuleCostSummary, b: ModuleCostSummary) => a.successRate - b.successRate,
      render: (v: number) => {
        const pct = Math.round((v || 0) * 100);
        return <Tag color={pct >= 90 ? 'green' : pct >= 70 ? 'orange' : 'red'}>{pct}%</Tag>;
      },
    },
  ];

  const empty = (
    <Empty description="暂无模块成本数据">
      <Button icon={<ReloadOutlined />} onClick={() => refetch()} disabled={loading}>
        刷新
      </Button>
    </Empty>
  );

  return (
    <div style={{ padding: 0 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: spacing.md,
        }}
      >
        <div>
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <BarChartOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            模块成本归属
          </Title>
          <Text type="secondary">按业务场景统计 AI 成本，快速定位 TR-09/10/11 消耗</Text>
        </div>
        <Space>
          <Select
            options={[
              { label: '全部场景', value: 'all' },
              ...(data || []).map((d) => ({ label: d.scenario, value: d.scenario })),
            ]}
            value={filterScenario}
            onChange={setFilterScenario}
            allowClear
            style={{ width: 140 }}
            size="small"
          />
          <Button
            icon={<DownloadOutlined />}
            onClick={handleExport}
            disabled={filteredData.length === 0}
          >
            导出
          </Button>
          <Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={loading}>
            刷新
          </Button>
        </Space>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: spacing.md }}>
        <Col span={8}>
          <Card>
            <Statistic
              title="总费用"
              value={totalCost}
              precision={4}
              prefix="$"
              valueStyle={{ color: colors.error[600] }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="总请求数" value={totalRequests} suffix="次" />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="总 Token 用量" value={totalTokens} suffix="tokens" />
          </Card>
        </Col>
      </Row>

      <Card>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: colors.neutral[500] }}>
            加载中...
          </div>
        ) : data.length === 0 ? (
          empty
        ) : (
          <Table
            columns={columns}
            dataSource={filteredData}
            rowKey="scenario"
            size="small"
            pagination={false}
          />
        )}
      </Card>

      <Space direction="vertical" size={4} style={{ marginTop: spacing.sm }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          <Space>
            <Tag color="purple">TR-09 研发流程</Tag>
            <Tag color="magenta">TR-10 LowCode</Tag>
            <Tag color="green">TR-11 Ops</Tag>
          </Space>
        </Text>
      </Space>
    </div>
  );
};

export default ModuleCostDashboard;
