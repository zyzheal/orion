/**
 * AI CMDB Smart Recommendation Page (P3-06)
 * 智能推荐：自动关联分析、拓扑建议、异常检测
 * 纯前端 Mock 数据
 */
import React, { useState, useMemo } from 'react';
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

const { Title, Text } = Typography;
const { Option } = Select;

// ============ Mock Data Types ============

type RecommendationType = 'auto-link' | 'attribute-fill' | 'anomaly-detect' | 'topology-fix';
type RecommendationStatus = 'pending' | 'accepted' | 'rejected';

interface RecommendationItem {
  id: string;
  type: RecommendationType;
  sourceCI: string;
  targetCI: string;
  confidence: number;
  status: RecommendationStatus;
  recommendTime: string;
  suggestion: string;
}

interface AnomalyItem {
  id: string;
  ciName: string;
  anomalyType: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  detectedTime: string;
  detail: string;
}

interface ModelStatus {
  version: string;
  trainingDataCount: number;
  accuracy: number;
  lastTrainedAt: string;
  accuracyTrend: number[]; // 7 days
}

// ============ Mock Data ============

const MOCK_RECOMMENDATIONS: RecommendationItem[] = [
  {
    id: 'REC-001',
    type: 'auto-link',
    sourceCI: 'Web-Server-001',
    targetCI: 'App-DB-Cluster-01',
    confidence: 95,
    status: 'pending',
    recommendTime: '2026-08-08 09:15:00',
    suggestion: '建立网络连接关系',
  },
  {
    id: 'REC-002',
    type: 'attribute-fill',
    sourceCI: 'K8s-Node-042',
    targetCI: '-',
    confidence: 88,
    status: 'pending',
    recommendTime: '2026-08-08 09:10:00',
    suggestion: '补充操作系统版本字段',
  },
  {
    id: 'REC-003',
    type: 'anomaly-detect',
    sourceCI: 'Payment-API-Prod',
    targetCI: '-',
    confidence: 72,
    status: 'pending',
    recommendTime: '2026-08-08 08:45:00',
    suggestion: 'CPU使用率异常，建议标记',
  },
  {
    id: 'REC-004',
    type: 'topology-fix',
    sourceCI: 'Nginx-LB-01',
    targetCI: 'Backend-Pool-A',
    confidence: 91,
    status: 'accepted',
    recommendTime: '2026-08-08 08:30:00',
    suggestion: '修正负载均衡依赖关系',
  },
  {
    id: 'REC-005',
    type: 'auto-link',
    sourceCI: 'Redis-Cluster-02',
    targetCI: 'Cache-Service-01',
    confidence: 65,
    status: 'pending',
    recommendTime: '2026-08-08 08:12:00',
    suggestion: '建立缓存依赖关系',
  },
  {
    id: 'REC-006',
    type: 'attribute-fill',
    sourceCI: 'K8s-Cluster-Prod',
    targetCI: '-',
    confidence: 78,
    status: 'pending',
    recommendTime: '2026-08-07 22:00:00',
    suggestion: '补充K8s版本和地域信息',
  },
  {
    id: 'REC-007',
    type: 'topology-fix',
    sourceCI: 'MQ-Broker-03',
    targetCI: 'Consumer-Group-B',
    confidence: 55,
    status: 'rejected',
    recommendTime: '2026-08-07 21:30:00',
    suggestion: '建议修正消息队列拓扑',
  },
  {
    id: 'REC-008',
    type: 'anomaly-detect',
    sourceCI: 'Storage-Node-08',
    targetCI: '-',
    confidence: 93,
    status: 'accepted',
    recommendTime: '2026-08-07 20:00:00',
    suggestion: '磁盘IO异常升高，需关注',
  },
  {
    id: 'REC-009',
    type: 'auto-link',
    sourceCI: 'Auth-Service-01',
    targetCI: 'LDAP-Server-01',
    confidence: 82,
    status: 'pending',
    recommendTime: '2026-08-07 18:45:00',
    suggestion: '建立认证依赖关系',
  },
  {
    id: 'REC-010',
    type: 'attribute-fill',
    sourceCI: 'DB-MySQL-005',
    targetCI: '-',
    confidence: 45,
    status: 'pending',
    recommendTime: '2026-08-07 17:30:00',
    suggestion: '建议补充数据库版本',
  },
];

