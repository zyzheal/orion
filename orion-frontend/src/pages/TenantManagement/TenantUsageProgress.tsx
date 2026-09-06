/**
 * TenantUsageProgress.tsx - 配额使用情况 + 趋势指示
 * 抽取自 TenantManagement/index.tsx (P2-9 Phase 57)
 */
import React from 'react';
import { Row, Col, Space, Progress, Empty, Card } from 'antd';
import {
  PieChartOutlined,
  ThunderboltOutlined,
  CloudServerOutlined,
  DatabaseOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  MinusOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { Typography } from 'antd';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';
import type { TenantUsage, ResourceUsage } from '@/api/tenant';

const { Text } = Typography;

interface UsageItem {
  label: string;
  icon: React.ReactNode;
  usage: ResourceUsage;
  unit: string;
  color: string;
  trend: { 
    direction: 'up' | 'down' | 'stable';
    changePercent: number;
    history: number[];
  };
}

export interface TenantUsageProgressProps {
  usage: TenantUsage | null;
  getUsagePercent: (item: ResourceUsage) => number;
  getUsageColor: (percent: number) => string;
  generateTrendData: (current: number) => { direction: 'up' | 'down' | 'stable'; changePercent: number; history: number[] };
}

export const TenantUsageProgress: React.FC<TenantUsageProgressProps> = ({
  usage,
  getUsagePercent,
  getUsageColor,
  generateTrendData,
}) => {
  if (!usage) {
    return (
      <Card style={{ marginBottom: spacing.lg }}>
        <Empty description="暂无用量数据" />
      </Card>
    );
  }

  const items: UsageItem[] = [
    { label: 'Pipeline 数量', icon: <PieChartOutlined />, usage: usage.usage.pipelines, unit: '个', color: colors.primary[500], trend: generateTrendData(usage.usage.pipelines.used) },
    { label: '每日运行次数', icon: <ThunderboltOutlined />, usage: usage.usage.pipelineRunsPerDay, unit: '次', color: colors.info[500], trend: generateTrendData(usage.usage.pipelineRunsPerDay.used) },
    { label: '并发运行数', icon: <ThunderboltOutlined />, usage: usage.usage.concurrentRuns, unit: '个', color: colors.purple[500], trend: generateTrendData(usage.usage.concurrentRuns.used) },
    { label: 'Runner 数量', icon: <CloudServerOutlined />, usage: usage.usage.runners, unit: '个', color: colors.primary[500], trend: generateTrendData(usage.usage.runners.used) },
    { label: 'Namespace 数量', icon: <DatabaseOutlined />, usage: usage.usage.namespaces, unit: '个', color: colors.success[500], trend: generateTrendData(usage.usage.namespaces.used) },
    { label: 'CPU 核心数', icon: <CloudServerOutlined />, usage: usage.usage.cpuCores, unit: '核', color: colors.warning[500], trend: generateTrendData(usage.usage.cpuCores.used) },
    { label: '内存', icon: <CloudServerOutlined />, usage: usage.usage.memoryGb, unit: 'GB', color: colors.info[500], trend: generateTrendData(usage.usage.memoryGb.used) },
    { label: '存储', icon: <DatabaseOutlined />, usage: usage.usage.storageGb, unit: 'GB', color: colors.neutral[500], trend: generateTrendData(usage.usage.storageGb.used) },
  ];

  return (
    <Card
      title={
        <Space>
          <PieChartOutlined style={{ color: colors.primary[500] }} />
          配额使用情况
          <InfoCircleOutlined style={{ color: colors.neutral[500], fontSize: 12 }} />
        </Space>
      }
      style={{ marginBottom: spacing.lg }}
    >
      <Row gutter={[24, 24]}>
        {items.map((item) => {
          const percent = getUsagePercent(item.usage);
          return (
            <Col span={8} key={item.label}>
              <div style={{ marginBottom: spacing.sm }}>
                <Space>
                  <span style={{ color: item.color }}>{item.icon}</span>
                  <Text type="secondary">{item.label}</Text>
                </Space>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: spacing.sm,
                  marginBottom: spacing.sm,
                }}
              >
                <span
                  style={{ fontWeight: 'bold', fontSize: 20, color: getUsageColor(percent) }}
                >
                  {item.usage.used}
                </span>
                <Text type="secondary">
                  / {item.usage.limit} {item.unit}
                </Text>
              </div>
              <Progress
                percent={percent}
                size="small"
                strokeColor={getUsageColor(percent)}
                format={(p) => `${p}%`}
              />
              <div
                style={{
                  marginTop: spacing.sm,
                  display: 'flex',
                  alignItems: 'center',
                  gap: spacing.sm,
                }}
              >
                <Space size={4}>
                  {item.trend.direction === 'up' && (
                    <ArrowUpOutlined style={{ color: colors.error[500], fontSize: 12 }} />
                  )}
                  {item.trend.direction === 'down' && (
                    <ArrowDownOutlined style={{ color: colors.success[500], fontSize: 12 }} />
                  )}
                  {item.trend.direction === 'stable' && (
                    <MinusOutlined style={{ color: colors.neutral[500], fontSize: 12 }} />
                  )}
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    较昨日 {item.trend.changePercent}%
                  </Text>
                </Space>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: 2,
                    height: 20,
                    marginLeft: 'auto',
                  }}
                >
                  {item.trend.history.slice(-7).map((val, idx) => {
                    const maxVal = Math.max(...item.trend.history, 1);
                    const height = Math.max(4, (val / maxVal) * 20);
                    return (
                      <div
                        key={String(idx)}
                        style={{
                          width: 4,
                          height,
                          borderRadius: 2,
                          backgroundColor: idx === 6 ? item.color : `${item.color}66`,
                        }}
                        title={`${idx + 1}天前: ${val}`}
                      />
                    );
                  })}
                </div>
              </div>
            </Col>
          );
        })}
      </Row>
    </Card>
  );
};
