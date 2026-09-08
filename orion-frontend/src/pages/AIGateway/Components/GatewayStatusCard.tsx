/**
 * GatewayStatusCard - 网关状态卡片
 * 抽取自 index.tsx (P2-9 Phase 219)
 */
import { Card, Space, Tag, Typography } from 'antd';
import { spacing } from '@/tokens';

const { Text } = Typography;

interface Props {
  gatewayStatus: { status: string } | null;
  engineStatus: { cacheEnabled: boolean; auditEnabled: boolean } | null;
}

export const GatewayStatusCard = ({ gatewayStatus, engineStatus }: Props) => (
  <Card title="网关状态" style={{ marginTop: spacing.lg, gridColumn: '1 / -1' }}>
    <Space size="large">
      <div>
        <Text type="secondary">网关状态:</Text>{' '}
        <Tag color={gatewayStatus?.status === 'healthy' ? 'green' : 'red'}>
          {gatewayStatus?.status || '未知'}
        </Tag>
      </div>
      <div>
        <Text type="secondary">缓存:</Text>{' '}
        <Tag color={engineStatus?.cacheEnabled ? 'green' : 'default'}>
          {engineStatus?.cacheEnabled ? '启用' : '禁用'}
        </Tag>
      </div>
      <div>
        <Text type="secondary">审计:</Text>{' '}
        <Tag color={engineStatus?.auditEnabled ? 'green' : 'default'}>
          {engineStatus?.auditEnabled ? '启用' : '禁用'}
        </Tag>
      </div>
    </Space>
  </Card>
);
