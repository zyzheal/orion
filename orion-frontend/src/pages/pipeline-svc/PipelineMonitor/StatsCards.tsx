/**
 * StatsCards
 * 统计卡片（第一行 4 卡 + P50/P95 行）
 * 抽取自 index.tsx
 */
import React from 'react';
import { Row, Col, Statistic } from 'antd';
import {
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LineChartOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';
import CardPanel from '@/components/CardPanel';
import type { RunStats } from './api';

export interface StatsCardsProps {
  stats: RunStats | null;
  p50Duration: number;
  p95Duration: number;
  formatDuration: (ms: number) => string;
}

export const StatsCards: React.FC<StatsCardsProps> = ({
  stats,
  p50Duration,
  p95Duration,
  formatDuration,
}) => (
  <>
    <Row gutter={[spacing.md, spacing.md]} style={{ marginBottom: spacing.md }}>
      <Col xs={24} sm={12} lg={6}>
        <CardPanel>
          <Statistic
            title="总运行次数"
            value={stats?.totalRuns ?? 0}
            prefix={<ClockCircleOutlined style={{ color: colors.primary[500] }} />}
            valueStyle={{ fontSize: 28 }}
          />
        </CardPanel>
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <CardPanel>
          <Statistic
            title="成功率"
            value={(stats?.successRate ?? 0).toFixed(1)}
            suffix="%"
            prefix={<CheckCircleOutlined style={{ color: colors.success[500] }} />}
            valueStyle={{ color: colors.success[500], fontSize: 28 }}
          />
        </CardPanel>
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <CardPanel>
          <Statistic
            title="失败次数"
            value={stats?.failedCount ?? 0}
            prefix={<CloseCircleOutlined style={{ color: colors.error[500] }} />}
            valueStyle={{ color: colors.error[500], fontSize: 28 }}
          />
        </CardPanel>
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <CardPanel>
          <Statistic
            title="平均耗时"
            value={formatDuration(stats?.avgDuration ?? 0)}
            prefix={<ClockCircleOutlined style={{ color: colors.info[500] }} />}
            valueStyle={{ fontSize: 28 }}
          />
        </CardPanel>
      </Col>
    </Row>

    {(p50Duration > 0 || p95Duration > 0) && (
      <Row gutter={[spacing.md, spacing.md]} style={{ marginBottom: spacing.md }}>
        <Col xs={24} sm={12} lg={12}>
          <CardPanel>
            <Statistic
              title="P50 耗时 (中位数)"
              value={formatDuration(p50Duration)}
              prefix={<LineChartOutlined style={{ color: colors.primary[500] }} />}
              valueStyle={{ fontSize: 28 }}
            />
          </CardPanel>
        </Col>
        <Col xs={24} sm={12} lg={12}>
          <CardPanel>
            <Statistic
              title="P95 耗时 (95百分位)"
              value={formatDuration(p95Duration)}
              prefix={<LineChartOutlined style={{ color: colors.purple[500] }} />}
              valueStyle={{ color: colors.purple[500], fontSize: 28 }}
            />
          </CardPanel>
        </Col>
      </Row>
    )}
  </>
);
