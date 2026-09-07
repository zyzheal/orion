/**
 * NotificationCenter Page
 * - Top stats row: Unread count, Critical alerts, Today's notifications, This week's total
 * - Tab navigation: All | Unread | Tickets | System | Read
 * - Notification list with expandable content, priority indicators, type icons
 * - Mark all as read, Clear read notifications actions
 * - Empty state for no notifications
 * - Admin broadcast modal (broadcast messages to multiple users)
 * - User notification settings drawer (toggle notification preferences)
 *
 * P2-9 Phase 121 拆分:
 * - useNotificationCenterState.tsx  状态 hook (20 useState + Form.useForm + 2 loaders + 10 handlers)
 * - Components/NotificationCenterHeader.tsx  头部标题 + 4 操作按钮
 * - Components/PaginationBar.tsx  分页栏 (top/bottom 双位置)
 * - Components/NotificationList.tsx  通知列表 List renderItem
 * - 保留: columns.tsx / config.ts / NotificationCenterModals.tsx / types.ts
 */
import React from 'react';
import { Tabs } from 'antd';
import { spacing } from '@/tokens';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';
import { tabDefinitions } from './config';
import { NotificationStatsRow, BroadcastModal, NotificationSettingsDrawer } from './NotificationCenterModals';
import { useNotificationCenterState } from './useNotificationCenterState';
import { NotificationCenterHeader } from './Components/NotificationCenterHeader';
import { PaginationBar } from './Components/PaginationBar';
import { NotificationList } from './Components/NotificationList';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

const NotificationCenter: React.FC = () => {
  const state = useNotificationCenterState();
  const {
    stats,
    activeTab,
    handleTabChange,
    isAdmin,
    broadcastModalVisible,
    setBroadcastModalVisible,
    broadcastForm,
    broadcastAudience,
    setBroadcastAudience,
    selectedBroadcastUsers,
    setSelectedBroadcastUsers,
    availableUsers,
    usersLoading,
    broadcastSubmitting,
    handleBroadcastSubmit,
    settingsDrawerVisible,
    setSettingsDrawerVisible,
    settingsLoading,
    settingsSaving,
    notificationSettings,
    handleToggleSetting,
  } = state;

  return (
    <div>
      <NotificationCenterHeader state={state} />

      <NotificationStatsRow stats={stats} />

      <Tabs
        activeKey={activeTab}
        onChange={handleTabChange}
        items={tabDefinitions.map((tab) => ({
          key: tab.key,
          label: tab.label,
        }))}
        style={{ marginBottom: spacing.md }}
      />

      <PaginationBar state={state} position="top" />

      <NotificationList state={state} />

      <PaginationBar state={state} position="bottom" />

      {isAdmin() && (
        <BroadcastModal
          open={broadcastModalVisible}
          onClose={() => setBroadcastModalVisible(false)}
          form={broadcastForm}
          audience={broadcastAudience}
          onAudienceChange={setBroadcastAudience}
          selectedUsers={selectedBroadcastUsers}
          onSelectedUsersChange={setSelectedBroadcastUsers}
          availableUsers={availableUsers}
          usersLoading={usersLoading}
          submitLoading={broadcastSubmitting}
          onSubmit={handleBroadcastSubmit}
        />
      )}

      <NotificationSettingsDrawer
        open={settingsDrawerVisible}
        onClose={() => setSettingsDrawerVisible(false)}
        loading={settingsLoading}
        saving={settingsSaving}
        settings={notificationSettings}
        onToggle={handleToggleSetting}
      />
    </div>
  );
};

export default NotificationCenter;
