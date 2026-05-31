/**
 * APM Slow Requests Page (Phase 3.5.3)
 * Slow request ranking and query pattern analysis
 */
import React, { useState, useEffect } from 'react';
import { Typography, Card, Table, Button, Tag, Space, message, Spin, InputNumber } from 'antd';
import { ScheduleOutlined, ReloadOutlined, BarChartOutlined } from '@ant-design/icons';
import { apmApi, type SlowQuery, type QueryPatternStats } from '@/api/apm';
import { colors } from '@/tokens/colors';

const { Title, Text } = Typography;

const ApmSlowRequestsPage: React.FC = () => {
  const [slowQueries, setSlowQueries] = useState<SlowQuery[]>([]);
  const [patterns, setPatterns] = useState<QueryPatternStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [threshold, setThreshold] = useState(1000);
  const [_limit, _setLimit] = useState(20);

  const loadData = async () => {
    setLoading(true);
    try {
      const [queriesRes, patternsRes] = await Promise.all([
        apmApi.getSlowQueries({ limit: 50 }),
        apmApi.getQueryPatternStats(),
      ]);
      setSlowQueries(queriesRes);
      setPatterns(patternsRes);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '加载慢请求数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleThresholdChange = async (val: number | null) => {
    if (!val) return;
    setThreshold(val);
    setLoading(true);
    try {
      const result = await apmApi.getSlowQueries({ limit: 50 });
      setSlowQueries(result.filter((q) => q.duration_ms >= val));
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '加载慢请求失败');
    } finally {
      setLoading(false);
    }
  };

  const queryColumns = [
    {
      title: '排名', key: 'rank',
      render: (_: any, __: SlowQuery, index: number) => (
        <Tag color={index < 3 ? colors.error[500] : index < 10 ? colors.warning[500] : colors.neutral[400]}>
          #{index + 1}
        </Tag>
      ),
    },
    {
      title: 'SQL 语句', dataIndex: 'normalized_query', key: 'normalized_query',
      ellipsis: true, render: (v: string) => <code style={{ fontSize: 12 }}>{v?.slice(0, 80) || '-'}</code>,
    },
    {
      title: '耗时', dataIndex: 'duration_ms', key: 'duration_ms',
      render: (ms: number) => (
        <span style={{ color: ms > 5000 ? colors.error[500] : ms > 2000 ? colors.warning[500] : colors.neutral[900], fontWeight: 600 }}>
          {ms} ms
        </span>
      ),
    },
    { title: '参数数', dataIndex: 'params_count', key: 'params_count', render: (v: number) => v ?? '-' },
    { title: '错误', dataIndex: 'error', key: 'error', render: (v: string) => v ? <Tag color={colors.error[500]}>{v}</Tag> : '-' },
    {
      title: '时间', dataIndex: 'created_at', key: 'created_at',
      render: (v: string) => new Date(v).toLocaleString(),
    },
  ];

  const patternColumns = [
    {
      title: 'SQL 模式', dataIndex: 'normalized_query', key: 'normalized_query',
      ellipsis: true, render: (v: string) => <code style={{ fontSize: 12 }}>{v?.slice(0, 60) || '-'}</code>,
    },
    { title: '执行次数', dataIndex: 'execution_count', key: 'execution_count' },
    { title: '平均耗时', dataIndex: 'avg_duration_ms', key: 'avg_duration_ms', render: (ms: number) => `${ms.toFixed(0)} ms` },
    {
      title: 'P95 耗时', dataIndex: 'p95_duration_ms', key: 'p95_duration_ms',
      render: (ms: number) => <span style={{ color: ms > 2000 ? colors.error[500] : colors.neutral[900] }}>{ms.toFixed(0)} ms</span>,
    },
    { title: '错误次数', dataIndex: 'error_count', key: 'error_count', render: (v: number) => v > 0 ? <Tag color={colors.error[500]}>{v}</Tag> : '-' },
    {
      title: '最近执行', dataIndex: 'last_executed', key: 'last_executed',
      render: (v: string) => new Date(v).toLocaleString(),
    },
  ];

  return (
    <Spin spinning={loading}>
      <div style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <Title level={2} style={{ marginBottom: 8 }}>
              <ScheduleOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
              慢请求分析
            </Title>
            <Text type="secondary" style={{ color: colors.neutral[500], fontSize: 14 }}>追踪慢请求与 SQL 查询模式分析</Text>
          </div>
          <Space>
            <InputNumber addonBefore="阈值 (ms)" value={threshold} onChange={handleThresholdChange} min={100} style={{ width: 160 }} />
            <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>刷新</Button>
          </Space>
        </div>

        {/* Slow Query Ranking */}
        <Card title={<><BarChartOutlined /> 慢请求排行</>} style={{ marginBottom: 16 }}>
          <Table columns={queryColumns} dataSource={slowQueries} rowKey="id" pagination={{ pageSize: 10 }} size="small"
            locale={{ emptyText: slowQueries.length === 0 ? '暂无慢请求数据' : undefined }} />
        </Card>

        {/* Query Pattern Stats */}
        <Card title="SQL 查询模式统计">
          <Table columns={patternColumns} dataSource={patterns} rowKey="query_hash" pagination={{ pageSize: 10 }} size="small"
            locale={{ emptyText: patterns.length === 0 ? '暂无查询模式数据' : undefined }} />
        </Card>
      </div>
    </Spin>
  );
};

export default ApmSlowRequestsPage;
