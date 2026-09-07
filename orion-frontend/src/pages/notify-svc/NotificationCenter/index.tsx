/**
 * NotificationCenter Page — 通知中心
 * - Top stats row: Unread count, Critical alerts, Today's notifications, This week's total
 * - Tab navigation: All | Unread | Tickets | System | Read
 * - Notification list with expandable content, priority indicators, type icons
 * - Mark all as read, Clear read notifications actions
 * - Empty state for no notifications
 * - Admin broadcast modal (broadcast messages to multiple users)
 * - User notification settings drawer (toggle notification preferences)
 *
 * 拆分结构 (P2-9 Phase 159):
 * - constants.tsx: NotificationItem 类型 + 静态配置 (typeIconMap/typeLabelMap/priorityConfig/tabDefinitions)
 * - useNotificationCenterState.ts: 20+ state + 4 loaders + 12 handlers
 * - StatsRow.tsx: 顶部 4 张统计卡片
 * - NotificationItemRow.tsx: 单条通知项渲染
 * - Components/PageHeader.tsx: 页头 + 4 个操作按钮
 * - Components/TabNavigation.tsx: Tabs 分类
 * - Components/PaginationBar.tsx: 顶/底分页
 * - Components/NotificationList.tsx: 列表 + 空状态
 * - Components/BroadcastModal.tsx: 广播模态框 (admin only)
 * - Components/SettingsDrawer.tsx: 通知设置抽屉
 */
import React from 'react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';
import { useNotificationCenterState } from './useNotificationCenterState';
import { StatsRow } from './StatsRow';
import { PageHeader } from './Components/PageHeader';
import { TabNavigation } from './Components/TabNavigation';
import { PaginationBar } from './Components/PaginationBar';
import { NotificationList } from './Components/NotificationList';
import { BroadcastModal } from './Components/BroadcastModal';
import { SettingsDrawer } from './Components/SettingsDrawer';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

const NotificationCenter: React.FC = () => {
  const state = useNotificationCenterState();
  const readCount = state.notifications.filter((n) => n.read).length;

  return (
    <div>
      <PageHeader
        notificationCount={state.notifications.length}
        isAdmin={state.isAdmin}
        unreadCount={state.stats.unread}
        readCount={readCount}
        onOpenBroadcast={state.openBroadcastModal}
        onOpenSettings={state.openSettingsDrawer}
        onMarkAllAsRead={state.handleMarkAllAsRead}
        onClearRead={state.handleClearRead}
      />

      <StatsRow stats={state.stats} />

      <TabNavigation activeKey={state.activeTab} onChange={state.handleTabChange} />

      <PaginationBar
        current={state.currentPage}
        total={state.total}
        pageSize={state.pageSize}
        onChange={state.handlePageChange}
        position="top"
      />

      <NotificationList
        notifications={state.notifications}
        loading={state.loading}
        expandedIds={state.expandedIds}
        onToggleExpand={state.toggleExpand}
        onMarkAsRead={state.handleMarkAsRead}
        onDelete={state.handleDelete}
      />

      <PaginationBar
        current={state.currentPage}
        total={state.total}
        pageSize={state.pageSize}
        onChange={state.handlePageChange}
        position="bottom"
      />

      <BroadcastModal
        open={state.broadcastModalVisible}
        form={state.broadcastForm}
        submitting={state.broadcastSubmitting}
        audience={state.broadcastAudience}
        selectedUsers={state.selectedBroadcastUsers}
        availableUsers={state.availableUsers}
        usersLoading={state.usersLoading}
        onOk={state.handleBroadcastSubmit}
        onCancel={() => state.setBroadcastModalVisible(false)}
        onAudienceChange={(val) => {
          state.setBroadcastAudience(val as 'all' | 'specific');
          if (val === 'all') state.setSelectedBroadcastUsers([]);
        }}
        onSelectedUsersChange={state.setSelectedBroadcastUsers}
      />

      <SettingsDrawer
        open={state.settingsDrawerVisible}
        loading={state.settingsLoading}
        settings={state.notificationSettings}
        saving={state.settingsSaving}
        onClose={() => state.setSettingsDrawerVisible(false)}
        onToggle={state.handleToggleSetting}
      />
    </div>
  );
};

export default NotificationCenter;
