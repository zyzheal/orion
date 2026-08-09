/**
 * CI/CD Performance Benchmarks Page (P4-11)
 * Pipeline performance metrics, build duration analysis, resource utilization
 * Pure frontend with Mock data.
 */
import React from 'react';
import {
  Typography, Card, Row, Col, Table, Statistic, Tag,
  Button, Progress, Space, message,
} from 'antd';
import {
  DashboardOutlined, ThunderboltOutlined, ClockCircleOutlined,
  CheckCircleOutlined, HourglassOutlined, ArrowUpOutlined,
  ArrowDownOutlined, MinusCircleOutlined, EyeOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';

const { Title, Text } = Typography;

// ============================================================================
// Mock Data Types
// ============================================================================

interface PipelineRecord {
  id: string;
  pipelineName: string;
  buildDuration: number;    // minutes
  p95Duration: number;      // minutes
  queueWait: number;        // minutes
  cpuPeak: number;          // percent
  memoryPeak: number;       // GB
  trend: 'up' | 'down' | 'stable';
}

interface CompareMetric {
  metric: string;
  thisWeek: number;
  lastWeek: number;
  unit: string;
}

interface Bottleneck {
  id: string;
  stage: string;
  duration: number;
  percent: number;
}

// ============================================================================
// Mock Data
// ============================================================================

const MOCK_PIPELINES: PipelineRecord[] = [
  { id: '1', pipelineName: 'frontend-build', buildDuration: 4.2, p95Duration: 6.8, queueWait: 1.2, cpuPeak: 72, memoryPeak: 3.1, trend: 'down' },
  { id: '2', pipelineName: 'backend-api-deploy', buildDuration: 8.5, p95Duration: 12.3, queueWait: 2.8, cpuPeak: 88, memoryPeak: 4.7, trend: 'up' },
  { id: '3', pipelineName: 'integration-tests', buildDuration: 12.1, p95Duration: 18.5, queueWait: 3.5, cpuPeak: 95, memoryPeak: 6.2, trend: 'up' },
  { id: '4', pipelineName: 'security-scan', buildDuration: 3.8, p95Duration: 5.1, queueWait: 0.8, cpuPeak: 45, memoryPeak: 2.0, trend: 'stable' },
  { id: '5', pipelineName: 'docker-image-build', buildDuration: 15.6, p95Duration: 22.4, queueWait: 4.2, cpuPeak: 92, memoryPeak: 8.5, trend: 'up' },
  { id: '6', pipelineName: 'data-pipeline-etl', buildDuration: 22.3, p95Duration: 31.7, queueWait: 5.1, cpuPeak: 78, memoryPeak: 12.0, trend: 'stable' },
  { id: '7', pipelineName: 'microservice-deploy', buildDuration: 6.7, p95Duration: 9.2, queueWait: 1.9, cpuPeak: 65, memoryPeak: 3.8, trend: 'down' },
  { id: '8', pipelineName: 'docs-publish', buildDuration: 2.1, p95Duration: 3.5, queueWait: 0.3, cpuPeak: 30, memoryPeak: 1.2, trend: 'stable' },
  { id: '9', pipelineName: 'api-gateway-update', buildDuration: 5.4, p95Duration: 7.8, queueWait: 1.5, cpuPeak: 55, memoryPeak: 2.8, trend: 'down' },
  { id: '10', pipelineName: 'ml-model-training', buildDuration: 45.2, p95Duration: 68.9, queueWait: 8.7, cpuPeak: 98, memoryPeak: 24.0, trend: 'up' },
];

const MOCK_COMPARE: CompareMetric[] = [
  { metric: '平均构建时长', thisWeek: 12.8, lastWeek: 14.5, unit: '分钟' },
  { metric: 'P95 构建时长', thisWeek: 19.2, lastWeek: 21.8, unit: '分钟' },
  { metric: 'CPU 平均使用率', thisWeek: 72.3, lastWeek: 68.1, unit: '%' },
  { metric: '内存峰值', thisWeek: 5.8, lastWeek: 6.2, unit: 'GB' },
  { metric: '队列等待', thisWeek: 2.4, lastWeek: 3.1, unit: '分钟' },
];

const MOCK_BOTTLENECKS: Bottleneck[] = [
  { id: '1', stage: '镜像构建 (Docker Build)', duration: 15.6, percent: 34 },
  { id: '2', stage: '依赖安装 (npm install)', duration: 8.2, percent: 18 },
  { id: '3', stage: '单元测试 (Unit Tests)', duration: 7.5, percent: 16 },
  { id: '4', stage: '代码编译 (TypeScript)', duration: 6.1, percent: 13 },
  { id: '5', stage: '部署 (Deploy)', duration: 9.0, percent: 19 },
];

// ============================================================================
// Helper Components
// ============================================================================

const TrendBadge: React.FC<{ trend: 'up' | 'down' | 'stable' }> = ({ trend }) => {
  if (trend === 'up') {
    return (
      <Tag color={colors.warning[500]}>
        <ArrowUpOutlined /> 变慢
      </Tag>
    );
  }
  if (trend === 'down') {
    return (
      <Tag color={colors.success[500]}>
        <ArrowDownOutlined /> 变快
      </Tag>
    );
  }
  return (
    <Tag color={colors.neutral[500]}>
      <MinusCircleOutlined /> 稳定
    </Tag>
  );
};

// Mini SVG trend sparkline
const MiniTrend: React.FC<{ trend: 'up' | 'down' | 'stable' }> = ({ trend }) => {
  const generatePoints = (trendType: 'up' | 'down' | 'stable'): string => {
    const baseY = 20;
    const points: number[] = [];
    for (let i = 0; i < 7; i++) {
      if (trendType === 'up') {
        points.push(baseY - i * 2 + (Math.sin(i) * 2));
      } else if (trendType === 'down') {
        points.push(baseY + i * 2 - (Math.sin(i) * 2));
      } else {
        points.push(baseY + (Math.sin(i * 1.5) * 3));
      }
    }
    return points.map((y, i) => `${i * 8},${y.toFixed(1)}`).join(' ');
  };

  const strokeColor =
    trend === 'up' ? colors.warning[500] :
    trend === 'down' ? colors.success[500] :
    colors.neutral[500];

  return (
    <svg width="48" height="24" viewBox="0 0 48 24" style={{ display: 'block' }}>
      <polyline
        points={generatePoints(trend)}
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

// ============================================================================
// Stats Cards
// ============================================================================

const StatsCards: React.FC = () => (
  <Row gutter={16} style={{ marginBottom: spacing.lg }}>
    <Col span={6}>
      <Card>
        <Statistic
          title="平均构建时长"
          value={12.8}
          suffix="分钟"
          precision={1}
          valueStyle={{ color: colors.primary[500] }}
          prefix={<ClockCircleOutlined />}
        />
      </Card>
    </Col>
    <Col span={6}>
      <Card>
        <Statistic
          title="P95 构建时长"
          value={19.2}
          suffix="分钟"
          precision={1}
          valueStyle={{ color: colors.warning[500] }}
          prefix={<ThunderboltOutlined />}
        />
      </Card>
    </Col>
    <Col span={6}>
      <Card>
        <Statistic
          title="平均队列等待"
          value={2.4}
          suffix="分钟"
          precision={1}
          valueStyle={{ color: colors.info[500] }}
          prefix={<HourglassOutlined />}
        />
      </Card>
    </Col>
    <Col span={6}>
      <Card>
        <Statistic
          title="构建成功率"
          value={96.3}
          suffix="%"
          precision={1}
          valueStyle={{ color: colors.success[500] }}
          prefix={<CheckCircleOutlined />}
        />
      </Card>
    </Col>
  </Row>
);

// ============================================================================
// Build Performance Table
// ============================================================================

const BuildPerformanceTable: React.FC = () => {
  const handleViewDetail = (pipelineName: string) => {
    message.info(`正在查看 ${pipelineName} 的详细性能数据...`);
  };

  const columns = [
    {
      title: 'Pipeline 名称',
      dataIndex: 'pipelineName',
      key: 'pipelineName',
      render: (v: string) => <Text strong>{v}</Text>,
    },
    {
      title: '最近构建时长',
      dataIndex: 'buildDuration',
      key: 'buildDuration',
      render: (v: number) => `${v.toFixed(1)} min`,
      sorter: (a: PipelineRecord, b: PipelineRecord) => a.buildDuration - b.buildDuration,
    },
    {
      title: 'P95 时长',
      dataIndex: 'p95Duration',
      key: 'p95Duration',
      render: (v: number) => `${v.toFixed(1)} min`,
      sorter: (a: PipelineRecord, b: PipelineRecord) => a.p95Duration - b.p95Duration,
    },
    {
      title: '队列等待',
      dataIndex: 'queueWait',
      key: 'queueWait',
      render: (v: number) => `${v.toFixed(1)} min`,
    },
    {
      title: 'CPU 峰值',
      dataIndex: 'cpuPeak',
      key: 'cpuPeak',
      render: (v: number) => (
        <span style={{ color: v >= 90 ? colors.error[500] : v >= 75 ? colors.warning[500] : colors.neutral[900] }}>
          {v}%
        </span>
      ),
    },
    {
      title: '内存峰值',
      dataIndex: 'memoryPeak',
      key: 'memoryPeak',
      render: (v: number) => `${v.toFixed(1)} GB`,
    },
    {
      title: '趋势',
      dataIndex: 'trend',
      key: 'trend',
      render: (_: string, record: PipelineRecord) => (
        <Space>
          <MiniTrend trend={record.trend} />
          <TrendBadge trend={record.trend} />
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, record: PipelineRecord) => (
        <Button
          size="small"
          type="link"
          icon={<EyeOutlined />}
          onClick={() => handleViewDetail(record.pipelineName)}
        >
          查看详情
        </Button>
      ),
    },
  ];

  return (
    <Card title="构建性能数据" style={{ height: '100%' }}>
      <Table
        columns={columns}
        dataSource={MOCK_PIPELINES}
        rowKey="id"
        pagination={{ pageSize: 8 }}
        size="middle"
      />
    </Card>
  );
};

// ============================================================================
// Performance Comparison Card (This Week vs Last Week)
// ============================================================================

const PerformanceComparison: React.FC = () => (
  <Card title="本周 vs 上周 性能对比" style={{ height: '100%' }}>
    <Space direction="vertical" style={{ width: '100%' }} size={spacing.md}>
      {MOCK_COMPARE.map((item, index) => {
        const diff = item.thisWeek - item.lastWeek;
        const diffPercentNum = (diff / item.lastWeek) * 100;
        const isCPU = item.metric.includes('CPU');

        // Lower is better for duration/memory/queue; higher CPU utilization is considered context-dependent
        const improved = isCPU ? diff > 0 : diff < 0;
        const tagColor = improved ? colors.success[500] : colors.error[500];
        const tagText = `${diffPercentNum > 0 ? '+' : ''}${diffPercentNum.toFixed(1)}%`;
        const tagIcon = diff < 0 ? <ArrowDownOutlined /> : <ArrowUpOutlined />;

        return (
          <Card key={index} size="small" style={{ background: colors.light.bg.secondary }}>
            <Row justify="space-between" align="middle">
              <Col>
                <Text strong>{item.metric}</Text>
              </Col>
              <Col>
                <Space size={spacing.sm}>
                  <Text type="secondary">上周: {item.lastWeek}{item.unit}</Text>
                  <Text strong>本周: {item.thisWeek}{item.unit}</Text>
                  <Tag color={tagColor}>
                    {tagIcon} {tagText}
                  </Tag>
                </Space>
              </Col>
            </Row>
            {/* Simple bar comparison */}
            <div style={{ marginTop: spacing.sm }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: 4 }}>
                <Text style={{ fontSize: 11, width: 40 }} type="secondary">本周</Text>
                <div style={{ flex: 1, height: 6, background: colors.light.border.light, borderRadius: 3 }}>
                  <div
                    style={{
                      width: `${Math.min((item.thisWeek / (item.lastWeek > item.thisWeek ? item.lastWeek : item.thisWeek)) * 100, 100)}%`,
                      height: '100%',
                      background: colors.primary[500],
                      borderRadius: 3,
                    }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                <Text style={{ fontSize: 11, width: 40 }} type="secondary">上周</Text>
                <div style={{ flex: 1, height: 6, background: colors.light.border.light, borderRadius: 3 }}>
                  <div
                    style={{
                      width: `${Math.min((item.lastWeek / (item.lastWeek > item.thisWeek ? item.lastWeek : item.thisWeek)) * 100, 100)}%`,
                      height: '100%',
                      background: colors.neutral[400],
                      borderRadius: 3,
                    }}
                  />
                </div>
              </div>
            </div>
          </Card>
        );
      })}
    </Space>
  </Card>
);

// ============================================================================
// Performance Bottleneck Card
// ============================================================================

const BottleneckCard: React.FC = () => (
  <Card title="性能瓶颈分析 (Top 5)" style={{ marginTop: spacing.md }}>
    <Space direction="vertical" style={{ width: '100%' }} size={spacing.md}>
      {MOCK_BOTTLENECKS.map((item) => (
        <Row key={item.id} align="middle" gutter={spacing.md}>
          <Col span={6}>
            <Text strong>{item.stage}</Text>
          </Col>
          <Col span={12}>
            <Progress
              percent={item.percent}
              strokeColor={
                item.percent >= 30 ? colors.error[500] :
                item.percent >= 20 ? colors.warning[500] :
                colors.primary[500]
              }
              size="small"
              style={{ width: '100%' }}
            />
          </Col>
          <Col span={6} style={{ textAlign: 'right' }}>
            <Space>
              <Text>{item.percent}%</Text>
              <Text type="secondary">{item.duration} min</Text>
            </Space>
          </Col>
        </Row>
      ))}
    </Space>
  </Card>
);

// ============================================================================
// Main Page
// ============================================================================

const PerformanceBenchmarksPage: React.FC = () => {
  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: spacing.lg }}>
        <Title level={2} style={{ marginBottom: spacing.sm }}>
          <DashboardOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
          CI/CD 性能基准
        </Title>
        <Text type="secondary">流水线性能 · 构建时长 · 资源利用率</Text>
      </div>

      {/* Stats Cards */}
      <StatsCards />

      {/* Main Content Row */}
      <Row gutter={16} style={{ marginBottom: spacing.md }}>
        <Col span={14}>
          <BuildPerformanceTable />
        </Col>
        <Col span={10}>
          <PerformanceComparison />
        </Col>
      </Row>

      {/* Bottleneck Analysis */}
      <BottleneckCard />
    </div>
  );
};

export default PerformanceBenchmarksPage;
