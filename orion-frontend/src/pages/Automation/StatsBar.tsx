/**
 * StatsBar - 自动化作业统计条
 */
import React from 'react';
import { Typography, Space, Card } from 'antd';
import { colors, spacing, radius, shadows } from '@/tokens';

const { Text } = Typography;

export interface AutomationStats {
  total: number;
  enabled: number;
  running: number;
  failed: number;
}

export interface StatsBarProps {
  stats: AutomationStats;
}

export const StatsBar: React.FC<StatsBarProps> = ({ stats }) => (
  <Card
    style={{ borderRadius: radius.lg, boxShadow: shadows.sm, marginBottom: spacing.md }}
    bodyStyle={{ padding: `${spacing.sm} ${spacing.lg}` }}
  >
    <Space size="large" style={{ width: '100%', justifyContent: 'space-around' }}>
      <div>
        <Text type="secondary" style={{ fontSize: 12 }}>
          总作业数
        </Text>
        <br />
        <Text style={{ fontSize: 24, fontWeight: 600 }}>{stats.total}</Text>
      </div>
      <div>
        <Text type="secondary" style={{ fontSize: 12 }}>
          已启用
        </Text>
        <br />
        <Text style={{ fontSize: 24, fontWeight: 600, color: colors.success[500] }}>
          {stats.enabled}
        </Text>
      </div>
      <div>
        <Text type="secondary" style={{ fontSize: 12 }}>
          执行中
        </Text>
        <br />
        <Text style={{ fontSize: 24, fontWeight: 600, color: colors.primary[500] }}>
          {stats.running}
        </Text>
      </div>
      <div>
        <Text type="secondary" style={{ fontSize: 12 }}>
          失败
        </Text>
        <br />
        <Text style={{ fontSize: 24, fontWeight: 600, color: colors.error[500] }}>
          {stats.failed}
        </Text>
      </div>
    </Space>
  </Card>
);
