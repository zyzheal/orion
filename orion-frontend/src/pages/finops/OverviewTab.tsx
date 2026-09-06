/**
 * FinOps 成本总览 Tab
 *
 * 展示四个关键指标（总成本 / 计算 / 存储 / SaaS）与成本分解表、
 * 费用构成进度条视图。
 */
import React from 'react';
import { Button, Card, Col, Empty, Progress, Row, Space, Statistic, Table, Tag, Typography } from 'antd';
import { ArrowUpOutlined, ExportOutlined, MinusOutlined } from '@ant-design/icons';
import type { CostSummaryResponse, CostBreakdownItem } from '@/types/finops';
import { colors, componentRadius, radius, spacing } from '@/tokens';
import { getCategoryLabel } from './config';
import { buildCostBreakdownColumns } from './columns';

const { Text } = Typography;

export interface OverviewTabProps {
  costSummary: CostSummaryResponse['summary'] | null;
  costBreakdown: CostBreakdownItem[];
  onExportReport: () => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  costSummary,
  costBreakdown,
  onExportReport,
}) => {
  if (!costSummary) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0' }}>
        <Empty description="暂无成本数据" />
      </div>
    );
  }

  // TODO: link to budget data for usage percentage and month-over-month comparison

  return (
    <div>
      {/* Summary Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: spacing.lg }}>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} style={{ borderRadius: componentRadius.card }}>
            <Statistic
              title="总成本"
              value={costSummary.totalCost}
              precision={2}
              prefix={
                costSummary.totalCost > 0 ? (
                  <ArrowUpOutlined style={{ color: colors.error[500], fontSize: radius.xl }} />
                ) : (
                  <MinusOutlined style={{ color: colors.neutral[400], fontSize: radius.xl }} />
                )
              }
              suffix="¥"
              valueStyle={{ fontSize: 28, fontWeight: 600 }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {costSummary.period === 'monthly' ? '本月' : costSummary.period}
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} style={{ borderRadius: componentRadius.card }}>
            <Statistic
              title="计算资源"
              value={costSummary.computeCost}
              precision={2}
              suffix="¥"
              valueStyle={{ color: colors.primary[500] }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} style={{ borderRadius: componentRadius.card }}>
            <Statistic
              title="存储"
              value={costSummary.storageCost}
              precision={2}
              suffix="¥"
              valueStyle={{ color: colors.info[500] }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} style={{ borderRadius: componentRadius.card }}>
            <Statistic
              title="SaaS 工具"
              value={costSummary.saasCost}
              precision={2}
              suffix="¥"
              valueStyle={{ color: colors.warning[500] }}
            />
          </Card>
        </Col>
      </Row>

      {/* Cost Breakdown Table */}
      <Card
        title="成本分解"
        bordered={false}
        style={{ borderRadius: 12, marginBottom: spacing.md }}
        extra={
          <Button icon={<ExportOutlined />} onClick={onExportReport}>
            导出报表
          </Button>
        }
      >
        <Table<CostBreakdownItem>
          columns={buildCostBreakdownColumns()}
          dataSource={costBreakdown}
          rowKey="dimensionValue"
          pagination={false}
          locale={{ emptyText: <Empty description="暂无成本分解数据" /> }}
          size="middle"
        />
      </Card>

      {/* Cost Breakdown by Category Pie-like view */}
      <Card title="费用构成" bordered={false} style={{ borderRadius: componentRadius.card }}>
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          {costBreakdown.map((item) => (
            <div key={item.dimensionValue}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text strong>{getCategoryLabel(item.dimensionValue)}</Text>
                <Text type="secondary">¥{item.cost.toLocaleString()}</Text>
              </div>
              <Progress
                percent={item.percentage}
                strokeColor={colors.primary[500]}
                showInfo={false}
                size="small"
              />
            </div>
          ))}
          {costBreakdown.length === 0 && <Empty description="暂无费用构成数据" />}
        </Space>
      </Card>
    </div>
  );
};
