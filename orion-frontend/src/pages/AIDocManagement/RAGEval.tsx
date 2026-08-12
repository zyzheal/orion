/**
 * RAG Eval Metrics - RAG 评估指标面板
 *
 * 展示 RAG 系统核心评估数据：
 * - 总查询数、平均置信度、平均延迟、反馈率、准确率
 * - 整体健康度环形图
 * - 加载、空状态、错误处理
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography,
  Card,
  Statistic,
  Row,
  Col,
  Progress,
  Space,
  Spin,
  Empty,
  Alert,
  Button,
  Divider,
  Descriptions,
} from 'antd';
import {
  ReloadOutlined,
  QuestionCircleOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  LikeOutlined,
  AimOutlined,
  BarChartOutlined,
} from '@ant-design/icons';
import { colors, spacing, componentRadius, shadows } from '@/tokens';
import { getRAGEvalMetrics } from '@/api/ai-docs';

const { Title, Text } = Typography;

// ============================================================================
// Types
// ============================================================================

export interface EvalMetric {
  total_queries: number;
  avg_confidence: number;
  avg_latency_ms: number;
  feedback_rate: number;
  accuracy_rate: number;
  /** 健康度评分 0-100 */
  health_score?: number;
  /** 时间段内查询趋势 */
  queries_trend?: { date: string; count: number }[];
  /** 评估时间范围 */
  period?: { start: string; end: string };
  /** 置信度分布 */
  confidence_distribution?: { range: string; count: number }[];
  /** 各查询类型占比 */
  query_type_distribution?: { type: string; count: number }[];
}

// ============================================================================
// Constants
// ============================================================================

const METRIC_CARDS = [
  {
    key: 'total_queries' as const,
    label: '总查询数',
    icon: <BarChartOutlined style={{ fontSize: 24, color: colors.primary[500] }} />,
    format: (v: number) => v.toLocaleString(),
    suffix: '',
    color: colors.primary[500],
  },
  {
    key: 'avg_confidence' as const,
    label: '平均置信度',
    icon: <CheckCircleOutlined style={{ fontSize: 24, color: colors.success[500] }} />,
    format: (v: number) => `${(v * 100).toFixed(1)}%`,
    suffix: '',
    color: colors.success[500],
  },
  {
    key: 'avg_latency_ms' as const,
    label: '平均延迟',
    icon: <ClockCircleOutlined style={{ fontSize: 24, color: colors.warning[500] }} />,
    format: (v: number) => `${v.toFixed(0)} ms`,
    suffix: '',
    color: colors.warning[500],
  },
  {
    key: 'feedback_rate' as const,
    label: '反馈率',
    icon: <LikeOutlined style={{ fontSize: 24, color: colors.purple?.[500] ?? '#7C5CFC' }} />,
    format: (v: number) => `${(v * 100).toFixed(1)}%`,
    suffix: '',
    color: colors.purple?.[500] ?? '#7C5CFC',
  },
  {
    key: 'accuracy_rate' as const,
    label: '准确率',
    icon: <AimOutlined style={{ fontSize: 24, color: colors.info[500] }} />,
    format: (v: number) => `${(v * 100).toFixed(1)}%`,
    suffix: '',
    color: colors.info[500],
  },
] as const;

// ============================================================================
// Sub-components
// ============================================================================

/**
 * 指标卡片 - 展示单个 KPI 数值
 */
const MetricCard: React.FC<{
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
  loading?: boolean;
}> = ({ label, value, icon, color, loading }) => (
  <Card
    hoverable
    style={{
      borderRadius: componentRadius.card,
      boxShadow: shadows.card,
      height: '100%',
    }}
    bodyStyle={{ padding: spacing.lg }}
  >
    {loading ? (
      <div style={{ textAlign: 'center', padding: '12px 0' }}>
        <Spin size="small" />
      </div>
    ) : (
      <Space direction="vertical" size={spacing.sm} style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          {icon}
          <Statistic
            value={value}
            valueStyle={{ fontSize: 28, fontWeight: 600, color, lineHeight: 1.2 }}
            suffix=""
          />
        </div>
        <Text type="secondary" style={{ fontSize: 14 }}>
          {label}
        </Text>
      </Space>
    )}
  </Card>
);

