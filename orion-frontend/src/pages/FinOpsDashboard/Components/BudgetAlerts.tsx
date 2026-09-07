/**
 * BudgetAlerts - 预算告警
 * 抽取自 index.tsx (P2-9 Phase 125)
 */
import React from 'react';
import { Alert, Card, Space, Tag, Typography } from 'antd';
import { spacing } from '@/tokens';
import type { FinOpsDashboardState } from '../useFinOpsDashboardState';
import { alertStatusConfig } from '../constants';

const { Text } = Typography;

interface BudgetAlertsProps {
  state: FinOpsDashboardState;
}

export const BudgetAlerts: React.FC<BudgetAlertsProps> = ({ state }) => {
  const { loading, budgetAlerts } = state;

  return (
    <Card title="预算告警" bordered={false} style={{ borderRadius: 8 }} loading={loading}>
      <Space direction="vertical" style={{ width: '100%' }} size={12}>
        {budgetAlerts.map((alert) => (
          <Alert
            key={alert.key}
            message={
              <Space>
                <Text strong>{alert.service}</Text>
                <Tag color={alertStatusConfig[alert.status].color}>
                  {alertStatusConfig[alert.status].label}
                </Tag>
              </Space>
            }
            description={
              <div style={{ marginTop: 4 }}>
                <Text type="secondary" style={{ fontSize: spacing[3] }}>
                  当前使用 {alert.current}% / 预算阈值 {alert.threshold}%
                </Text>
              </div>
            }
            type={alert.status === 'exceeded' ? 'error' : 'warning'}
            showIcon
          />
        ))}
      </Space>
    </Card>
  );
};
