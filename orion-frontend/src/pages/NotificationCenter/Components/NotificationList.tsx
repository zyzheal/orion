/**
 * NotificationList - 通知列表 (List with renderItem)
 * 抽取自 index.tsx (P2-9 Phase 121)
 */
import React from 'react';
import { List } from 'antd';
import type { NotificationCenterState } from '../useNotificationCenterState';

interface NotificationListProps {
  state: NotificationCenterState;
}

export const NotificationList: React.FC<NotificationListProps> = ({ state }) => {
  const { notifications, loading, NotificationListRenderer, renderEmptyState } = state;

  return (
    <List
      dataSource={notifications}
      loading={loading}
      renderItem={(item) => {
        const Item = NotificationListRenderer;
        return <Item item={item} />;
      }}
      locale={{ emptyText: renderEmptyState() }}
    />
  );
};
