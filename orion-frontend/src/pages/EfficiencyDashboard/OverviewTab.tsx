/**
 * OverviewTab.tsx - 总览 Tab
 * 抽取自 EfficiencyDashboard/index.tsx (P2-9 Phase 79)
 */
import React from 'react';
import { Typography, Card, Table, Tag, Space } from 'antd';
import { TrophyOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import type { DoraBenchmarks, ClickHouseStatusData, EfficiencyDashboardData, MetricRow } from './types';
import { makeMetricColumns } from './MetricColumns';

const { Text } = Typography;

interface OverviewTabProps {
  doraMetricsData: MetricRow[];
  benchmarks: DoraBenchmarks | null;
  clickHouseStatus: ClickHouseStatusData | null;
  dashboardData: EfficiencyDashboardData | null;
  loading: boolean;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  doraMetricsData,
  benchmarks,
  clickHouseStatus,
  dashboardData,
  loading,
}) => {
  const metricColumns = makeMetricColumns(benchmarks);

  return (
    <>
      <Card title="DORA 指标详情" style={{ marginBottom: spacing.md }}>
        <Table
          columns={metricColumns}
          dataSource={doraMetricsData}
          rowKey="key"
          pagination={false}
          size="small"
          loading={loading}
        />
      </Card>

      <Card title="数据同步状态" style={{ marginBottom: spacing.md }}>
        <Space size="large">
          <div>
            <Text type="secondary">ClickHouse:</Text>{' '}
            <Tag color={clickHouseStatus?.connected ? 'green' : 'red'}>
              {clickHouseStatus?.connected ? '已连接' : '未连接'}
            </Tag>
          </div>
          <div>
            <Text type="secondary">同步记录:</Text>{' '}
            <Text strong>{clickHouseStatus?.syncedRecords || 0}</Text>
          </div>
          <div>
            <Text type="secondary">最后同步:</Text>{' '}
            {clickHouseStatus?.lastSyncAt
              ? new Date(clickHouseStatus.lastSyncAt).toLocaleString()
              : '从未'}
          </div>
        </Space>
      </Card>

      <Card title="改进建议">
        <div
          style={{
            padding: '12px 16px',
            background: 'rgba(24, 144, 255, 0.04)',
            borderRadius: 8,
            borderLeft: `3px solid ${colors.primary[500]}`,
          }}
        >
          <Space>
            <TrophyOutlined style={{ color: colors.primary[500] }} />
            <Text>
              {dashboardData?.dora?.deploymentFrequency &&
              dashboardData.dora.deploymentFrequency < 10
                ? '建议提高发布频率，向 Elite 级别（每天多次）看齐'
                : '保持当前发布频率，继续优化其他指标'}
            </Text>
          </Space>
        </div>
      </Card>
    </>
  );
};
