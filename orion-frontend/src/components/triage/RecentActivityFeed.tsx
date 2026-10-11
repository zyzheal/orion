import React from 'react';
import { Card, List, Empty } from 'antd';
import type { TriageItem } from '../../api/triage';
import { TriageItemRow } from './TriageItemRow';

interface Props {
  items: TriageItem[];
  loading?: boolean;
  limit?: number;
  onItemAction?: (item: TriageItem, action: 'acknowledge' | 'assign') => void;
}

export const RecentActivityFeed: React.FC<Props> = ({ items, loading, limit = 20, onItemAction }) => {
  const displayItems = items?.slice(0, limit) ?? [];

  return (
    <Card size="small" className="orion-card" title="近期活动" loading={loading}>
      {displayItems.length === 0 ? (
        <Empty description="暂无活动" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <List
          dataSource={displayItems}
          renderItem={(item) => (
            <TriageItemRow item={item} onAction={onItemAction} />
          )}
        />
      )}
    </Card>
  );
};

export default RecentActivityFeed;