const MOCK_ANOMALIES: AnomalyItem[] = [
  {
    id: 'AN-001',
    ciName: 'Payment-API-Prod',
    anomalyType: '性能异常',
    severity: 'critical',
    detectedTime: '2026-08-08 08:45:00',
    detail: 'P99 延迟从 50ms 飙升至 2300ms，持续 12 分钟',
  },
  {
    id: 'AN-002',
    ciName: 'Storage-Node-08',
    anomalyType: '资源异常',
    severity: 'high',
    detectedTime: '2026-08-08 07:20:00',
    detail: '磁盘 IOPS 超出基线 300%，疑似异常 IO 负载',
  },
  {
    id: 'AN-003',
    ciName: 'K8s-Cluster-Prod',
    anomalyType: '拓扑异常',
    severity: 'medium',
    detectedTime: '2026-08-08 06:00:00',
    detail: '3 个 Pod 节点标签与实际归属不一致',
  },
  {
    id: 'AN-004',
    ciName: 'Nginx-LB-01',
    anomalyType: '配置异常',
    severity: 'high',
    detectedTime: '2026-08-07 22:15:00',
    detail: '上游后端池缺少健康检查配置',
  },
  {
    id: 'AN-005',
    ciName: 'Redis-Cluster-02',
    anomalyType: '连接异常',
    severity: 'low',
    detectedTime: '2026-08-07 19:30:00',
    detail: '客户端连接数低于正常范围 40%',
  },
];

const MOCK_MODEL_STATUS: ModelStatus = {
  version: 'v2.3.1',
  trainingDataCount: 128450,
  accuracy: 92.7,
  lastTrainedAt: '2026-08-06 03:00:00',
  accuracyTrend: [89.2, 90.1, 91.0, 90.5, 91.8, 92.2, 92.7],
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
      <text
        x={padding.left}
        y={height - 2}
        fontSize="9"
        fill={colors.neutral[500]}
      >
        7天前
      </text>
      <text
        x={width - padding.right - 24}
        y={height - 2}
        fontSize="9"
        fill={colors.neutral[500]}
      >
        今天
      </text>
    </svg>
  );
};

// ============ Main Component ============

