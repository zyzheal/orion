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
    <Card
      size="small"
      className="orion-card"
      title="近期活动"
      loading={loading}
      role="region"
      aria-label="近期活动"
      aria-busy={loading}
    >
      {displayItems.length === 0 ? (
        // S1-17 P0-5: 空态使用 aria-live="polite"，屏幕阅读器在状态变化时静默播报
        <div aria-live="polite" aria-atomic="true">
          <Empty description="暂无活动" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        </div>
      ) : (
        <div role="list" aria-label="近期活动列表">
          <List
            dataSource={displayItems}
            renderItem={(item) => (
              <TriageItemRow item={item} onAction={onItemAction} />
            )}
          />
        </div>
      )}
    </Card>
  );
};

export default RecentActivityFeed;
