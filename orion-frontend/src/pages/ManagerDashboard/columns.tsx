/**
 * ManagerDashboard columns
 * 抽取自 index.tsx (P2-9 Phase 181)
 */
import { Space, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { spacing } from '@/tokens';
import { msToHours, COLORS, gradeColor } from './constants';
import { TrendIndicator } from './Components/TrendIndicator';

const { Text } = Typography;

type Member = {
  engineerId: string;
  engineerName: string;
  workload: { totalAssigned: number; totalResolved: number };
  efficiency: { avgResolutionTimeMs: number; ticketsPerDay: number };
  quality: {
    slaComplianceRate: number;
    firstTimeResolveRate: number;
    reopenRate: number;
  };
  compositeScore: number;
  performanceGrade: string;
  trend: 'improving' | 'stable' | 'declining';
};

type TransferReason = { reason: string; count: number };

export function buildMemberColumns(): ColumnsType<Member> {
  return [
    {
      title: '工程师',
      dataIndex: 'engineerName',
      key: 'engineerName',
      fixed: 'left',
      width: 100,
    },
    {
      title: '工作量',
      key: 'workload',
      width: 120,
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <Text style={{ fontSize: spacing[3] }}>
            分配 <Text strong>{record.workload.totalAssigned}</Text>
          </Text>
          <Text style={{ fontSize: spacing[3] }}>
            解决{' '}
            <Text strong style={{ color: COLORS.success }}>
              {record.workload.totalResolved}
            </Text>
          </Text>
        </Space>
      ),
    },
    {
      title: '效率',
      key: 'efficiency',
      width: 120,
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <Text style={{ fontSize: spacing[3] }}>
            平均 {msToHours(record.efficiency.avgResolutionTimeMs)}
          </Text>
          <Text style={{ fontSize: spacing[3] }}>{record.efficiency.ticketsPerDay} 单/天</Text>
        </Space>
      ),
    },
    {
      title: '质量',
      key: 'quality',
      width: 160,
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <Text style={{ fontSize: spacing[3] }}>
            SLA{' '}
            <Text
              strong
              style={{
                color: record.quality.slaComplianceRate >= 0.9 ? COLORS.success : COLORS.error,
              }}
            >
              {(record.quality.slaComplianceRate * 100).toFixed(0)}%
            </Text>
          </Text>
          <Text style={{ fontSize: spacing[3] }}>
            首次解决 {(record.quality.firstTimeResolveRate * 100).toFixed(0)}%
          </Text>
          <Text style={{ fontSize: spacing[3] }}>
            重开率{' '}
            <Text
              style={{
                color: record.quality.reopenRate > 0.1 ? COLORS.error : 'inherit',
              }}
            >
              {(record.quality.reopenRate * 100).toFixed(0)}%
            </Text>
          </Text>
        </Space>
      ),
    },
    {
      title: '综合评分',
      dataIndex: 'compositeScore',
      key: 'compositeScore',
      width: 160,
      sorter: (a, b) => a.compositeScore - b.compositeScore,
      defaultSortOrder: 'descend',
      render: (score: number) => (
        <Space>
          <Text strong>{score}</Text>
        </Space>
      ),
    },
    {
      title: '等级',
      dataIndex: 'performanceGrade',
      key: 'performanceGrade',
      width: 70,
      render: (grade: string) => (
        <Tag color={gradeColor(grade)} style={{ fontWeight: 700, minWidth: 30, textAlign: 'center' }}>
          {grade}
        </Tag>
      ),
    },
    {
      title: '趋势',
      dataIndex: 'trend',
      key: 'trend',
      width: 70,
      render: (trend: 'improving' | 'stable' | 'declining') => <TrendIndicator trend={trend} />,
    },
  ];
}

export function buildTransferColumns(): ColumnsType<TransferReason> {
  return [
    {
      title: '转派原因',
      dataIndex: 'reason',
      key: 'reason',
    },
    {
      title: '次数',
      dataIndex: 'count',
      key: 'count',
      sorter: (a, b) => a.count - b.count,
      render: (count: number) => (
        <Space>
          <Text strong>{count}</Text>
        </Space>
      ),
    },
  ];
}
