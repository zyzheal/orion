/**
 * ForecastCard.tsx - 成本预测卡
 * 抽取自 BudgetGuardPage.tsx (P2-9 Phase 45)
 * 显示: Current Spend / Predicted End of Month / Overage or Remaining + Confidence + Forecast Days
 */
import React from 'react';
import { Card, Row, Col, Statistic, Space, Divider, Descriptions, Alert } from 'antd';
import { LineChartOutlined } from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';
import type { CostForecastResult } from '@/api/cost-operations';

export interface ForecastCardProps {
  forecast: CostForecastResult | null;
  loading: boolean;
}

export const ForecastCard: React.FC<ForecastCardProps> = ({ forecast, loading }) => {
  if (!forecast) {
    return (
      <Card
        title={
          <Space>
            <LineChartOutlined />
            Cost Forecast
          </Space>
        }
        loading={loading}
      >
        <Alert
          message="No forecast data available"
          description="Cost forecast is generated based on historical spending patterns."
          type="info"
          showIcon
        />
      </Card>
    );
  }

  const isOverBudget = forecast.projectedOverage > 0;

  return (
    <Card
      title={
        <Space>
          <LineChartOutlined />
          Cost Forecast
        </Space>
      }
      loading={loading}
    >
      <Row gutter={spacing[4]}>
        <Col span={8}>
          <Statistic title="Current Spend" value={forecast.currentSpend} precision={2} prefix="¥" />
        </Col>
        <Col span={8}>
          <Statistic
            title="Predicted End of Month"
            value={forecast.predictedEndOfMonthCost}
            precision={2}
            prefix="¥"
            valueStyle={{ color: isOverBudget ? colors.error[500] : colors.success[500] }}
          />
        </Col>
        <Col span={8}>
          <Statistic
            title={isOverBudget ? 'Projected Overage' : 'Budget Remaining'}
            value={Math.abs(forecast.projectedOverage)}
            precision={2}
            prefix="¥"
            valueStyle={{ color: isOverBudget ? colors.error[500] : colors.success[500] }}
          />
        </Col>
      </Row>
      <Divider />
      <Descriptions size="small" column={2}>
        <Descriptions.Item label="Confidence">
          {(forecast.confidence * 100).toFixed(0)}%
        </Descriptions.Item>
        <Descriptions.Item label="Forecast Days">
          {forecast.dailyForecast?.length || 0} days
        </Descriptions.Item>
      </Descriptions>
    </Card>
  );
};

export default ForecastCard;
