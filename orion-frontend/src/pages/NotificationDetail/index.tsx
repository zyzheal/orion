import React from 'react';
import { Button, Empty, Spin } from 'antd';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';
import { useNotificationDetailState } from './useNotificationDetailState';
import { PageHeader } from './Components/PageHeader';
import { NotificationCard } from './Components/NotificationCard';
import { typeIconMap } from './constants';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

const NotificationDetail: React.FC = () => {
  const { notification, loading, navigate, actionLoading, handleMarkAsRead, handleDelete } = useNotificationDetailState();

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!notification) {
    return (
      <Empty description="通知不存在" style={{ padding: '48px 0' }}>
        <Button type="primary" onClick={() => navigate('/notifications')}>
          返回通知列表
        </Button>
      </Empty>
    );
  }

  const typeIcon = typeIconMap[notification.type] || null;

  return (
    <div>
      <PageHeader
        typeIcon={typeIcon}
        notification={notification}
        actionLoading={actionLoading}
        onBack={() => navigate('/notifications')}
        onMarkAsRead={handleMarkAsRead}
        onDelete={handleDelete}
      />
      <NotificationCard notification={notification} />
    </div>
  );
};

export default NotificationDetail;
