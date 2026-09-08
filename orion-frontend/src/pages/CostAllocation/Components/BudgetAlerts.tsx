/**
 * BudgetAlerts - 预算告警卡片
 * 抽取自 index.tsx (P2-9 Phase 220)
 */
import { Card, Col, Progress, Row, Space, Tag, Typography } from 'antd';
import { WarningOutlined } from '@ant-design/icons';
import { colors, spacing, componentRadius } from '@/tokens';
import { formatCost } from '../constants';

const { Text } = Typography;

export interface BudgetAlert {
  budgetId: string;
  budgetName: string;
  currentSpend: number;
  limit: number;
  exceeded: boolean;
}

interface Props {
  alerts: BudgetAlert[];
}

export const BudgetAlerts = ({ alerts }: Props) => {
  if (alerts.length === 0) return null;

  return (
    <Card
      title={
        <Space>
          <WarningOutlined style={{ color: colors.warning[500] }} />
          <Text strong>预算告警</Text>
        </Space>
      }
      style={{
        borderRadius: 12,
        marginBottom: spacing.lg,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        borderLeft: `3px solid ${colors.warning[500]}`,
      }}
    >
      <Row gutter={[16, 16]}>
        {alerts.map((alert) => {
          const pct = Math.min(Math.round((alert.currentSpend / alert.limit) * 100), 100);
          const isOver = alert.exceeded || pct >= 100;
          return (
            <Col xs={24} sm={12} lg={8} key={alert.budgetId}>
              <Card
                size="small"
                style={{
                  borderRadius: componentRadius.card,
                  background: isOver ? colors.error[50] : colors.warning[50],
                }}
              >
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Row justify="space-between">
                    <Text strong>{alert.budgetName}</Text>
                    <Tag color={isOver ? 'red' : 'orange'}>
                      {isOver ? '已超限' : '接近限额'}
                    </Tag>
                  </Row>
                  <Progress
                    percent={pct}
                    status={isOver ? 'exception' : 'active'}
                    strokeColor={isOver ? colors.error[500] : colors.warning[500]}
                    format={() =>
                      `${formatCost(alert.currentSpend)} / ${formatCost(alert.limit)}`
                    }
                  />
                </Space>
              </Card>
            </Col>
          );
        })}
      </Row>
    </Card>
  );
};
