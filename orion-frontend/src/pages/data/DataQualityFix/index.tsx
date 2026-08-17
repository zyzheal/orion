/**
 * P3-16 Data Quality Auto-Fix Page
 * Detection rules, auto-fix suggestions, data lineage tracking
 * Pure frontend with Mock data.
 */
import React, { useMemo, useState } from 'react';
import {
  Typography, Card, Row, Col, Table, Statistic, Tag,
  Button, Progress, Space, Select, Popconfirm, message,
} from 'antd';
import {
  DatabaseOutlined, EyeOutlined, PlayCircleOutlined,
  CloseCircleOutlined, CheckCircleOutlined, WarningOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';

const { Title, Text } = Typography;
const { Option } = Select;

// ============================================================================
// Types
// ============================================================================

type ProblemType = 'null' | 'duplicate' | 'format' | 'out_of_range' | 'inconsistent';
type Severity = 'critical' | 'high' | 'medium' | 'low';
type Status = 'pending' | 'processing' | 'fixed' | 'ignored';

interface QualityIssue {
  id: string;
  tableField: string;
  problemType: ProblemType;
  severity: Severity;
  affectedRows: number;
  discoveredAt: string;
  status: Status;
}

interface RepairHistory {
  id: string;
  time: string;
  issue: string;
  operator: string;
  result: 'success' | 'failed';
}

interface DimensionScore {
  name: string;
  score: number;
}

// ============================================================================
// Mock Data
// ============================================================================

const MOCK_ISSUES: QualityIssue[] = [];

const MOCK_DIMENSIONS: DimensionScore[] = [];

const MOCK_TREND: number[] = [];
const TREND_LABELS: string[] = [];

const MOCK_REPAIR_HISTORY: RepairHistory[] = [];

// ============================================================================
// Constants
// ============================================================================

const PROBLEM_TYPE_CONFIG: Record<ProblemType, { label: string; color: string }> = {
  null: { label: '空值', color: 'orange' },
  duplicate: { label: '重复', color: 'purple' },
  format: { label: '格式错误', color: 'red' },
  out_of_range: { label: '越界', color: 'blue' },
  inconsistent: { label: '不一致', color: 'gold' },
};

const SEVERITY_CONFIG: Record<Severity, { label: string; color: string }> = {
  critical: { label: '严重', color: 'red' },
  high: { label: '高', color: 'orange' },
  medium: { label: '中', color: 'blue' },
  low: { label: '低', color: 'green' },
};

const STATUS_CONFIG: Record<Status, { label: string; color: string }> = {
  pending: { label: '待处理', color: 'default' },
  processing: { label: '处理中', color: 'processing' },
  fixed: { label: '已修复', color: 'success' },
  ignored: { label: '忽略', color: 'default' },
};

// ============================================================================
// Helpers
// ============================================================================

function getOverallScore(): number {
  if (MOCK_DIMENSIONS.length === 0) return 0;
  const total = MOCK_DIMENSIONS.reduce((s, d) => s + d.score, 0);
  return Math.round(total / MOCK_DIMENSIONS.length);
}

function getScoreColor(score: number): string {
  if (score >= 90) return colors.success[500];
  if (score >= 70) return colors.info[500];
  if (score >= 50) return colors.warning[500];
  return colors.error[500];
}

// ============================================================================
// Quality Trend SVG
// ============================================================================

const QualityTrendChart: React.FC = () => {
  if (MOCK_TREND.length === 0) return null;
  const width = 300;
  const height = 80;
  const padding = 10;
  const min = Math.min(...MOCK_TREND) - 5;
  const max = Math.max(...MOCK_TREND) + 5;
  const scaleX = (i: number) => padding + (width - 2 * padding) * (i / (MOCK_TREND.length - 1));
  const scaleY = (v: number) => height - padding - (height - 2 * padding) * ((v - min) / (max - min));

  const pathD = MOCK_TREND
    .map((v, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(i)} ${scaleY(v)}`)
    .join(' ');

  const areaD = `M ${scaleX(0)} ${scaleY(MOCK_TREND[0])} `
    + MOCK_TREND.map((v, i) => `L ${scaleX(i)} ${scaleY(v)}`).join(' ')
    + ` L ${scaleX(MOCK_TREND.length - 1)} ${height - padding} L ${scaleX(0)} ${height - padding} Z`;

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
      <defs>
        <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={colors.primary[400]} stopOpacity={0.3} />
          <stop offset="100%" stopColor={colors.primary[400]} stopOpacity={0.02} />
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#trendGradient)" />
      <path d={pathD} fill="none" stroke={colors.primary[500]} strokeWidth={2} />
      {MOCK_TREND.map((v, i) => (
        <circle key={String(i)} cx={scaleX(i)} cy={scaleY(v)} r={3} fill={colors.primary[500]} />
      ))}
      {TREND_LABELS.map((label, i) => (
        <text
          key={String(i)}
          x={scaleX(i)}
          y={height - 1}
          fontSize={8}
          fill={colors.neutral[500]}
          textAnchor="middle"
        >
          {label}
        </text>
      ))}
    </svg>
  );
};

// ============================================================================
// Page Component
// ============================================================================

const DataQualityFixPage: React.FC = () => {
  const [filterType, setFilterType] = useState<ProblemType | undefined>();
  const [filterSeverity, setFilterSeverity] = useState<Severity | undefined>();
  const [filterStatus, setFilterStatus] = useState<Status | undefined>();

  const overallScore = useMemo(getOverallScore, []);

  const filteredIssues = useMemo(() => {
    return MOCK_ISSUES.filter((issue) => {
      if (filterType && issue.problemType !== filterType) return false;
      if (filterSeverity && issue.severity !== filterSeverity) return false;
      if (filterStatus && issue.status !== filterStatus) return false;
      return true;
    });
  }, [filterType, filterSeverity, filterStatus]);

  const ruleCount = 42;
  const problemCount = MOCK_ISSUES.length;
  const fixedCount = MOCK_ISSUES.filter((i) => i.status === 'fixed').length;
  const pendingCount = MOCK_ISSUES.filter((i) => i.status === 'pending').length;

  const columns = [
    {
      title: '问题 ID',
      dataIndex: 'id',
      key: 'id',
      width: 90,
      render: (val: string) => <Text strong>{val}</Text>,
    },
    {
      title: '数据表/字段',
      dataIndex: 'tableField',
      key: 'tableField',
      width: 160,
      render: (val: string) => <code>{val}</code>,
    },
    {
      title: '问题类型',
      dataIndex: 'problemType',
      key: 'problemType',
      width: 90,
      render: (val: ProblemType) => (
        <Tag color={PROBLEM_TYPE_CONFIG[val].color}>{PROBLEM_TYPE_CONFIG[val].label}</Tag>
      ),
    },
    {
      title: '严重程度',
      dataIndex: 'severity',
      key: 'severity',
      width: 90,
      render: (val: Severity) => (
        <Tag color={SEVERITY_CONFIG[val].color}>{SEVERITY_CONFIG[val].label}</Tag>
      ),
    },
    {
      title: '影响行数',
      dataIndex: 'affectedRows',
      key: 'affectedRows',
      width: 90,
      render: (val: number) => <Text>{val.toLocaleString()}</Text>,
    },
    {
      title: '发现时间',
      dataIndex: 'discoveredAt',
      key: 'discoveredAt',
      width: 150,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (val: Status) => (
        <Tag color={STATUS_CONFIG[val].color}>{STATUS_CONFIG[val].label}</Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: unknown, record: QualityIssue) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => message.info(`查看 ${record.id} 修复建议`)}
          >
            查看建议
          </Button>
          <Popconfirm
            title="确认执行修复？"
            description={`将自动修复 ${record.tableField} 的 ${PROBLEM_TYPE_CONFIG[record.problemType].label} 问题，影响 ${record.affectedRows} 行。`}
            onConfirm={() => {
              message.success(`${record.id} 修复已执行`);
            }}
            okText="确认"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button type="link" size="small" danger icon={<PlayCircleOutlined />}>
              执行修复
            </Button>
          </Popconfirm>
          <Button
            type="link"
            size="small"
            icon={<CloseCircleOutlined />}
            onClick={() => message.info(`${record.id} 已忽略`)}
          >
            忽略
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Title level={2} style={{ marginBottom: 8 }}>
        <DatabaseOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        数据质量自动修复
      </Title>
      <Text type="secondary">质量检测 · 自动修复建议 · 数据血缘追踪</Text>

      {/* Top Stats Cards */}
      <Row gutter={[spacing.md, spacing.md]} style={{ marginTop: spacing.lg }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="检测规则数"
              value={ruleCount}
              suffix="条"
              valueStyle={{ color: colors.primary[500] }}
              prefix={<DatabaseOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="发现问题数"
              value={problemCount}
              suffix="个"
              valueStyle={{ color: colors.error[500] }}
              prefix={<WarningOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已修复数"
              value={fixedCount}
              suffix="个"
              valueStyle={{ color: colors.success[500] }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="待处理数"
              value={pendingCount}
              suffix="个"
              valueStyle={{ color: colors.warning[500] }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Main Content: Table + Scoring */}
      <Row gutter={[spacing.md, spacing.md]} style={{ marginTop: spacing.md }}>
        <Col span={14}>
          <Card title="质量问题列表" style={{ marginTop: spacing.md }}>
            <Space style={{ marginBottom: spacing.md }} size="middle">
              <Select
                placeholder="问题类型"
                style={{ width: 130 }}
                allowClear
                value={filterType}
                onChange={(v) => setFilterType(v)}
              >
                {Object.entries(PROBLEM_TYPE_CONFIG).map(([key, cfg]) => (
                  <Option key={key} value={key}>{cfg.label}</Option>
                ))}
              </Select>
              <Select
                placeholder="严重程度"
                style={{ width: 130 }}
                allowClear
                value={filterSeverity}
                onChange={(v) => setFilterSeverity(v)}
              >
                {Object.entries(SEVERITY_CONFIG).map(([key, cfg]) => (
                  <Option key={key} value={key}>{cfg.label}</Option>
                ))}
              </Select>
              <Select
                placeholder="状态"
                style={{ width: 130 }}
                allowClear
                value={filterStatus}
                onChange={(v) => setFilterStatus(v)}
              >
                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                  <Option key={key} value={key}>{cfg.label}</Option>
                ))}
              </Select>
            </Space>
            <Table
              columns={columns}
              dataSource={filteredIssues}
              rowKey="id"
              size="middle"
              pagination={{ pageSize: 8, showSizeChanger: false }}
            />
          </Card>
        </Col>

        <Col span={10}>
          <Card title="数据质量评分" style={{ marginTop: spacing.md }}>
            <div style={{ textAlign: 'center', marginBottom: spacing.lg }}>
              <div style={{ fontSize: 56, fontWeight: 700, color: getScoreColor(overallScore) }}>
                {overallScore}
              </div>
              <div style={{ color: colors.neutral[500], marginTop: 4 }}>整体质量得分</div>
            </div>
            <Space direction="vertical" style={{ width: '100%' }} size={spacing.md}>
              {MOCK_DIMENSIONS.map((dim) => (
                <div key={dim.name}>
                  <div style={{ marginBottom: 4 }}>
                    <Text>{dim.name}</Text>
                    <Text style={{ float: 'right', color: getScoreColor(dim.score) }}>{dim.score}</Text>
                  </div>
                  <Progress
                    percent={dim.score}
                    showInfo={false}
                    strokeColor={getScoreColor(dim.score)}
                  />
                </div>
              ))}
            </Space>
          </Card>

          <Card title="质量趋势 (7天)" style={{ marginTop: spacing.md }}>
            <QualityTrendChart />
          </Card>
        </Col>
      </Row>

      {/* Repair History */}
      <Card title="修复历史" style={{ marginTop: spacing.md }}>
        <Table
          dataSource={MOCK_REPAIR_HISTORY}
          rowKey="id"
          size="small"
          pagination={false}
          columns={[
            { title: '时间', dataIndex: 'time', key: 'time', width: 180 },
            { title: '问题', dataIndex: 'issue', key: 'issue' },
            { title: '操作人', dataIndex: 'operator', key: 'operator', width: 100 },
            {
              title: '结果',
              dataIndex: 'result',
              key: 'result',
              width: 100,
              render: (val: string) =>
                val === 'success' ? (
                  <Tag color="success">成功</Tag>
                ) : (
                  <Tag color="error">失败</Tag>
                ),
            },
          ]}
        />
      </Card>
    </div>
  );
};

export default DataQualityFixPage;