const AICMDBRecommendation: React.FC = () => {
  const [recommendType, setRecommendType] = useState<RecommendationType | 'all'>('all');
  const [recommendStatus, setRecommendStatus] = useState<RecommendationStatus | 'all'>('all');
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>(MOCK_RECOMMENDATIONS);
  const [modelStatus] = useState<ModelStatus>(MOCK_MODEL_STATUS);
  const [retraining, setRetraining] = useState(false);

  const filteredRecommendations = useMemo(() => {
    return recommendations.filter((item) => {
      const typeMatch = recommendType === 'all' || item.type === recommendType;
      const statusMatch = recommendStatus === 'all' || item.status === recommendStatus;
      return typeMatch && statusMatch;
    });
  }, [recommendations, recommendType, recommendStatus]);

  const handleAccept = (id: string) => {
    setRecommendations((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: 'accepted' as RecommendationStatus } : item))
    );
    message.success('已采纳该推荐');
  };

  const handleReject = (id: string) => {
    setRecommendations((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: 'rejected' as RecommendationStatus } : item))
    );
    message.info('已拒绝该推荐');
  };

  const handleRetrain = () => {
    setRetraining(true);
    message.loading({ content: '模型重新训练中...', key: 'retrain', duration: 0 });
    setTimeout(() => {
      setRetraining(false);
      message.success({ content: '模型重新训练完成', key: 'retrain' });
    }, 3000);
  };

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
    },
    {
      title: '目标/建议',
      dataIndex: 'targetCI',
      key: 'targetCI',
      render: (_value, record) => (
        <Space direction="vertical" size={2}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.targetCI}
          </Text>
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
            {conf}%
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
    },
    {
      title: '操作',
      key: 'action',
      dataIndex: 'action',
      width: 120,
      render: (_value, record) => {
        if (record.status !== 'pending') {
          return <Text type="secondary">-</Text>;
        }
        return (
          <Space>
            <Button
              type="primary"
              size="small"
              icon={<CheckOutlined />}
              onClick={() => handleAccept(record.id)}
            >
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
              <Button size="small" danger icon={<CloseOutlined />}>
                拒绝
              </Button>
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  const tablePageSize = 5;

  return (
    <div style={{ padding: spacing.lg }}>
      <Title level={2} style={{ marginBottom: 8, color: colors.neutral[900], fontWeight: 600 }}>
        <RocketOutlined style={{ marginRight: 12, color: colors.purple[500] }} />
        AI CMDB 智能推荐
      </Title>
      <Text type="secondary" style={{ marginBottom: spacing.md, display: 'block' }}>
        智能关联分析 · 自动拓扑建议 · 异常检测
      </Text>

      {/* Top stat cards */}
      <Row gutter={[spacing.md, spacing.md]} style={{ marginBottom: spacing.md }}>
        <Col span={6}>
          <StatCard
            title="智能推荐数"
            value={268}
            icon={<RocketOutlined />}
            color={colors.purple[500]}
            trend={{ value: 12, direction: 'up', good: 'up' }}
          />
        </Col>
        <Col span={6}>
          <StatCard
            title="自动关联 CI 数"
            value={1847}
            icon={<CloudServerOutlined />}
            color={colors.info[500]}
            trend={{ value: 8, direction: 'up', good: 'up' }}
          />
        </Col>
        <Col span={6}>
          <StatCard
            title="异常检测结果"
            value={42}
            icon={<ThunderboltOutlined />}
            color={colors.warning[500]}
            trend={{ value: 3, direction: 'down', good: 'down' }}
          />
        </Col>
        <Col span={6}>
          <StatCard
            title="推荐准确率"
            value={92.7}
            suffix="%"
            icon={<CheckCircleOutlined />}
            color={colors.success[500]}
            trend={{ value: 1.5, direction: 'up', good: 'up' }}
          />
        </Col>
      </Row>

      {/* Middle row: table + model status */}
      <Row gutter={[spacing.md, spacing.md]} style={{ marginBottom: spacing.md }}>
        <Col span={14}>
          <Card
            title="智能推荐列表"
            extra={
              <Button icon={<ReloadOutlined />} size="small">
                刷新
              </Button>
            }
            style={{ height: '100%' }}
          >
            <Space style={{ marginBottom: spacing.md }} size={spacing.sm}>
              <Select
                style={{ width: 140 }}
                value={recommendType}
                onChange={setRecommendType}
                allowClear
              >
                <Option value="all">全部类型</Option>
                <Option value="auto-link">自动关联</Option>
                <Option value="attribute-fill">属性补全</Option>
                <Option value="anomaly-detect">异常检测</Option>
                <Option value="topology-fix">拓扑修正</Option>
              </Select>
              <Select
                style={{ width: 140 }}
                value={recommendStatus}
                onChange={setRecommendStatus}
                allowClear
              >
                <Option value="all">全部状态</Option>
                <Option value="pending">待确认</Option>
                <Option value="accepted">已采纳</Option>
                <Option value="rejected">已拒绝</Option>
              </Select>
            </Space>
            <Table
              columns={columns}
              dataSource={filteredRecommendations}
              rowKey="id"
              pagination={{
                pageSize: tablePageSize,
                size: 'small',
                showSizeChanger: false,
              }}
              size="small"
              rowHoverable
            />
          </Card>
        </Col>

        <Col span={10}>
          <Card title="AI 模型状态" style={{ height: '100%' }}>
            <Descriptions
              column={1}
              size="small"
              style={{ marginBottom: spacing.md }}
            >
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
              <Text strong style={{ marginBottom: 4, display: 'block' }}>
                准确率趋势（近 7 天）
              </Text>
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

      {/* Bottom: Anomaly Detection */}
      <Card title="异常检测">
        <List
          itemLayout="horizontal"
          dataSource={MOCK_ANOMALIES}
          locale={{ emptyText: '暂无异常检测结果' }}
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
                    <Tag color={severityConfig[item.severity].color}>
                      {severityConfig[item.severity].label}
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
              <Text type="secondary" style={{ fontSize: 12 }}>
                {item.detectedTime}
              </Text>
            </List.Item>
          )}
        />
      </Card>
    </div>
  );
};

export default AICMDBRecommendation;