/**
 * 健康度环形图 - 展示系统整体健康状态
 */
const HealthRing: React.FC<{ score: number; loading?: boolean }> = ({ score, loading }) => {
  const getHealthColor = (s: number): string => {
    if (s >= 90) return colors.success[500];
    if (s >= 70) return colors.warning[500];
    return colors.error[500];
  };

  const getHealthLabel = (s: number): string => {
    if (s >= 90) return '健康';
    if (s >= 70) return '一般';
    return '不佳';
  };

  return (
    <Card
      title={
        <Space>
          <QuestionCircleOutlined style={{ color: colors.primary[500] }} />
          <span>系统健康度</span>
        </Space>
      }
      style={{ borderRadius: componentRadius.card, boxShadow: shadows.card, height: '100%' }}
      bodyStyle={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: spacing.lg }}
    >
      {loading ? (
        <Spin />
      ) : (
        <div style={{ textAlign: 'center' }}>
          <Progress
            type="circle"
            percent={score}
            strokeColor={getHealthColor(score)}
            format={(pct) => (
              <div>
                <div style={{ fontSize: 28, fontWeight: 600, color: getHealthColor(score) }}>{pct}</div>
                <div style={{ fontSize: 12, color: colors.neutral[500] }}>分</div>
              </div>
            )}
            width={160}
            strokeWidth={8}
          />
          <div style={{ marginTop: spacing.sm }}>
            <Text
              style={{
                fontSize: 16,
                fontWeight: 500,
                color: getHealthColor(score),
              }}
            >
              {getHealthLabel(score)}
            </Text>
          </div>
        </div>
      )}
    </Card>
  );
};

/**
 * 详情面板 - 展示评估指标补充信息
 */
const MetricDetails: React.FC<{ data: EvalMetric; loading?: boolean }> = ({ data, loading }) => {
  if (loading) {
    return (
      <Card
        title="评估详情"
        style={{ borderRadius: componentRadius.card, boxShadow: shadows.card }}
      >
        <div style={{ textAlign: 'center', padding: spacing.lg }}>
          <Spin />
        </div>
      </Card>
    );
  }
  return (
    <Card
      title={
        <Space>
          <BarChartOutlined style={{ color: colors.primary[500] }} />
          <span>评估详情</span>
        </Space>
      }
      style={{ borderRadius: componentRadius.card, boxShadow: shadows.card }}
      bodyStyle={{ padding: spacing.lg }}
    >
      <Descriptions column={{ xs: 1, sm: 2, md: 3 }} size="small" colon={false}>
        <Descriptions.Item
          label={
            <Text type="secondary" style={{ fontSize: 13 }}>
              总查询数
            </Text>
          }
        >
          <Text strong>{data.total_queries.toLocaleString()}</Text>
        </Descriptions.Item>
        <Descriptions.Item
          label={
            <Text type="secondary" style={{ fontSize: 13 }}>
              平均置信度
            </Text>
          }
        >
          <Text strong>{`${(data.avg_confidence * 100).toFixed(1)}%`}</Text>
        </Descriptions.Item>
        <Descriptions.Item
          label={
            <Text type="secondary" style={{ fontSize: 13 }}>
              平均延迟
            </Text>
          }
        >
          <Text strong>{`${data.avg_latency_ms.toFixed(0)} ms`}</Text>
        </Descriptions.Item>
        <Descriptions.Item
          label={
            <Text type="secondary" style={{ fontSize: 13 }}>
              反馈率
            </Text>
          }
        >
          <Text strong>{`${(data.feedback_rate * 100).toFixed(1)}%`}</Text>
        </Descriptions.Item>
        <Descriptions.Item
          label={
            <Text type="secondary" style={{ fontSize: 13 }}>
              准确率
            </Text>
          }
        >
          <Text strong>{`${(data.accuracy_rate * 100).toFixed(1)}%`}</Text>
        </Descriptions.Item>
        <Descriptions.Item
          label={
            <Text type="secondary" style={{ fontSize: 13 }}>
              健康度
            </Text>
          }
        >
          <Text strong>{data.health_score != null ? `${data.health_score} 分` : '-'}</Text>
        </Descriptions.Item>
        {data.period && (
          <>
            <Descriptions.Item
              label={
                <Text type="secondary" style={{ fontSize: 13 }}>
                  评估起始
                </Text>
              }
            >
              <Text strong>{data.period.start}</Text>
            </Descriptions.Item>
            <Descriptions.Item
              label={
                <Text type="secondary" style={{ fontSize: 13 }}>
                  评估截止
                </Text>
              }
            >
              <Text strong>{data.period.end}</Text>
            </Descriptions.Item>
          </>
        )}
      </Descriptions>
    </Card>
  );
};

