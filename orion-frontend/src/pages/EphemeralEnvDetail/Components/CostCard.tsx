/**
 * CostCard - 成本信息卡片
 * 抽取自 index.tsx (P2-9 Phase 115)
 */
import React from 'react';
import { Card, Button, Descriptions, Space, Typography } from 'antd';
import { DollarOutlined, ReloadOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import type { EphemeralEnvDetailState } from '../useEphemeralEnvDetailState';

const { Text } = Typography;

interface CostCardProps {
  state: EphemeralEnvDetailState;
}

export const CostCard: React.FC<CostCardProps> = ({ state }) => {
  const { cost, costLoading, id, loadCost } = state;

  return (
    <Card
      title={
        <Space>
          <DollarOutlined />
          成本信息
        </Space>
      }
      size="small"
      extra={
        <Button
          size="small"
          icon={<ReloadOutlined />}
          onClick={() => id && loadCost(id)}
          loading={costLoading}
        >
          刷新成本
        </Button>
      }
    >
      {cost ? (
        <div>
          <Descriptions column={4} size="small" bordered>
            <Descriptions.Item label="CPU 成本">
              <Text strong>{cost.cpuCost.toFixed(2)}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="内存成本">
              <Text strong>{cost.memoryCost.toFixed(2)}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="存储成本">
              <Text strong>{cost.storageCost.toFixed(2)}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="网络成本">
              <Text strong>{cost.networkCost.toFixed(2)}</Text>
            </Descriptions.Item>
          </Descriptions>
          <div
            style={{
              marginTop: spacing.md,
              padding: spacing[3],
              background: colors.success[50],
              borderRadius: 6,
              textAlign: 'center',
              border: `1px solid ${colors.success[200]}`,
            }}
          >
            <Text type="secondary" style={{ fontSize: spacing[3] }}>
              总成本
            </Text>
            <br />
            <Text strong style={{ fontSize: spacing[5], color: colors.success[500] }}>
              {cost.totalCost.toFixed(2)} {cost.currency}
            </Text>
          </div>
        </div>
      ) : (
        <Text type="secondary">点击"刷新成本"查看成本数据</Text>
      )}
    </Card>
  );
};
