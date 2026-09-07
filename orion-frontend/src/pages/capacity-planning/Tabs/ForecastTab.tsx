/**
 * ForecastTab.tsx - 容量预测 Tab
 * 抽取自 CapacityPlanningPage.tsx (P2-9 Phase 92)
 */
import React, { useEffect } from 'react';
import { Table, Button, Typography, message } from 'antd';
import { RiseOutlined, ReloadOutlined } from '@ant-design/icons';
import { useQuery } from '@/providers/QueryProvider';
import { listCapacityForecasts, type CapacityForecast } from '@/api/capacity';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';

const { Title, Text } = Typography;

export const ForecastTab: React.FC = () => {
  const {
    data: forecasts = [],
    isLoading: loading,
    error: queryError,
    isError,
    refetch: loadData,
  } = useQuery<CapacityForecast[]>({
    queryKey: ['capacity-forecasts'],
    queryFn: async () => {
      const res = await listCapacityForecasts();
      return (res.data as { data?: CapacityForecast[] })?.data ?? [];
    },
    staleTime: 30_000,
  });

  // 加载失败反馈：本仓库锁定的 react-query 构建不触发 useQuery 的 onError 选项
  // （QueryObserver 未实现 observer 级回调），统一用 isError + useEffect 呈现。
  useEffect(() => {
    if (isError) message.error(queryError instanceof Error ? queryError.message : '加载预测失败');
  }, [isError, queryError]);

  const columns = [
    { title: '资源', dataIndex: 'resourceId', key: 'resourceId' },
    { title: '类型', dataIndex: 'resourceType', key: 'resourceType' },
    { title: '指标', dataIndex: 'metricName', key: 'metricName' },
    {
      title: '当前',
      dataIndex: 'currentUtilization',
      key: 'currentUtilization',
      render: (v: number) => `${v.toFixed(1)}%`,
    },
    {
      title: '30 天预测',
      dataIndex: 'forecast30Days',
      key: 'forecast30Days',
      render: (v: number) => (
        <span
          style={
            {
              color:
                v >= 90 ? colors.error[500] : v >= 70 ? colors.warning[500] : colors.neutral[900],
            } as React.CSSProperties
          }
        >
          {v.toFixed(1)}%
        </span>
      ),
    },
    {
      title: '90 天预测',
      dataIndex: 'forecast90Days',
      key: 'forecast90Days',
      render: (v: number) => (
        <span
          style={
            {
              color:
                v >= 90 ? colors.error[500] : v >= 70 ? colors.warning[500] : colors.neutral[900],
            } as React.CSSProperties
          }
        >
          {v.toFixed(1)}%
        </span>
      ),
    },
    {
      title: '预计耗尽',
      dataIndex: 'estimatedExhaustDate',
      key: 'estimatedExhaustDate',
      render: (v: string) => (v ? new Date(v).toLocaleDateString() : '-'),
    },
    {
      title: '建议',
      dataIndex: 'recommendedAction',
      key: 'recommendedAction',
      ellipsis: true,
      render: (v: string) => v || '-',
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.md }}>
        <div>
          <Title level={3} style={{ marginBottom: spacing.sm }}>
            <RiseOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            容量预测
          </Title>
          <Text type="secondary">资源使用趋势预测与耗尽时间估算</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={() => loadData()} loading={loading}>
          刷新
        </Button>
      </div>
      <Table
        columns={columns}
        dataSource={forecasts}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />
    </div>
  );
};
