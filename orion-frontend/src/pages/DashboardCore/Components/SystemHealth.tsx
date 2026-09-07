/**
 * Dashboard system health panel
 * 抽取自 index.tsx (P2-9 Phase 156)
 */
import { Space, Typography } from 'antd';
import { spacing, themeVars } from '@/tokens';
import CardPanel from '@/components/CardPanel';
import StatusBadge from '@/components/StatusBadge';
import { DEFAULT_SYSTEM_HEALTH } from '../constants';
import type { SystemHealthItem } from '../types';

const { Text } = Typography;

interface SystemHealthProps {
  items: SystemHealthItem[];
}

export const SystemHealth = ({ items }: SystemHealthProps) => {
  const displayItems = items.length > 0 ? items : DEFAULT_SYSTEM_HEALTH;
  return (
    <CardPanel title="系统健康">
      <Space direction="vertical" style={{ width: '100%' }} size={12}>
        {displayItems.map((item) => (
          <div
            key={item.name}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px 0',
              borderBottom: `1px solid ${themeVars.borderLight}`,
            }}
          >
            <Space>
              <StatusBadge
                status={item.status as 'success' | 'warning' | 'unknown'}
                size="small"
                showDot={false}
                variant="subtle"
              />
              <Text>{item.name}</Text>
            </Space>
            <Text type="secondary" style={{ fontSize: spacing[3] }}>
              {item.latency}
            </Text>
          </div>
        ))}
      </Space>
    </CardPanel>
  );
};
