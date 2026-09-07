/**
 * DBA AI SQL Review page
 *
 * Submits SQL to the AI review endpoint (LocalAuditEngine + optional
 * LLM) and displays audit findings + AI suggestions + verdict.
 * Also shows recent review history.
 */
import React, { useState, useCallback, useEffect } from 'react';
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
  Empty,
  Alert,
  Row,
  Col,
  Divider,
  Statistic,
  Progress,
} from 'antd';
import {
  RobotOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  ThunderboltOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';
import {
  listDataSources,
  reviewSQL,
  listReviewHistory,
  type DataSource,
  type SQLReviewResult,
  type AISuggestion,
  type ReviewRecord,
} from '@/api/dba';

const { Title, Text, Paragraph } = Typography;

const verdictColor: Record<string, string> = {
  pass: 'success',
  warn: 'warning',
  reject: 'error',
};

const verdictLabel: Record<string, string> = {
  pass: '通过',
  warn: '警告',
  reject: '拒绝',
};

const severityColor: Record<string, string> = {
  critical: 'red',
  high: 'volcano',
  medium: 'orange',
  low: 'blue',
  info: 'geekblue',
};

const DbaAIReview: React.FC = () => {
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [sql, setSql] = useState('');
  const [dbType, setDbType] = useState<string>('postgres');
  const [context, setContext] = useState('');
  const [explainPlan, setExplainPlan] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [result, setResult] = useState<SQLReviewResult | null>(null);

  const [history, setHistory] = useState<ReviewRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // ---- Load data sources (for db_type hint) ----

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
      const res = await listReviewHistory(50);
      const list = (res.data as ReviewRecord[]) ?? [];
      setHistory(Array.isArray(list) ? list : []);
    } catch (err) {
      setHistory([]);
      message.error(`加载历史记录失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  // ---- Review ----

  const runReview = async () => {
    if (!sql.trim()) {
      message.warning('请输入 SQL');
      return;
    }
    setReviewing(true);
    try {
      const res = await reviewSQL({ sql, db_type: dbType, context, explain_plan: explainPlan });
      setResult(res.data as SQLReviewResult);
    } catch (err) {
      message.error(`评审失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setReviewing(false);
    }
  };

  const suggestions = (result?.ai_suggestions ?? []) as AISuggestion[];

  return (
    <div style={{ padding: 0 }}>
      <div style={{ marginBottom: spacing.lg }}>
        <Title level={2} style={{ marginBottom: spacing.sm }}>
          <RobotOutlined style={{ marginRight: spacing.sm, color: colors.purple[500] }} />
          AI SQL 智能评审
        </Title>
        <Text type="secondary">本地规则引擎 + LLM 联合评审 SQL 安全性与优化空间</Text>
      </div>

      <Row gutter={16} style={{ marginBottom: spacing.md }}>
        <Col xs={24} md={16}>
          <Card size="small" title="SQL 输入">
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <Select
                style={{ width: 140 }}
                value={dbType}
                onChange={setDbType}
                options={[
                  { label: 'PostgreSQL', value: 'postgres' },
                  { label: 'MySQL', value: 'mysql' },
                ]}
              />
              <Select
                style={{ width: 200 }}
                value={undefined}
                placeholder="关联数据源 (可选)"
                options={dataSources.map((ds) => ({
                  label: `${ds.name} (${ds.type})`,
                  value: ds.id,
                }))}
                onChange={() => {
                  /* dbType is set by the ds.type but user can override above */
                }}
                allowClear
              />
            </div>
            <Input.TextArea
              rows={6}
              value={sql}
              onChange={(e) => setSql(e.target.value)}
              placeholder="SELECT * FROM orders WHERE created_at > NOW() - INTERVAL '7 days';"
              style={{ fontFamily: 'monospace', fontSize: 13 }}
              disabled={reviewing}
            />
            <Divider style={{ margin: '12px 0' }} />
            <Text strong>业务上下文</Text>
            <Input.TextArea
              rows={2}
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="如: 用于每周业务报表刷新"
              style={{ marginTop: 4 }}
              disabled={reviewing}
            />
            <Text strong style={{ display: 'block', marginTop: 8 }}>EXPLAIN PLAN (可选)</Text>
            <Input.TextArea
              rows={3}
              value={explainPlan}
              onChange={(e) => setExplainPlan(e.target.value)}
              placeholder="seq scan on orders (cost=...)"
              style={{ marginTop: 4, fontFamily: 'monospace', fontSize: 12 }}
              disabled={reviewing}
            />
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              loading={reviewing}
              onClick={runReview}
              style={{ marginTop: spacing.md }}
            >
              提交评审
            </Button>
          </Card>
        </Col>

        <Col xs={24} md={8}>
          <Card size="small" title="评审结果">
            {!result ? (
              <Empty description="提交后显示评审结果" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <Space direction="vertical" style={{ width: '100%' }} size={12}>
                <Statistic
                  title="评分"
                  value={result.score}
                  suffix="/ 100"
                  valueStyle={{
                    color: result.score >= 80 ? colors.success[500] : result.score >= 60 ? colors.warning[500] : colors.error[500],
                    fontSize: 32,
                    fontWeight: 600,
                  }}
                />
                <Progress
                  percent={result.score}
                  status={result.score >= 80 ? 'success' : result.score >= 60 ? 'normal' : 'exception'}
                />
                <Space>
                  <Tag
                    color={verdictColor[result.verdict] ?? 'default'}
                    icon={
                      result.verdict === 'pass'
                        ? <CheckCircleOutlined />
                        : result.verdict === 'reject'
                          ? <CloseCircleOutlined />
                          : <WarningOutlined />
                    }
                  >
                    结论: {verdictLabel[result.verdict] ?? result.verdict}
                  </Tag>
                  {result.ai_called && (
                    <Tag icon={<ThunderboltOutlined />} color="purple">AI</Tag>
                  )}
                </Space>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  模型: {result.model_used ?? '—'} · 耗时 {(result.duration / 1e6).toFixed(1)}ms
                </Text>
                {result.ai_errors && result.ai_errors.length > 0 && (
                  <Alert type="warning" message="AI 调用异常" description={result.ai_errors.join('; ')} showIcon />
                )}
                {result.local_audit ? (
                  <div>
                    <Text strong style={{ fontSize: 12 }}>本地规则引擎:</Text>
                    <pre
                      style={{
                        fontSize: 11,
                        background: '#f5f5f5',
                        padding: 8,
                        borderRadius: 4,
                        maxHeight: 120,
                        overflow: 'auto',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                      }}
                    >
                      {JSON.stringify(result.local_audit, null, 2)}
                    </pre>
                  </div>
                ) : null}
              </Space>
            )}
          </Card>
        </Col>
      </Row>

      {suggestions.length > 0 && (
        <Card size="small" title="AI 优化建议" style={{ marginBottom: spacing.md }}>
          {suggestions.map((s, i) => (
            <div key={i} style={{ marginBottom: 12 }}>
              <Space size={8} wrap>
                <Tag color={severityColor[s.severity] ?? 'default'}>{s.severity}</Tag>
                <Tag color="blue">{s.category}</Tag>
                <Text strong>{s.title}</Text>
              </Space>
              <Paragraph style={{ margin: '4px 0' }}>{s.description}</Paragraph>
              <Text type="secondary">建议: {s.suggestion}</Text>
              {s.fixed_sql && (
                <pre
                  style={{
                    fontSize: 12,
                    background: '#f6ffed',
                    padding: 8,
                    borderRadius: 4,
                    marginTop: 4,
                    overflow: 'auto',
                    maxHeight: 120,
                  }}
                >
                  {s.fixed_sql}
                </pre>
              )}
            </div>
          ))}
        </Card>
      )}

      <Card
        size="small"
        title={
          <Space>
            <HistoryOutlined /> 评审历史
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
      >
        <Table
          columns={[
            { key: 'id', title: 'ID', dataIndex: 'id', width: 100, render: (v: unknown) => <Text code>{String(v).slice(0, 8)}</Text> },
            { key: 'sql', title: 'SQL', dataIndex: 'sql', ellipsis: true, render: (v: unknown) => <Text code style={{ fontSize: 11 }}>{String(v).slice(0, 80)}</Text> },
            { key: 'db_type', title: '类型', dataIndex: 'db_type', width: 80, render: (v: unknown) => <Tag>{String(v)}</Tag> },
            {
              key: 'verdict',
              title: '结论',
              dataIndex: 'verdict',
              width: 80,
              render: (v: unknown) => <Tag color={verdictColor[String(v)] ?? 'default'}>{verdictLabel[String(v)] ?? String(v)}</Tag>,
            },
            { key: 'score', title: '评分', dataIndex: 'score', width: 60 },
            { key: 'model_used', title: '模型', dataIndex: 'model_used', width: 100 },
            { key: 'created_at', title: '时间', dataIndex: 'created_at', width: 180, render: (v: unknown) => <Text type="secondary">{String(v)}</Text> },
          ]}
          dataSource={history}
          rowKey="id"
          size="small"
          loading={historyLoading}
          locale={{ emptyText: <Empty description="暂无评审历史" /> }}
        />
      </Card>
    </div>
  );
};

export default DbaAIReview;
