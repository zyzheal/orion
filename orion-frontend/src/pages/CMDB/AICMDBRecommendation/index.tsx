/**
 * AI CMDB Smart Recommendation Page (P3-06)
 * 智能推荐：自动关联分析、拓扑建议、异常检测
 * 对接后端 AI 推荐引擎：GET /api/v1/cmdb/recommendations
 */
import React, { useState, useMemo, useEffect } from 'react';
import {
  Typography,
  Card,
  Table,
  Tag,
  Space,
  Button,
  Select,
  Statistic,
  Row,
  Col,
  message,
  Popconfirm,
  List,
  Descriptions,
  Spin,
  Empty,
} from 'antd';
import {
  CloudServerOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
  RocketOutlined,
  ReloadOutlined,
  EyeOutlined,
  CloseOutlined,
  CheckOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import { StatCard } from '@/components/charts';
import {
  getRecommendations,
  actionRecommendation,
  type RecommendationType,
  type RecommendationStatus,
  type RecommendationItem,
  type AnomalyDetected,
} from '@/api/cmdb';

const { Title, Text } = Typography;
const { Option } = Select;

interface ModelStatus {
  version: string;
  trainingDataCount: number;
  accuracy: number;
  lastTrainedAt: string;
  accuracyTrend: number[];
}

const DEFAULT_MODEL_STATUS: ModelStatus = {
  version: '1.0.0',
  trainingDataCount: 0,
  accuracy: 0,
  lastTrainedAt: '-',
  accuracyTrend: [],
};

// ============ Color Helpers ============

const getConfidenceColor = (value: number): string => {
  if (value >= 90) return colors.success[500];
  if (value >= 70) return colors.primary[500];
  if (value >= 50) return colors.warning[500];
  return colors.error[500];
};

const getConfidenceLabel = (value: number): 'success' | 'processing' | 'warning' | 'error' => {
  if (value >= 90) return 'success';
  if (value >= 70) return 'processing';
  if (value >= 50) return 'warning';
  return 'error';
};

const typeConfig: Record<RecommendationType, { label: string; color: string }> = {
  'auto-link': { label: '自动关联', color: colors.purple[500] },
  'attribute-fill': { label: '属性补全', color: colors.info[500] },
  'anomaly-detect': { label: '异常检测', color: colors.warning[500] },
  'topology-fix': { label: '拓扑修正', color: colors.success[500] },
};

const statusConfig: Record<RecommendationStatus, { label: string; color: string }> = {
  pending: { label: '待确认', color: colors.neutral[500] },
  accepted: { label: '已采纳', color: colors.success[500] },
  rejected: { label: '已拒绝', color: colors.error[500] },
};

const severityConfig: Record<string, { label: string; color: string }> = {
  critical: { label: '严重', color: colors.error[500] },
  high: { label: '高', color: colors.error[600] },
  medium: { label: '中', color: colors.warning[500] },
  low: { label: '低', color: colors.info[500] },
};

// ============ Accuracy Trend SVG ============

const AccuracyTrendSVG: React.FC<{ data: number[] }> = ({ data }) => {
  if (data.length === 0) return null;
  const width = 280;
  const height = 80;
  const padding = { top: 12, right: 12, bottom: 18, left: 12 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const minVal = Math.min(...data) - 1;
  const maxVal = Math.max(...data) + 1;
  const range = maxVal - minVal || 1;

  const points = data.map((val, idx) => {
    const x = padding.left + (idx / (data.length - 1)) * innerW;
    const y = padding.top + innerH - ((val - minVal) / range) * innerH;
    return `${x},${y}`;
  });

  const areaPoints = [
    `${padding.left},${padding.top + innerH}`,
    ...points,
    `${padding.left + innerW},${padding.top + innerH}`,
  ];

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id="accuracyGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={colors.purple[500]} stopOpacity="0.3" />
          <stop offset="100%" stopColor={colors.purple[500]} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints.join(' ')} fill="url(#accuracyGradient)" />
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke={colors.purple[500]}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {data.map((val, idx) => {
        const x = padding.left + (idx / (data.length - 1)) * innerW;
        const y = padding.top + innerH - ((val - minVal) / range) * innerH;
        return <circle key={idx} cx={x} cy={y} r="3" fill={colors.purple[500]} />;
      })}
      <text x={padding.left} y={height - 2} fontSize="9" fill={colors.neutral[500]}>
        7天前
      </text>
      <text x={width - padding.right - 24} y={height - 2} fontSize="9" fill={colors.neutral[500]}>
        今天
      </text>
    </svg>
  );
};

