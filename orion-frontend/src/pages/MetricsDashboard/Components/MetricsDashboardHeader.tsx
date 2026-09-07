/**
 * MetricsDashboard Header
 * 抽取自 index.tsx (P2-9 Phase 128)
 */
import React from 'react';
import { Typography, Space, Button, Select } from 'antd';
import { ReloadOutlined, LineChartOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import type { TimeRange } from '../types';
import { TIME_RANGE_OPTIONS } from '../constants';

const { Title, Text } = Typography;

interface MetricsDashboardHeaderProps {
  selectedTimeRange: TimeRange;
  setSelectedTimeRange: (v: TimeRange) => void;
  refreshing: boolean;
  handleRefresh: () => void;
}

export const MetricsDashboardHeader: React.FC<MetricsDashboardHeaderProps> = ({
  selectedTimeRange,
  setSelectedTimeRange,
  refreshing,
  handleRefresh,
}) => (
  <div
    style={{
      marginBottom: spacing[6],
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    }}
  >
    <div>
      <Title level={2} style={{ marginBottom: spacing.sm }}>
        <LineChartOutlined style={{ marginRight: spacing[2], color: colors.primary[500] }} />
        Metrics Overview
      </Title>
      <Text type="secondary">全局指标概览</Text>
    </div>
    <Space>
      <Select
        value={selectedTimeRange}
        onChange={(value: TimeRange) => setSelectedTimeRange(value)}
        style={{ width: 120 }}
        options={TIME_RANGE_OPTIONS}
      />
      <Button
        type="primary"
        icon={<ReloadOutlined spin={refreshing} />}
        onClick={handleRefresh}
        loading={refreshing}
      >
        Refresh
      </Button>
    </Space>
  </div>
);