// ============================================================================
// Main Component
// ============================================================================

const RAGEvalPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<EvalMetric | null>(null);

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getRAGEvalMetrics();
      const metrics = res.data as EvalMetric;
      setData(metrics);
    } catch (err: unknown) {
      const msg = (err as Error).message || '获取评估指标失败';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  // ---- 健康度 ----
  const healthScore = data?.health_score ?? 0;

  // ---- 渲染 ----
  return (
    <div>
      {/* 页面标题 */}
      <div style={{ marginBottom: spacing.lg }}>
        <Title level={2} style={{ marginBottom: spacing.sm }}>
          <BarChartOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
          评估指标
        </Title>
        <Text type="secondary">RAG 系统评估数据</Text>
      </div>

      {/* 错误状态 */}
      {error && !loading && (
        <Alert
          type="error"
          message="无法加载评估指标"
          description={error}
          showIcon
          style={{ marginBottom: spacing.md, borderRadius: componentRadius.card }}
          action={
            <Button size="small" onClick={fetchMetrics}>
              重试
            </Button>
          }
        />
      )}

      {/* 加载中状态 */}
      {loading && !data && !error && (
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <Spin size="large" />
          <div style={{ marginTop: spacing.md }}>
            <Text type="secondary">正在加载评估数据...</Text>
          </div>
        </div>
      )}

      {/* 空状态 */}
      {!loading && !error && !data && (
        <Card style={{ borderRadius: componentRadius.card, boxShadow: shadows.card }}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="暂无评估数据"
          >
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              onClick={fetchMetrics}
              style={{ borderRadius: componentRadius.button.md, height: 36 }}
            >
              刷新
            </Button>
          </Empty>
        </Card>
      )}

      {/* 数据展示 */}
      {data && (
        <>
          {/* 指标卡片行 */}
          <Row gutter={[spacing.md, spacing.md]} style={{ marginBottom: spacing.md }}>
            {METRIC_CARDS.map((card) => {
              const rawValue = data[card.key] as number;
              return (
                <Col xs={24} sm={12} lg={4} key={card.key}>
                  <MetricCard
                    label={card.label}
                    value={card.format(rawValue)}
                    icon={card.icon}
                    color={card.color}
                    loading={loading}
                  />
                </Col>
              );
            })}
          </Row>

          {/* 第二行：健康度环形图 + 详情 */}
          <Row gutter={[spacing.md, spacing.md]}>
            <Col xs={24} md={8}>
              <HealthRing score={healthScore} loading={loading} />
            </Col>
            <Col xs={24} md={16}>
              <MetricDetails data={data} loading={loading} />
            </Col>
          </Row>

          {/* 分隔线 + 刷新按钮 */}
          <Divider style={{ margin: `${spacing.lg}px 0` }} />
          <div style={{ textAlign: 'center' }}>
            <Button
              icon={<ReloadOutlined />}
              onClick={fetchMetrics}
              loading={loading}
              style={{ borderRadius: componentRadius.button.md, height: 36 }}
            >
              刷新数据
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

export default RAGEvalPage;