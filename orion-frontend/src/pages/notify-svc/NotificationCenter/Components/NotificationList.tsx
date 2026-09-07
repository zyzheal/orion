/**
 * NotificationCenter notification list
 * 抽取自 index.tsx (P2-9 Phase 159)
 */
import { Empty, List } from 'antd';
import { NotificationItemRow } from '../NotificationItemRow';
import type { NotificationItem } from '../constants';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  priority: string;
  read: boolean;
  createdAt: string;
  [key: string]: unknown;
}

interface NotificationListProps {
  notifications: NotificationItem[];
  loading: boolean;
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string) => void;
}

export const NotificationList = ({
  notifications,
  loading,
  expandedIds,
  onToggleExpand,
  onMarkAsRead,
  onDelete,
}: NotificationListProps) => (
  <List
    dataSource={notifications}
    loading={loading}
    renderItem={(item) => (
      <NotificationItemRow
        item={item}
        isExpanded={expandedIds.has(item.id)}
        onToggleExpand={onToggleExpand}
        onMarkAsRead={onMarkAsRead}
        onDelete={onDelete}
      />
    )}
    locale={{
      emptyText: (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无通知" style={{ padding: '48px 0' }} />
      ),
    }}
  />
);
