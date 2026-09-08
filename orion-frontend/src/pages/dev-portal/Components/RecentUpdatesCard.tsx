/**
 * RecentUpdatesCard.tsx - 最近更新组件列表
 * 抽取自 index.tsx (P2-9 Phase 241)
 */
import { Card, List, Progress, Typography } from 'antd';
import { spacing } from '@/tokens';
import type { ServiceComponent } from '../useDevPortalState';

const { Text } = Typography;

interface Props {
  components: ServiceComponent[];
  limit?: number;
}

export function RecentUpdatesCard({ components, limit = 5 }: Props) {
  const recent = components.slice(0, limit);

  return (
    <Card title="最近更新" style={{ marginTop: spacing.md }}>
      <List
        itemLayout="horizontal"
        dataSource={recent}
        renderItem={(item) => (
          <List.Item>
            <List.Item.Meta
              title={<Text strong>{item.name}</Text>}
              description={
                <Text type="secondary">{item.owner} · {item.language} · 更新于 {item.lastDeployed}</Text>
              }
            />
            <Progress type="circle" size={36} percent={item.health} format={() => `${item.health}`} />
          </List.Item>
        )}
      />
    </Card>
  );
}