// ============ Main Component ============

const AICMDBRecommendation: React.FC = () => {
  const [recommendType, setRecommendType] = useState<RecommendationType | 'all'>('all');
  const [recommendStatus, setRecommendStatus] = useState<RecommendationStatus | 'all'>('all');
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);
  const [anomalies, setAnomalies] = useState<AnomalyDetected[]>([]);
  const [modelStatus, setModelStatus] = useState<ModelStatus>(DEFAULT_MODEL_STATUS);
  const [retraining, setRetraining] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchRecommendations = async (type?: RecommendationType) => {
    setLoading(true);
    try {
      const params: { type?: RecommendationType; limit?: number } = { limit: 50 };
      if (type) params.type = type;
      const res = await getRecommendations(params);
      const data = res?.data;
      if (data) {
        setRecommendations(data.recommendations || []);
        setAnomalies(data.anomalies || []);
        if (data.recommendations && data.recommendations.length > 0) {
          const avgConf =
            data.recommendations.reduce((s, r) => s + r.confidence, 0) / data.recommendations.length;
          setModelStatus((prev) => ({
            ...prev,
            trainingDataCount: data.total,
            accuracy: Math.round(avgConf * 10) / 10,
          }));
        }
      }
    } catch (err) {
      console.error('Failed to fetch recommendations:', err);
      message.error('获取智能推荐失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations(recommendType === 'all' ? undefined : recommendType);
  }, [recommendType]);

  const filteredRecommendations = useMemo(() => {
    return recommendations.filter((item) => {
      const typeMatch = recommendType === 'all' || item.type === recommendType;
      const statusMatch = recommendStatus === 'all' || item.status === recommendStatus;
      return typeMatch && statusMatch;
    });
  }, [recommendations, recommendType, recommendStatus]);

  const handleAccept = async (id: string) => {
    try {
      await actionRecommendation(id, 'accept');
      setRecommendations((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: 'accepted' } : item))
      );
      message.success('已采纳该推荐');
    } catch {
      message.error('采纳推荐失败');
    }
  };

  const handleReject = async (id: string) => {
    try {
      await actionRecommendation(id, 'reject');
      setRecommendations((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: 'rejected' } : item))
      );
      message.info('已拒绝该推荐');
    } catch {
      message.error('拒绝推荐失败');
    }
  };

  const handleRetrain = () => {
    setRetraining(true);
    message.loading({ content: '模型重新训练中...', key: 'retrain', duration: 0 });
    setTimeout(() => {
      setRetraining(false);
      message.success({ content: '模型重新训练完成', key: 'retrain' });
      fetchRecommendations();
    }, 3000);
  };

  const totalRecs = recommendations.length;
  const pendingCount = recommendations.filter((r) => r.status === 'pending').length;
  const anomalyCount = anomalies.length;
  const avgAccuracy =
    recommendations.length > 0
      ? Math.round(recommendations.reduce((s, r) => s + r.confidence, 0) / recommendations.length * 10) / 10
      : 0;

  const columns: Array<{
    title: string;
    dataIndex: string;
    key: string;
    render?: (value: unknown, record: RecommendationItem) => React.ReactNode;
    width?: number;
  }> = [
    {
      title: '推荐类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (value) => {
        const cfg = typeConfig[value as RecommendationType];
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: '源 CI',
      dataIndex: 'sourceCI',
      key: 'sourceCI',
      width: 150,
      render: (_value, record) => (
        <Text style={{ fontSize: 12 }}>{record.sourceCiName || record.sourceCi}</Text>
      ),
    },
    {
      title: '目标 / 建议',
      dataIndex: 'targetCI',
      key: 'targetCI',
      render: (_value, record) => (
        <Space direction="vertical" size={2}>
          <Text type="secondary" style={{ fontSize: 12 }}>{String((record as unknown as { targetCIName?: string; targetCI?: string }).targetCIName || (record as unknown as { targetCIName?: string; targetCI?: string }).targetCI)}</Text>
          <Text style={{ fontSize: 12 }}>{record.suggestion}</Text>
        </Space>
      ),
    },
    {
      title: '置信度',
      dataIndex: 'confidence',
      key: 'confidence',
      width: 100,
      render: (value) => {
        const conf = Number(value);
        return (
          <Tag color={getConfidenceLabel(conf)} style={{ color: getConfidenceColor(conf) }}>
            {conf.toFixed(0)}%
          </Tag>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (value) => {
        const cfg = statusConfig[value as RecommendationStatus];
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: '推荐时间',
      dataIndex: 'recommendTime',
      key: 'recommendTime',
      width: 160,
      render: (value) => <Text style={{ fontSize: 12 }}>{String(value) || '-'}</Text>,
    },
    {
      title: '操作',
      key: 'action',
      dataIndex: 'action',
      width: 120,
      render: (_value, record) => {
        if (record.status !== 'pending') return <Text type="secondary">-</Text>;
        return (
          <Space>
            <Button type="primary" size="small" icon={<CheckOutlined />} onClick={() => handleAccept(record.id)}>
              采纳
            </Button>
            <Popconfirm
              title="确认拒绝该推荐？"
              description="拒绝后该推荐将从待确认列表中移除"
              onConfirm={() => handleReject(record.id)}
              okText="拒绝"
              okButtonProps={{ danger: true }}
              cancelText="取消"
            >
              <Button size="small" danger icon={<CloseOutlined />}>拒绝</Button>
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  const tablePageSize = 5;

  return (
    <Spin spinning={loading}>
      <div style={{ padding: spacing.lg }}>
        <Title level={2} style={{ marginBottom: 8, color: colors.neutral[900], fontWeight: 600 }}>
          <RocketOutlined style={{ marginRight: 12, color: colors.purple[500] }} />
          AI CMDB 智能推荐
        </Title>
        <Text type="secondary" style={{ marginBottom: spacing.md, display: 'block' }}>
          智能关联分析 · 自动拓扑建议 · 异常检测
        </Text>

        <Row gutter={[spacing.md, spacing.md]} style={{ marginBottom: spacing.md }}>
          <Col span={6}>
            <StatCard title="智能推荐数" value={totalRecs} icon={<RocketOutlined />} color={colors.purple[500]} />
          </Col>
          <Col span={6}>
            <StatCard title="待确认" value={pendingCount} icon={<CloudServerOutlined />} color={colors.info[500]} />
          </Col>
          <Col span={6}>
            <StatCard title="异常检测结果" value={anomalyCount} icon={<ThunderboltOutlined />} color={colors.warning[500]} />
          </Col>
          <Col span={6}>
            <StatCard title="推荐准确率" value={avgAccuracy} suffix="%" icon={<CheckCircleOutlined />} color={colors.success[500]} />
          </Col>
        </Row>

        <Row gutter={[spacing.md, spacing.md]} style={{ marginBottom: spacing.md }}>
          <Col span={14}>
            <Card
              title="智能推荐列表"
              extra={
                <Button icon={<ReloadOutlined />} size="small" onClick={() => fetchRecommendations()}>
                  刷新
                </Button>
              }
              style={{ height: '100%' }}
            >
              <Space style={{ marginBottom: spacing.md }} size={spacing.sm}>
                <Select style={{ width: 140 }} value={recommendType} onChange={setRecommendType} allowClear>
                  <Option value="all">全部类型</Option>
                  <Option value="auto-link">自动关联</Option>
                  <Option value="attribute-fill">属性补全</Option>
                  <Option value="anomaly-detect">异常检测</Option>
                  <Option value="topology-fix">拓扑修正</Option>
                </Select>
                <Select style={{ width: 140 }} value={recommendStatus} onChange={setRecommendStatus} allowClear>
                  <Option value="all">全部状态</Option>
                  <Option value="pending">待确认</Option>
                  <Option value="accepted">已采纳</Option>
                  <Option value="rejected">已拒绝</Option>
                </Select>
              </Space>
              {filteredRecommendations.length === 0 ? (
                <Empty description="暂无智能推荐，请确保 CMDB 中已有 CI 数据" />
              ) : (
                <Table
                  columns={columns}
                  dataSource={filteredRecommendations}
                  rowKey="id"
                  pagination={{ pageSize: tablePageSize, size: 'small', showSizeChanger: false }}
                  size="small"
                  rowHoverable
                />
              )}
            </Card>
          </Col>

          <Col span={10}>
            <Card title="AI 模型状态" style={{ height: '100%' }}>
              <Descriptions column={1} size="small" style={{ marginBottom: spacing.md }}>
                <Descriptions.Item label="模型版本">
                  <Tag color={colors.purple[500]}>v{modelStatus.version}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="训练数据量">
                  <Statistic
                    value={modelStatus.trainingDataCount}
                    precision={0}
                    formatter={() => modelStatus.trainingDataCount.toLocaleString()}
                    suffix=" 条"
                    valueStyle={{ fontSize: 18 }}
                  />
                </Descriptions.Item>
                <Descriptions.Item label="最后训练时间">
                  <Text type="secondary">{modelStatus.lastTrainedAt}</Text>
                </Descriptions.Item>
              </Descriptions>
              <div style={{ marginBottom: spacing.md }}>
                <Text strong style={{ marginBottom: 4, display: 'block' }}>准确率趋势（近 7 天）</Text>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <AccuracyTrendSVG data={modelStatus.accuracyTrend} />
                </div>
              </div>
              <Button
                type="primary"
                icon={<RocketOutlined />}
                onClick={handleRetrain}
                loading={retraining}
                style={{ width: '100%', backgroundColor: colors.purple[500], borderColor: colors.purple[500] }}
                disabled={retraining}
              >
                重新训练模型
              </Button>
            </Card>
          </Col>
        </Row>

        <Card title="异常检测">
          {anomalies.length === 0 ? (
            <Empty description="暂无异常检测结果" />
          ) : (
            <List
              itemLayout="horizontal"
              dataSource={anomalies.slice(0, 10)}
              renderItem={(item) => (
                <List.Item
                  actions={[
                    <Button
                      type="link"
                      size="small"
                      icon={<EyeOutlined />}
                      onClick={() => message.info(`查看异常详情: ${item.ciName}`)}
                    >
                      详情
                    </Button>,
                  ]}
                  style={{ borderBottom: `1px solid ${colors.neutral[100]}` }}
                >
                  <List.Item.Meta
                    title={
                      <Space>
                        <Text strong>{item.ciName}</Text>
                        <Tag color={severityConfig[item.severity]?.color || colors.neutral[500]}>
                          {severityConfig[item.severity]?.label || item.severity}
                        </Tag>
                      </Space>
                    }
                    description={
                      <Space>
                        <Text type="secondary">{item.anomalyType}</Text>
                        <Text type="secondary">|</Text>
                        <Text type="secondary">{item.detail}</Text>
                      </Space>
                    }
                  />
                  <Text type="secondary" style={{ fontSize: 12 }}>{item.detectedTime}</Text>
                </List.Item>
              )}
            />
          )}
        </Card>
      </div>
    </Spin>
  );
};

export default AICMDBRecommendation;
