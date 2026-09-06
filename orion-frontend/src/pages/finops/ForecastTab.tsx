/**
 * FinOps 成本预测 Tab
 *
 * 以卡片形式展示每条预算的当前花费、预测花费、预计超支与耗尽天数。
 */
import React from 'react';
import { Button, Card, Col, Descriptions, Divider, Empty, Row, Space, Tag, Typography } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import type { BudgetForecast } from '@/types/finops';
import { colors, componentRadius, spacing } from '@/tokens';

const { Text } = Typography;

export interface ForecastTabProps {
  forecasts: BudgetForecast[];
  loading: boolean;
  onRefresh: () => void;
}

export const ForecastTab: React.FC<ForecastTabProps> = ({ forecasts, loading, onRefresh }) => (
  <div>
    <div style={{ marginBottom: spacing.md }}>
      <Space>
        <Button icon={<ReloadOutlined />} loading={loading} onClick={onRefresh}>
          刷新预测
        </Button>
      </Space>
    </div>

    {forecasts.length > 0 ? (
      <Row gutter={[16, 16]}>
        {forecasts.map((forecast, index) => (
          <Col xs={24} lg={12} key={String(index)}>
            <Card
              title={`预测 #${index + 1}`}
              bordered={false}
              style={{ borderRadius: componentRadius.card }}
            >
              <Descriptions column={2} size="small">
                <Descriptions.Item label="当前花费">
                  <Text strong style={{ color: colors.primary[500] }}>
                    ¥
                    {forecast.currentSpend.toLocaleString(undefined, {
                      maximumFractionDigits: 2,
                    })}
                  </Text>
                </Descriptions.Item>
                <Descriptions.Item label="预测花费">
                  <Text strong style={{ color: colors.warning[500] }}>
                    ¥
                    {forecast.forecastedSpend.toLocaleString(undefined, {
                      maximumFractionDigits: 2,
                    })}
                  </Text>
                </Descriptions.Item>
                <Descriptions.Item label="预计超支">
                  <Text
                    strong
                    style={{
                      color:
                        forecast.projectedOverage > 0 ? colors.error[500] : colors.success[500],
                    }}
                  >
                    ¥
                    {forecast.projectedOverage.toLocaleString(undefined, {
                      maximumFractionDigits: 2,
                    })}
                  </Text>
                </Descriptions.Item>
                <Descriptions.Item label="每日花费率">
                  ¥
                  {forecast.dailySpendRate.toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })}
                </Descriptions.Item>
                <Descriptions.Item label="耗尽天数">
                  {forecast.daysUntilExhausted > 0
                    ? `${forecast.daysUntilExhausted} 天`
                    : '无数据'}
                </Descriptions.Item>
                <Descriptions.Item label="是否超预算">
                  <Tag color={forecast.withinBudget ? 'success' : 'error'}>
                    {forecast.withinBudget ? '未超预算' : '预计超预算'}
                  </Tag>
                </Descriptions.Item>
              </Descriptions>

              {forecast.history.length > 0 && (
                <>
                  <Divider style={{ margin: '16px 0 8px' }} />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    历史数据点：{forecast.history.length} 条
                  </Text>
                </>
              )}
            </Card>
          </Col>
        ))}
      </Row>
    ) : (
      <Empty description="暂无成本预测数据" image={Empty.PRESENTED_IMAGE_SIMPLE}>
        <Button type="primary" onClick={onRefresh} loading={loading}>
          <ReloadOutlined /> 刷新预测数据
        </Button>
      </Empty>
    )}
  </div>
);
