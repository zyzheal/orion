/**
 * DBA Execution Plan Analyzer page
 *
 * Submit SQL against a data source; get the raw EXPLAIN output, the
 * parsed plan tree, and heuristic optimization hints (Seq Scan, high
 * cost, huge row counts, asymmetric hash joins).
 *
 * Also shows the recent explain history for the tenant.
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
  Alert,
  Checkbox,
} from 'antd';
import {
  PlayCircleOutlined,
  ReloadOutlined,
  ApartmentOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';
import {
  listDataSources,
  analyzeExplainPlan,
  listExplainHistory,
  type DataSource,
  type ExplainResult,
  type ExplainNode,
  type ExplainJob,
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

// ---- Recursive plan tree renderer ----

const PlanTreeNode: React.FC<{ node: ExplainNode; depth?: number }> = ({ node, depth = 0 }) => {
  const bg =
    node.scan_type === 'Seq'
      ? '#fff2e8'
      : node.scan_type === 'Index'
        ? '#f6ffed'
        : depth === 0
          ? '#e6f4ff'
          : '#fafafa';

  return (
    <div
      style={{
        marginLeft: depth === 0 ? 0 : 16,
        padding: '6px 8px',
        background: bg,
        borderRadius: 4,
        marginBottom: 4,
        borderLeft: `3px solid ${
          node.scan_type === 'Seq' ? colors.error[500] : node.scan_type === 'Index' ? colors.success[500] : colors.primary[500]
        }`,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
        <Space size={6}>
          <Text strong>{node.node_type}</Text>
          {node.relation && <Tag color="blue">{node.relation}</Tag>}
          {node.index && <Tag color="purple">{node.index}</Tag>}
          {node.scan_type && <Tag>{node.scan_type}</Tag>}
        </Space>
        <Space size={6}>
          {node.cost && (
            <Text type="secondary" style={{ fontSize: 11 }}>
              cost={node.cost.total.toFixed(1)}
            </Text>
          )}
          {node.rows !== undefined && (
            <Text type="secondary" style={{ fontSize: 11 }}>
              rows={node.rows.toLocaleString()}
            </Text>
          )}
          {node.actual_time_ms !== undefined && (
            <Text type="secondary" style={{ fontSize: 11 }}>
              {(node.actual_time_ms / 1000).toFixed(2)}ms
            </Text>
          )}
        </Space>
      </div>
      {node.children && node.children.length > 0 && (
        <div style={{ marginTop: 4 }}>
          {node.children.map((c, i) => (
            <PlanTreeNode key={i} node={c} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

const DbaExplain: React.FC = () => {
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [dataSourceId, setDataSourceId] = useState<string>('');
  const [sql, setSql] = useState('');
  const [analyze, setAnalyze] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ExplainResult | null>(null);

  // History
  const [history, setHistory] = useState<ExplainJob[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

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

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await listExplainHistory(50);
      const list = (res.data as ExplainJob[]) ?? [];
      setHistory(Array.isArray(list) ? list : []);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const runAnalyze = async () => {
    if (!dataSourceId) {
      message.warning('请选择数据源');
      return;
    }
    if (!sql.trim()) {
      message.warning('请输入 SQL');
      return;
    }
    setRunning(true);
    setResult(null);
    try {
      const res = await analyzeExplainPlan({
        sql,
        data_source_id: dataSourceId,
        analyze,
      });
      setResult(res.data as ExplainResult);
      loadHistory();
    } catch (err) {
      message.error(`EXPLAIN 失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setRunning(false);
    }
  };

  const historyColumns = [
    { key: 'id', title: 'ID', dataIndex: 'id', width: 100, render: (v: unknown) => <Text code>{String(v).slice(0, 8)}</Text> },
    { key: 'sql', title: 'SQL', dataIndex: 'sql', ellipsis: true, render: (v: unknown) => <Text code style={{ fontSize: 11 }}>{String(v).slice(0, 80)}</Text> },
    { key: 'db_type', title: '类型', dataIndex: 'db_type', width: 80, render: (v: unknown) => <Tag>{String(v)}</Tag> },
    {
      key: 'passed',
      title: '通过',
      dataIndex: 'passed',
      width: 80,
      render: (v: unknown) => v ? <Tag color="success">通过</Tag> : <Tag color="error">有建议</Tag>,
    },
    { key: 'duration_ms', title: '耗时', dataIndex: 'duration_ms', width: 80 },
    {
      key: 'created_at',
      title: '时间',
      dataIndex: 'created_at',
      width: 180,
      render: (v: unknown) => <Text type="secondary">{String(v)}</Text>,
    },
  ];

  return (
    <div style={{ padding: 0 }}>
      <div style={{ marginBottom: spacing.lg }}>
        <Title level={2} style={{ marginBottom: spacing.sm }}>
          <ApartmentOutlined style={{ marginRight: spacing.sm, color: colors.primary[500] }} />
          执行计划分析
        </Title>
        <Text type="secondary">运行 EXPLAIN 并基于计划树提供优化建议</Text>
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
          <Card size="small" title="选项">
            <Checkbox checked={analyze} onChange={(e) => setAnalyze(e.target.checked)}>
              EXPLAIN ANALYZE (实际执行并返回真实耗时)
            </Checkbox>
            <Alert
              type="warning"
              showIcon
              message="ANALYZE 会真正执行查询"
              style={{ marginTop: 8, padding: '4px 8px' }}
            />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card size="small" title="SQL">
            <Input.TextArea
              rows={3}
              value={sql}
              onChange={(e) => setSql(e.target.value)}
              placeholder="SELECT * FROM orders JOIN users ON orders.user_id = users.id WHERE orders.status = 'active';"
              style={{ fontFamily: 'monospace', fontSize: 12 }}
              disabled={running}
            />
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              loading={running}
              onClick={runAnalyze}
              style={{ marginTop: 8 }}
              disabled={!dataSourceId || !sql.trim()}
            >
              运行 EXPLAIN
            </Button>
          </Card>
        </Col>
      </Row>

      {result && (
        <>
          <Alert
            type={result.passed ? 'success' : 'warning'}
            showIcon
            message={
              result.passed
                ? '计划质量良好，无优化建议'
                : `发现 ${result.suggestions.length} 条优化建议`
            }
            style={{ marginBottom: spacing.md }}
          />

          <Row gutter={16} style={{ marginBottom: spacing.md }}>
            <Col xs={24} md={12}>
              <Card size="small" title="计划树">
                <PlanTreeNode node={result.plan} />
              </Card>
            </Col>
            <Col xs={24} md={12}>
              <Card size="small" title="优化建议">
                {result.suggestions.length === 0 ? (
                  <Alert type="success" showIcon message="无建议 — 计划已优化" />
                ) : (
                  <Space direction="vertical" style={{ width: '100%' }} size={8}>
                    {result.suggestions.map((s, i) => (
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
                        {s.node_id && (
                          <Text type="secondary" style={{ fontSize: 11 }}>节点: {s.node_id}</Text>
                        )}
                      </Card>
                    ))}
                  </Space>
                )}
              </Card>
            </Col>
          </Row>

          <Card size="small" title="原始 EXPLAIN 输出">
            <pre
              style={{
                fontSize: 11,
                background: '#1e1e1e',
                color: '#d4d4d4',
                padding: 8,
                borderRadius: 4,
                maxHeight: 240,
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}
            >
              {result.plan_text}
            </pre>
          </Card>
        </>
      )}

      <Card
        size="small"
        title={
          <Space>
            <HistoryOutlined /> 历史 EXPLAIN
            <Button
              type="link"
              size="small"
              icon={<ReloadOutlined />}
              onClick={loadHistory}
              loading={historyLoading}
            >
              刷新
            </Button>
          </Space>
        }
        style={{ marginTop: spacing.md }}
      >
        <Table
          columns={historyColumns}
          dataSource={history}
          rowKey="id"
          size="small"
          loading={historyLoading}
          pagination={{ pageSize: 10, showSizeChanger: false }}
          locale={{ emptyText: '暂无 EXPLAIN 历史' }}
        />
      </Card>
    </div>
  );
};

export default DbaExplain;
