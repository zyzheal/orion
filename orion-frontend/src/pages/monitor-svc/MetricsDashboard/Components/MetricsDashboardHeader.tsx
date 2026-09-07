/**
 * MetricsDashboard header
 * 抽取自 index.tsx (P2-9 Phase 145)
 */
import React from 'react';
import { Button, Select, Space, Typography } from 'antd';
import { DashboardOutlined, ReloadOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import type { TimeRange } from '../types';
import { TIME_RANGE_OPTIONS } from '../constants';

const { Title, Text } = Typography;

interface MetricsDashboardHeaderProps {
  selectedTimeRange: TimeRange;
  onTimeRangeChange: (v: TimeRange) => void;
  onRefresh: () => void;
  refreshing: boolean;
}

export const MetricsDashboardHeader: React.FC<MetricsDashboardHeaderProps> = ({
  selectedTimeRange,
  onTimeRangeChange,
  onRefresh,
  refreshing,
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
        <DashboardOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
        Metrics Overview
      </Title>
      <Text type="secondary">全局指标概览</Text>
    </div>
    <Space>
      <Select
        value={selectedTimeRange}
        onChange={(value: TimeRange) => onTimeRangeChange(value)}
        style={{ width: 120 }}
        options={TIME_RANGE_OPTIONS}
      />
      <Button
        type="primary"
        icon={<ReloadOutlined spin={refreshing} />}
        onClick={onRefresh}
        loading={refreshing}
      >
        Refresh
      </Button>
    </Space>
  </div>
);
