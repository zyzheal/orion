/**
 * DBA Slow Query Collection & Analysis page
 *
 * Two panels:
 *   1. Top-N slow queries (collected from pg_stat_statements /
 *      performance_schema) with a "collect now" trigger per data source.
 *   2. Heuristic analyzer — paste any SQL and see concrete optimization
 *      hints from the local rule engine (SELECT *, LIKE '%', OR clauses,
 *      function-on-index, missing LIMIT, high rows_read).
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography,
  Button,
  Space,
  Tag,
  Card,
  Input,
  Select,
  message,
  Table,
  Row,
  Col,
  Statistic,
  Alert,
  InputNumber,
} from 'antd';
import {
  PlayCircleOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
  ClockCircleOutlined,
  DatabaseOutlined,
  ExperimentOutlined,
  ThunderboltFilled,
} from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';
import {
  listDataSources,
  collectSlowQueries,
  listTopSlowQueries,
  analyzeSlowSQL,
  getSlowQueryStats,
  type DataSource,
  type SlowQuery,
  type SlowQueryAnalysisResult,
  type SlowQuerySuggestion,
  type SlowQueryStats,
} from '@/api/dba';

const { Title, Text, Paragraph } = Typography;

const severityColor: Record<string, string> = {
  critical: 'red',
  high: 'volcano',
  medium: 'orange',
  low: 'blue',
  info: 'geekblue',
};

// suggestionBorderColor maps severity to a hex color for the Card's
// left border decoration. Kept separate from severityColor (which is
// an antd Tag preset name) so both surfaces stay readable.
function suggestionBorderColor(severity: string): string {
  switch (severity) {
    case 'critical':
    case 'high':
      return colors.error[500] as string;
    case 'medium':
      return colors.warning[500] as string;
    case 'low':
    case 'info':
      return colors.primary[500] as string;
    default:
      return colors.neutral[500] as string;
  }
}

const DbaSlowQuery: React.FC = () => {
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [dataSourceId, setDataSourceId] = useState<string>('');

  // Top-N
  const [topList, setTopList] = useState<SlowQuery[]>([]);
  const [topLoading, setTopLoading] = useState(false);
  const [orderBy, setOrderBy] = useState<'total_time_ms' | 'mean_time_ms' | 'rows_read'>('total_time_ms');
  const [limit, setLimit] = useState(50);

  // Collect
  const [collecting, setCollecting] = useState(false);
  const [collectedCount, setCollectedCount] = useState<number | null>(null);

  // Stats
  const [stats, setStats] = useState<SlowQueryStats | null>(null);

  // Analyzer
  const [analyzeSQL, setAnalyzeSQL] = useState('');
  const [analyzeDBType, setAnalyzeDBType] = useState('postgres');
  const [analyzeRowsRead, setAnalyzeRowsRead] = useState<number | undefined>(undefined);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<SlowQueryAnalysisResult | null>(null);

  // ---- Load data sources ----
  useEffect(() => {
    void (async () => {
      try {
        const res = await listDataSources('default');
        const list = (res.data as DataSource[]) ?? [];
        setDataSources(Array.isArray(list) ? list : []);
      } catch {
        /* non-fatal */
      }
    })();
  }, []);

  const loadTop = useCallback(async () => {
    if (!dataSourceId) {
      setTopList([]);
      return;
    }
    setTopLoading(true);
    try {
      const res = await listTopSlowQueries({ data_source_id: dataSourceId, limit, order_by: orderBy });
      const list = (res.data as SlowQuery[]) ?? [];
      setTopList(Array.isArray(list) ? list : []);
    } catch (err) {
      setTopList([]);
      message.error(`加载 Top 慢查询失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setTopLoading(false);
    }
  }, [dataSourceId, limit, orderBy]);

  const loadStats = useCallback(async () => {
    if (!dataSourceId) {
      setStats(null);
      return;
    }
    try {
      const res = await getSlowQueryStats(dataSourceId, 24);
      setStats(res.data as SlowQueryStats);
    } catch {
      setStats(null);
    }
  }, [dataSourceId]);

  useEffect(() => {
    void loadTop();
    void loadStats();
  }, [loadTop, loadStats]);

  // ---- Collect ----
  const triggerCollect = async () => {
    if (!dataSourceId) {
      message.warning('请先选择数据源');
      return;
    }
    setCollecting(true);
    setCollectedCount(null);
    try {
      const res = await collectSlowQueries({ data_source_id: dataSourceId, threshold_ms: 1000 });
      const body = res.data as { collected: number };
      setCollectedCount(body.collected);
      message.success(`已采集 ${body.collected} 条慢查询`);
      await loadTop();
      await loadStats();
    } catch (err) {
      message.error(`采集失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setCollecting(false);
    }
  };

  // ---- Analyze ----
  const runAnalysis = async () => {
    if (!analyzeSQL.trim()) {
      message.warning('请输入 SQL');
      return;
    }
    setAnalyzing(true);
    setAnalysis(null);
    try {
      const res = await analyzeSlowSQL({
        sql: analyzeSQL,
        db_type: analyzeDBType,
        rows_read: analyzeRowsRead,
      });
      setAnalysis(res.data as SlowQueryAnalysisResult);
    } catch (err) {
      message.error(`分析失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setAnalyzing(false);
    }
  };

  const columns = [
    { key: 'schema', title: 'Schema', dataIndex: 'schema', width: 100 },
    {
      key: 'query',
      title: 'SQL',
      dataIndex: 'query',
      ellipsis: true,
      render: (v: unknown) => <Text code style={{ fontSize: 11 }}>{String(v).slice(0, 100)}</Text>,
    },
    { key: 'call_count', title: '调用', dataIndex: 'call_count', width: 80 },
    {
      key: 'mean_time_ms',
      title: '平均(ms)',
      dataIndex: 'mean_time_ms',
      width: 100,
      sorter: (a: SlowQuery, b: SlowQuery) => a.mean_time_ms - b.mean_time_ms,
      render: (v: number) => <Text>{v.toFixed(1)}</Text>,
    },
    {
      key: 'total_time_ms',
      title: '总时长(ms)',
      dataIndex: 'total_time_ms',
      width: 110,
      render: (v: number) => <Text strong>{v.toFixed(0)}</Text>,
    },
    { key: 'rows_read', title: '扫描行', dataIndex: 'rows_read', width: 100 },
    {
      key: 'collected_at',
      title: '采集时间',
      dataIndex: 'collected_at',
      width: 180,
      render: (v: unknown) => <Text type="secondary">{String(v)}</Text>,
    },
  ];

  const suggestions = (analysis?.suggestions ?? []) as SlowQuerySuggestion[];

  return (
    <div style={{ padding: 0 }}>
      <div style={{ marginBottom: spacing.lg }}>
        <Title level={2} style={{ marginBottom: spacing.sm }}>
          <ClockCircleOutlined style={{ marginRight: spacing.sm, color: colors.primary[500] }} />
          慢查询分析
        </Title>
        <Text type="secondary">
          采集 pg_stat_statements / performance_schema 慢查询 + 启发式优化建议
        </Text>
      </div>

      <Row gutter={16} style={{ marginBottom: spacing.md }}>
        <Col xs={24} md={8}>
          <Card size="small" title="数据源">
            <Select
              style={{ width: '100%' }}
              placeholder="选择数据源"
              value={dataSourceId || undefined}
              onChange={setDataSourceId}
              options={dataSources.map((ds) => ({
                label: `${ds.name} (${ds.host}:${ds.port})`,
                value: ds.id,
              }))}
              notFoundContent="暂无数据源"
              allowClear
            />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card size="small" title="采集">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text type="secondary">默认阈值 1000ms</Text>
              <Button
                type="primary"
                icon={<ThunderboltOutlined />}
                loading={collecting}
                onClick={triggerCollect}
                disabled={!dataSourceId}
              >
                立即采集
              </Button>
              {collectedCount !== null && (
                <Tag icon={<ThunderboltFilled />} color="success">
                  采集 {collectedCount} 条
                </Tag>
              )}
            </Space>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card size="small" title="统计 (24h)">
            <Statistic
              title="慢查询种类"
              value={stats?.distinct_queries ?? 0}
              prefix={<DatabaseOutlined />}
              valueStyle={{ color: colors.primary[500], fontSize: 32, fontWeight: 600 }}
            />
          </Card>
        </Col>
      </Row>

      <Card
        size="small"
        title={
          <Space>
            <Text>Top 慢查询</Text>
            <Select
              size="small"
              value={orderBy}
              onChange={(v) => setOrderBy(v as typeof orderBy)}
              style={{ width: 140 }}
              options={[
                { label: '按总时长', value: 'total_time_ms' },
                { label: '按平均时长', value: 'mean_time_ms' },
                { label: '按扫描行', value: 'rows_read' },
              ]}
            />
            <InputNumber
              size="small"
              min={10}
              max={500}
              step={10}
              value={limit}
              onChange={(v) => setLimit(v ?? 50)}
              addonBefore="Top"
              addonAfter="条"
            />
            <Button
              size="small"
              icon={<ReloadOutlined />}
              loading={topLoading}
              onClick={loadTop}
              disabled={!dataSourceId}
            >
              刷新
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={topList}
          rowKey="id"
          size="small"
          loading={topLoading}
          pagination={{ pageSize: 20, showSizeChanger: false }}
          locale={{ emptyText: !dataSourceId ? '请先选择数据源' : '暂无慢查询记录 — 点击「立即采集」开始' }}
        />
      </Card>

      <Card size="small" title="启发式 SQL 分析" style={{ marginTop: spacing.md }}>
        <Row gutter={16}>
          <Col xs={24} md={14}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <Select
                style={{ width: 140 }}
                value={analyzeDBType}
                onChange={setAnalyzeDBType}
                options={[
                  { label: 'PostgreSQL', value: 'postgres' },
                  { label: 'MySQL', value: 'mysql' },
                ]}
              />
              <InputNumber
                style={{ width: 160 }}
                min={0}
                value={analyzeRowsRead}
                onChange={(v) => setAnalyzeRowsRead(v ?? undefined)}
                addonBefore="扫描行"
                placeholder="可选"
              />
            </div>
            <Input.TextArea
              rows={6}
              value={analyzeSQL}
              onChange={(e) => setAnalyzeSQL(e.target.value)}
              placeholder="SELECT * FROM orders WHERE customer_name LIKE '%smith' ORDER BY created_at DESC;"
              style={{ fontFamily: 'monospace', fontSize: 13 }}
              disabled={analyzing}
            />
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              loading={analyzing}
              onClick={runAnalysis}
              style={{ marginTop: spacing.md }}
            >
              分析
            </Button>
          </Col>

          <Col xs={24} md={10}>
            <Card size="small" style={{ background: '#fafafa' }} title="分析结果">
              {!analysis ? (
                <Alert type="info" showIcon message="提交 SQL 后显示分析结果" />
              ) : (
                <Space direction="vertical" style={{ width: '100%' }} size={8}>
                  <Tag
                    color={analysis.passed ? 'success' : 'error'}
                    icon={analysis.passed ? <ExperimentOutlined /> : <ThunderboltOutlined />}
                  >
                    {analysis.passed ? '通过 — 无优化建议' : `发现 ${suggestions.length} 条建议`}
                  </Tag>
                  {suggestions.length === 0 && (
                    <Text type="secondary">SQL 无明显优化点</Text>
                  )}
                  {suggestions.map((s, i) => (
                    <Card
                      key={i}
                      size="small"
                      style={{ borderLeft: `3px solid ${suggestionBorderColor(s.severity)}` }}
                    >
                      <Space size={6} wrap>
                        <Tag color={severityColor[s.severity] ?? 'default'}>{s.severity}</Tag>
                        <Tag color="blue">{s.category}</Tag>
                        <Text strong>{s.title}</Text>
                      </Space>
                      <Paragraph style={{ margin: '4px 0', fontSize: 12 }}>{s.description}</Paragraph>
                      {s.fixed_sql && (
                        <pre
                          style={
                            {
                              fontSize: 11,
                              background: '#f6ffed',
                              padding: 6,
                              borderRadius: 4,
                              overflow: 'auto',
                              maxHeight: 100,
                            } as React.CSSProperties
                          }
                        >
                          {s.fixed_sql}
                        </pre>
                      )}
                    </Card>
                  ))}
                </Space>
              )}
            </Card>
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default DbaSlowQuery;
