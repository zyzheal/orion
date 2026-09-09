import { useState, useMemo } from 'react';
import { useQuery } from '@/providers/QueryProvider';
import { Typography, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { fetchSpaceData } from './constants';
import type { SpaceData, SpaceDetailRow } from './types';

const { Text } = Typography;

export function useSpaceDashboardState() {
  const [period, setPeriod] = useState('30d');

  const { data, isLoading: loading, refetch } = useQuery<SpaceData>({
    queryKey: ['space-metrics', period],
    queryFn: () => fetchSpaceData(period),
  });

  const loadData = () => refetch();

  const buildDetailRows = useMemo((): SpaceDetailRow[] => {
    if (!data) return [];
    return [
      { key: '1', metric: '开发者满意度', current: data.satisfaction.score, target: 85, trend: `${data.satisfaction.trend > 0 ? '↑ +' : '↓ '}${Math.abs(data.satisfaction.trend)}`, status: data.satisfaction.score >= 85 ? 'success' : 'warning' },
      { key: '2', metric: '构建成功率', current: data.performance.buildSuccessRate, target: 95, trend: '↑ +2', status: data.performance.buildSuccessRate >= 95 ? 'success' : 'warning' },
      { key: '3', metric: '测试通过率', current: data.performance.testPassRate, target: 95, trend: '↑ +1', status: 'success' },
      { key: '4', metric: 'PR 审查时长(h)', current: data.communication.reviewTurnaround, target: 24, trend: '↓ -1.2h', status: data.communication.reviewTurnaround <= 24 ? 'success' : 'warning' },
      { key: '5', metric: '变更前置时间(d)', current: data.efficiency.leadTime, target: 2, trend: '↓ -0.3d', status: 'success' },
      { key: '6', metric: '故障恢复时间(min)', current: data.efficiency.mttr, target: 30, trend: '↓ -5min', status: 'success' },
    ];
  }, [data]);

  const columns: ColumnsType<SpaceDetailRow> = [
    { title: '指标', dataIndex: 'metric', key: 'metric', width: 200 },
    { title: '当前值', dataIndex: 'current', key: 'current', render: (val: number) => <Text strong>{val}</Text> },
    { title: '目标值', dataIndex: 'target', key: 'target', render: (val: number) => <Text type="secondary">{val}</Text> },
    { title: '趋势', dataIndex: 'trend', key: 'trend', render: (val: string) => {
      const isUp = val.includes('↑');
      return <Tag color={isUp ? 'green' : val.includes('↓') ? 'blue' : 'default'}>{val}</Tag>;
    }},
    { title: '达标', dataIndex: 'status', key: 'status', render: (val: string) => (
      <Tag color={val === 'success' ? 'green' : 'orange'}>{val === 'success' ? '达标' : '待改进'}</Tag>
    )},
  ];

  const overallScore = data
    ? Math.round(
        (data.satisfaction.score + data.performance.buildSuccessRate + data.performance.testPassRate +
         (100 - data.communication.reviewTurnaround * 3) + (100 - data.efficiency.mttr * 2)) / 5
      )
    : 0;

  return {
    period, setPeriod, data, loading, loadData,
    buildDetailRows, columns, overallScore,
  };
}

export type SpaceDashboardState = ReturnType<typeof useSpaceDashboardState>;
