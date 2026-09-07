/**
 * ChangeIntelligence column definitions
 * 抽取自 index.tsx (P2-9 Phase 119)
 */
import { Space, Tag, Button, Typography } from 'antd';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { colors, spacing } from '@/tokens';
import type { TableColumn } from '@/components/Table';
import StatusBadge, { type StatusType } from '@/components/StatusBadge';
import type { ChangeIntelligenceReport, AffectedService } from '@/api/change-intelligence';

dayjs.extend(relativeTime);

const { Text } = Typography;

export const riskLevelColor: Record<string, string> = {
  low: 'green',
  medium: 'gold',
  high: 'orange',
  critical: 'red',
};

export const FILTER_DEFS = [
  {
    key: 'riskLevel',
    label: '风险级别',
    options: [
      { label: '全部', value: 'all' },
      { label: 'Low', value: 'low' },
      { label: 'Medium', value: 'medium' },
      { label: 'High', value: 'high' },
      { label: 'Critical', value: 'critical' },
    ],
  },
];

export interface BuildChangeColumnsDeps {
  handleViewDetail: (report: ChangeIntelligenceReport) => void;
}

export const buildChangeColumns = ({
  handleViewDetail,
}: BuildChangeColumnsDeps): TableColumn<ChangeIntelligenceReport>[] => [
  {
    key: 'prId',
    title: 'PR',
    dataIndex: 'prId',
    width: 140,
    sortable: true,
    render: (_value: unknown, record: ChangeIntelligenceReport) => (
      <Space direction="vertical" size={0}>
        <Text strong style={{ color: colors.primary[500] }}>
          PR #{record.prId}
        </Text>
        <Text type="secondary" style={{ fontSize: spacing[3] }}>
          {record.repoId}
        </Text>
      </Space>
    ),
  },
  {
    key: 'commitSha',
    title: 'Commit',
    dataIndex: 'commitSha',
    width: 140,
    render: (value: unknown) => (
      <Text code style={{ fontSize: spacing[3] }}>
        {String(value).slice(0, 7)}
      </Text>
    ),
  },
  {
    key: 'riskScore',
    title: '风险评分',
    dataIndex: 'riskScore',
    width: 120,
    sortable: true,
    render: (value: unknown) => {
      const score = Number(value);
      const color =
        score >= 0.8
          ? colors.error[600]
          : score >= 0.5
            ? colors.warning[500]
            : colors.success[600];
      return (
        <Text strong style={{ color, fontSize: spacing[4] }}>
          {(score * 100).toFixed(0)}%
        </Text>
      );
    },
  },
  {
    key: 'riskLevel',
    title: '风险级别',
    dataIndex: 'riskLevel',
    width: 120,
    render: (value: unknown) => (
      <Tag color={riskLevelColor[String(value)] || 'default'}>
        {String(value).toUpperCase()}
      </Tag>
    ),
  },
  {
    key: 'affectedServices',
    title: '影响服务',
    dataIndex: 'affectedServices',
    width: 100,
    render: (value: unknown) => <Text>{String(value)}</Text>,
  },
  {
    key: 'gitlabCommentPosted',
    title: 'GitLab 评论',
    dataIndex: 'gitlabCommentPosted',
    width: 120,
    render: (value: unknown) => (
      <StatusBadge status={value ? 'success' : 'pending'} size="small" />
    ),
  },
  {
    key: 'createdAt',
    title: '创建时间',
    dataIndex: 'createdAt',
    width: 160,
    sortable: true,
    render: (value: unknown) => (
      <Text type="secondary" style={{ fontSize: spacing[3] }}>
        {dayjs(String(value)).fromNow()}
      </Text>
    ),
  },
  {
    key: 'actions',
    title: '操作',
    width: 100,
    render: (_: unknown, record: ChangeIntelligenceReport) => (
      <Button type="link" size="small" onClick={() => handleViewDetail(record)}>
        详情
      </Button>
    ),
  },
];

export const buildAffectedServiceColumns = (): TableColumn<AffectedService>[] => [
  {
    key: 'serviceName',
    title: '服务名',
    dataIndex: 'serviceName',
    width: 160,
    render: (value: unknown) => <Text strong>{String(value)}</Text>,
  },
  {
    key: 'serviceTier',
    title: '层级',
    dataIndex: 'serviceTier',
    width: 100,
    render: (value: unknown) => (value ? <Tag>{String(value)}</Tag> : '-'),
  },
  {
    key: 'impactType',
    title: '影响类型',
    dataIndex: 'impactType',
    width: 120,
    render: (value: unknown) => {
      const colorMap: Record<string, string> = {
        direct: 'red',
        dependency: 'orange',
        indirect: 'default',
      };
      return (
        <Tag color={colorMap[String(value)] || 'default'}>{String(value)}</Tag>
      );
    },
  },
  {
    key: 'sloRisk',
    title: 'SLO 风险',
    dataIndex: 'sloRisk',
    width: 100,
    render: (value: unknown) => {
      const statusMap: Record<string, string> = {
        none: 'success',
        low: 'warning',
        medium: 'failed',
        high: 'failed',
      };
      return (
        <StatusBadge
          status={(statusMap[String(value)] || 'unknown') as StatusType}
          size="small"
        />
      );
    },
  },
  {
    key: 'reviewers',
    title: '推荐审批人',
    dataIndex: 'recommendedReviewers',
    width: 160,
    render: (value: unknown) => (
      <Text type="secondary">{value ? (value as string[]).join(', ') : '-'}</Text>
    ),
  },
];
