/**
 * DashboardSection.tsx - 多云资源概览 Dashboard
 * 抽取自 multi-cloud/MultiCloudPage.tsx (P2-9 Phase 71)
 */
import React from 'react';
import { Card, Statistic, Row, Col, Progress, Space, Tooltip, Typography, Button } from 'antd';
import {
  CloudServerOutlined,
  HddOutlined,
  DollarOutlined,
  GlobalOutlined,
  ApiOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  CloudOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import {
  providerLabelMap,
  providerIconColors,
  resourceTypeIcons,
  resourceTypeTokenColors,
} from './MultiCloudConfig';

const { Text } = Typography;

interface DashboardSectionProps {
  stats: {
    total: number;
    active: number;
    error: number;
    resources: number;
    providers: number;
    regions: number;
  };
  statistics: { totalMonthlyCost?: number } | null;
  resourceTypeDistribution: Array<{ type: string; count: number; percentage: number }>;
  providerDistribution: Array<{ provider: string; count: number; percentage: number }>;
  costTrendData: Array<{ month: string; cost: number }>;
  costTrendLoading: boolean;
  maxCost: number;
  onCostCompare: () => void;
}

export const DashboardSection: React.FC<DashboardSectionProps> = ({
  stats,
  statistics,
  resourceTypeDistribution,
  providerDistribution,
  costTrendData,
  costTrendLoading,
  maxCost,
  onCostCompare,
}) => {
  return (
    <div style={{ marginBottom: spacing.lg }}>
      {/* Stats Cards */}
      <Row gutter={16} style={{ marginBottom: spacing.lg }}>
        <Col span={4}>
          <Card
            size="small"
            style={{ borderRadius: 12, borderTop: `3px solid ${colors.primary[500]}` }}
          >
            <Statistic
              title="云账号"
              value={stats.total}
              prefix={<CloudServerOutlined style={{ color: colors.primary[500] }} />}
              valueStyle={{ fontSize: 28, fontWeight: 600 }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {stats.active} 已连接
            </Text>
          </Card>
        </Col>
        <Col span={4}>
          <Card
            size="small"
            style={{ borderRadius: 12, borderTop: `3px solid ${colors.success[500]}` }}
          >
            <Statistic
              title="云资源"
              value={stats.resources}
              prefix={<HddOutlined style={{ color: colors.success[500] }} />}
              valueStyle={{ fontSize: 28, fontWeight: 600 }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {stats.providers} 云厂商
            </Text>
          </Card>
        </Col>
        <Col span={4}>
          <Card
            size="small"
            style={{ borderRadius: 12, borderTop: `3px solid ${colors.info[500]}` }}
          >
            <Statistic
              title="覆盖区域"
              value={stats.regions}
              prefix={<GlobalOutlined style={{ color: colors.info[500] }} />}
              valueStyle={{ fontSize: 28, fontWeight: 600 }}
              suffix="个"
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card
            size="small"
            style={{ borderRadius: 12, borderTop: `3px solid ${colors.warning[500]}` }}
          >
            <Statistic
              title="月度费用"
              value={statistics?.totalMonthlyCost ?? 0}
              prefix={<DollarOutlined style={{ color: colors.warning[500] }} />}
              valueStyle={{ fontSize: 28, fontWeight: 600 }}
              precision={2}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card
            size="small"
            style={{
              borderRadius: 12,
              borderTop: `3px solid ${stats.error > 0 ? colors.error[500] : colors.success[500]}`,
            }}
          >
            <Statistic
              title="异常账号"
              value={stats.error}
              prefix={
                stats.error > 0 ? (
                  <ExclamationCircleOutlined style={{ color: colors.error[500] }} />
                ) : (
                  <CheckCircleOutlined style={{ color: colors.success[500] }} />
                )
              }
              valueStyle={{
                fontSize: 28,
                fontWeight: 600,
                color: stats.error > 0 ? colors.error[500] : colors.success[500],
              }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card
            size="small"
            style={{ borderRadius: 12, borderTop: `3px solid ${colors.purple[500]}` }}
          >
            <Statistic
              title="资源类型"
              value={resourceTypeDistribution.length}
              prefix={<ApiOutlined style={{ color: colors.purple[500] }} />}
              valueStyle={{ fontSize: 28, fontWeight: 600 }}
              suffix="种"
            />
          </Card>
        </Col>
      </Row>

      {/* Provider Distribution + Cost Trend */}
      <Row gutter={16} style={{ marginBottom: spacing.lg }}>
        <Col span={12}>
          <Card title="云厂商资源分布" size="small" style={{ borderRadius: 12 }}>
            {providerDistribution.length > 0 ? (
              <div>
                {providerDistribution.map((item) => (
                  <div key={item.provider} style={{ marginBottom: spacing.md }}>
                    <div
                      style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}
                    >
                      <Space>
                        <CloudOutlined
                          style={{
                            color: providerIconColors[item.provider] || colors.neutral[500],
                          }}
                        />
                        <Text strong>
                          {providerLabelMap[item.provider] || item.provider}
                        </Text>
                      </Space>
                      <Text type="secondary">
                        {item.count} 个资源 ({item.percentage}%)
                      </Text>
                    </div>
                    <Progress
                      percent={item.percentage}
                      strokeColor={providerIconColors[item.provider] || colors.primary[500]}
                      showInfo={false}
                      size="small"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <Text type="secondary">暂无数据，请先添加云账号</Text>
              </div>
            )}
          </Card>
        </Col>
        <Col span={12}>
          <Card
            title="月度费用趋势"
            size="small"
            style={{ borderRadius: 12 }}
            extra={
              <Button type="link" size="small" onClick={onCostCompare}>
                成本对比
              </Button>
            }
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                height: 160,
                gap: spacing.sm,
                padding: '0 8px',
              }}
            >
              {costTrendLoading ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: 160,
                    width: '100%',
                  }}
                >
                  <Text type="secondary">加载中...</Text>
                </div>
              ) : costTrendData.length === 0 ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: 160,
                    width: '100%',
                  }}
                >
                  <Text type="secondary">暂无成本数据</Text>
                </div>
              ) : (
                costTrendData.map((item, index) => {
                  const height = maxCost > 0 ? (item.cost / maxCost) * 140 : 0;
                  const isCurrent = index === costTrendData.length - 1;
                  return (
                    <Tooltip key={item.month} title={`$${item.cost.toLocaleString()}`}>
                      <div
                        style={{
                          flex: 1,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                        }}
                      >
                        <Text style={{ fontSize: 10, marginBottom: 4 }}>
                          ${(item.cost / 1000).toFixed(1)}k
                        </Text>
                        <div
                          style={{
                            width: '100%',
                            height: Math.max(height, 4),
                            backgroundColor: isCurrent
                              ? colors.primary[500]
                              : colors.primary[200],
                            borderRadius: '4px 4px 0 0',
                            transition: 'height 0.3s ease',
                          }}
                        />
                        <Text type="secondary" style={{ fontSize: 10, marginTop: 4 }}>
                          {item.month}
                        </Text>
                      </div>
                    </Tooltip>
                  );
                })
              )}
            </div>
          </Card>
        </Col>
      </Row>

      {/* Resource Type Distribution */}
      {resourceTypeDistribution.length > 0 && (
        <Row gutter={16} style={{ marginBottom: spacing.lg }}>
          <Col span={24}>
            <Card title="资源类型分布" size="small" style={{ borderRadius: 12 }}>
              <Row gutter={16}>
                {resourceTypeDistribution.map((item) => (
                  <Col span={4} key={item.type}>
                    <Card
                      size="small"
                      style={{
                        textAlign: 'center',
                        borderRadius: 8,
                        borderTop: `2px solid ${resourceTypeTokenColors[item.type] || colors.neutral[300]}`,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 24,
                          color: resourceTypeTokenColors[item.type],
                          marginBottom: spacing.sm,
                        }}
                      >
                        {resourceTypeIcons[item.type] || <HddOutlined />}
                      </div>
                      <Statistic
                        title={item.type}
                        value={item.count}
                        valueStyle={{ fontSize: 20 }}
                      />
                      <Progress
                        percent={item.percentage}
                        size="small"
                        strokeColor={resourceTypeTokenColors[item.type]}
                        format={() => `${item.percentage}%`}
                      />
                    </Card>
                  </Col>
                ))}
              </Row>
            </Card>
          </Col>
        </Row>
      )}
    </div>
  );
};
