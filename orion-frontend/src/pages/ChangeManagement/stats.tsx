/**
 * Change Management — Stats Cards Computation
 *
 * Factory function that transforms raw stats API response into
 * MetricCard data objects. Extracted from index.tsx to reduce main file size.
 */
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  FileTextOutlined,
  PlayCircleOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens';

interface StatsRaw {
  totalRequests: number;
  byStatus?: Record<string, number>;
  byType?: Record<string, number>;
}

export interface MetricCardData {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}

export function buildStatsCards(stats: StatsRaw | null): MetricCardData[] {
  if (!stats) return [];

  return [
    {
      title: '变更请求总数',
      value: stats.totalRequests,
      icon: <SwapOutlined style={{ fontSize: 24, color: colors.primary[500] }} />,
      color: colors.primary[500],
    },
    {
      title: '草稿',
      value: stats.byStatus?.draft || 0,
      icon: <FileTextOutlined style={{ fontSize: 24, color: colors.neutral[500] }} />,
      color: colors.neutral[500],
    },
    {
      title: '已批准',
      value: stats.byStatus?.approved || 0,
      icon: <CheckCircleOutlined style={{ fontSize: 24, color: colors.success[500] }} />,
      color: colors.success[500],
    },
    {
      title: '实施中',
      value: stats.byStatus?.in_progress || 0,
      icon: <PlayCircleOutlined style={{ fontSize: 24, color: colors.warning[500] }} />,
      color: colors.warning[500],
    },
    {
      title: '紧急变更',
      value: stats.byType?.emergency || 0,
      icon: <ExclamationCircleOutlined style={{ fontSize: 24, color: colors.error[500] }} />,
      color: colors.error[500],
    },
  ];
}
