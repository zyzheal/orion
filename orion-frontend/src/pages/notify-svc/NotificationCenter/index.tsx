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
 * 拆分结构:
 * - constants.tsx: NotificationItem 类型 + 静态配置 (typeIconMap/typeLabelMap/priorityConfig/tabDefinitions)
 * - useNotificationCenterState.ts: 20+ state + 4 loaders + 12 handlers
 * - StatsRow.tsx: 顶部 4 张统计卡片
 * - NotificationItemRow.tsx: 单条通知项渲染
 */
import React from 'react';
import {
  Typography,
  Button,
  Tabs,
  List,
  Space,
  Empty,
  Popconfirm,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  Drawer,
  Divider,
  Spin,
  Pagination,
} from 'antd';
import { colors, spacing } from '@/tokens';
import {
  BellOutlined,
  CheckOutlined,
  ClearOutlined,
  SoundOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';
import { tabDefinitions } from './constants';
import { useNotificationCenterState } from './useNotificationCenterState';
import { StatsRow } from './StatsRow';
import { NotificationItemRow } from './NotificationItemRow';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

const { Title, Text } = Typography;

const NotificationCenter: React.FC = () => {
  const {
    notifications,
    loading,
    activeTab,
    expandedIds,
    stats,
    currentPage,
    pageSize,
    total,
    broadcastModalVisible,
    broadcastForm,
    broadcastSubmitting,
    broadcastAudience,
    selectedBroadcastUsers,
    availableUsers,
    usersLoading,
    settingsDrawerVisible,
    notificationSettings,
    settingsLoading,
    settingsSaving,
    isAdmin,
    toggleExpand,
    handleMarkAsRead,
    handleMarkAllAsRead,
    handleDelete,
    handleClearRead,
    openBroadcastModal,
    handleBroadcastSubmit,
    openSettingsDrawer,
    handleToggleSetting,
    handleTabChange,
    handlePageChange,
    setBroadcastModalVisible,
    setBroadcastAudience,
    setSelectedBroadcastUsers,
    setSettingsDrawerVisible,
  } = useNotificationCenterState();

  return (
    <div>
      {/* Page header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: spacing.lg,
        }}
      >
        <div>
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <BellOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            通知中心
          </Title>
          <Text type="secondary">共 {notifications.length} 条通知</Text>
        </div>
        <Space>
          {isAdmin() && (
            <Button icon={<SoundOutlined />} onClick={openBroadcastModal}>
              广播通知
            </Button>
          )}
          <Button icon={<SettingOutlined />} onClick={openSettingsDrawer}>
            通知设置
          </Button>
          <Button
            type="primary"
            ghost
            icon={<CheckOutlined />}
            onClick={handleMarkAllAsRead}
            disabled={stats.unread === 0}
          >
            全部已读
          </Button>
          <Popconfirm
            title="确定清除所有已读通知？"
            onConfirm={handleClearRead}
            okText="确定"
            cancelText="取消"
          >
            <Button
              icon={<ClearOutlined />}
              disabled={notifications.filter((n) => n.read).length === 0}
            >
              清除已读
            </Button>
          </Popconfirm>
        </Space>
      </div>

      {/* Stats row */}
      <StatsRow stats={stats} />

      {/* Tab navigation */}
      <Tabs
        activeKey={activeTab}
        onChange={handleTabChange}
        items={tabDefinitions.map((tab) => ({
          key: tab.key,
          label: tab.label,
        }))}
        style={{ marginBottom: spacing.md }}
      />

      {/* Pagination - Top */}
      {total > 0 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: spacing.md,
            padding: '8px 12px',
            background: colors.neutral[50],
            borderRadius: 8,
          }}
        >
          <span style={{ fontSize: 13, color: colors.neutral[600] }}>
            共 {total} 条通知，每页 {pageSize} 条
          </span>
          <Pagination
            current={currentPage}
            total={total}
            pageSize={pageSize}
            showSizeChanger
            showQuickJumper
            pageSizeOptions={['10', '20', '50', '100']}
            onChange={handlePageChange}
            onShowSizeChange={handlePageChange}
            size="small"
          />
        </div>
      )}

      {/* Notification list */}
      <List
        dataSource={notifications}
        loading={loading}
        renderItem={(item) => (
          <NotificationItemRow
            item={item}
            isExpanded={expandedIds.has(item.id)}
            onToggleExpand={toggleExpand}
            onMarkAsRead={handleMarkAsRead}
            onDelete={handleDelete}
          />
        )}
        locale={{
          emptyText: (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无通知" style={{ padding: '48px 0' }} />
          ),
        }}
      />

      {/* Pagination - Bottom */}
      {total > 0 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            marginTop: spacing.lg,
            marginBottom: spacing.md,
            padding: '16px 0',
            borderTop: '1px solid colors.neutral[200]',
          }}
        >
          <Pagination
            current={currentPage}
            total={total}
            pageSize={pageSize}
            showSizeChanger
            showQuickJumper
            pageSizeOptions={['10', '20', '50', '100']}
            showTotal={(t) => `共 ${t} 条通知`}
            onChange={handlePageChange}
            onShowSizeChange={handlePageChange}
          />
        </div>
      )}

      {/* Broadcast Modal (admin only) */}
      <Modal
        title={
          <Space>
            <SoundOutlined /> 广播通知
          </Space>
        }
        open={broadcastModalVisible}
        onCancel={() => setBroadcastModalVisible(false)}
        onOk={handleBroadcastSubmit}
        confirmLoading={broadcastSubmitting}
        width={560}
        destroyOnClose
      >
        <Form form={broadcastForm} layout="vertical" style={{ marginTop: spacing.md }}>
          <Form.Item
            name="title"
            label="标题"
            rules={[{ required: true, message: '请输入广播标题' }]}
          >
            <Input placeholder="如: 系统维护通知" />
          </Form.Item>
          <Form.Item
            name="message"
            label="消息内容"
            rules={[{ required: true, message: '请输入消息内容' }]}
          >
            <Input.TextArea rows={4} placeholder="请输入广播消息内容..." />
          </Form.Item>
          <Form.Item label="目标受众" initialValue="all">
            <Select
              value={broadcastAudience}
              onChange={(val) => {
                setBroadcastAudience(val);
                if (val === 'all') setSelectedBroadcastUsers([]);
              }}
              options={[
                { label: '全体用户', value: 'all' },
                { label: '指定用户', value: 'specific' },
              ]}
            />
          </Form.Item>
          {broadcastAudience === 'specific' && (
            <Form.Item label="选择用户">
              <Select
                mode="multiple"
                loading={usersLoading}
                value={selectedBroadcastUsers}
                onChange={setSelectedBroadcastUsers}
                options={availableUsers.map((u) => ({
                  label: u.name || u.username,
                  value: u.id,
                }))}
                placeholder="搜索并选择用户"
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
              />
            </Form.Item>
          )}
          <Form.Item name="priority" label="优先级" initialValue="medium">
            <Select
              options={[
                { label: '紧急', value: 'critical' },
                { label: '高', value: 'high' },
                { label: '中', value: 'medium' },
                { label: '低', value: 'low' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Notification Settings Drawer */}
      <Drawer
        title={
          <Space>
            <SettingOutlined /> 通知设置
          </Space>
        }
        open={settingsDrawerVisible}
        onClose={() => setSettingsDrawerVisible(false)}
        width={480}
        destroyOnClose
      >
        {settingsLoading ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <Spin size="large" />
          </div>
        ) : notificationSettings ? (
          <div>
            {/* Channel Settings */}
            <Title level={5}>通知渠道</Title>
            <div style={{ marginBottom: spacing.md }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: spacing[3],
                }}
              >
                <Text>邮件通知</Text>
                <Switch
                  checked={notificationSettings.emailEnabled}
                  onChange={() => handleToggleSetting('emailEnabled')}
                  loading={settingsSaving}
                />
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: spacing[3],
                }}
              >
                <Text>声音提醒</Text>
                <Switch
                  checked={notificationSettings.soundEnabled}
                  onChange={() => handleToggleSetting('soundEnabled')}
                  loading={settingsSaving}
                />
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: spacing[3],
                }}
              >
                <Text>桌面推送</Text>
                <Switch
                  checked={notificationSettings.desktopEnabled}
                  onChange={() => handleToggleSetting('desktopEnabled')}
                  loading={settingsSaving}
                />
              </div>
            </div>

            <Divider />

            {/* Event Type Settings */}
            <Title level={5}>通知类型</Title>
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: spacing[3],
                }}
              >
                <Text>工单分配</Text>
                <Switch
                  checked={notificationSettings.ticketAssigned}
                  onChange={() => handleToggleSetting('ticketAssigned')}
                  loading={settingsSaving}
                />
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: spacing[3],
                }}
              >
                <Text>工单升级</Text>
                <Switch
                  checked={notificationSettings.ticketEscalated}
                  onChange={() => handleToggleSetting('ticketEscalated')}
                  loading={settingsSaving}
                />
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: spacing[3],
                }}
              >
                <Text>SLA 警告</Text>
                <Switch
                  checked={notificationSettings.slaWarning}
                  onChange={() => handleToggleSetting('slaWarning')}
                  loading={settingsSaving}
                />
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: spacing[3],
                }}
              >
                <Text>SLA 违约</Text>
                <Switch
                  checked={notificationSettings.slaBreached}
                  onChange={() => handleToggleSetting('slaBreached')}
                  loading={settingsSaving}
                />
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: spacing[3],
                }}
              >
                <Text>Pipeline 完成</Text>
                <Switch
                  checked={notificationSettings.pipelineCompleted}
                  onChange={() => handleToggleSetting('pipelineCompleted')}
                  loading={settingsSaving}
                />
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: spacing[3],
                }}
              >
                <Text>系统告警</Text>
                <Switch
                  checked={notificationSettings.systemAlert}
                  onChange={() => handleToggleSetting('systemAlert')}
                  loading={settingsSaving}
                />
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: spacing[3],
                }}
              >
                <Text>评论提及</Text>
                <Switch
                  checked={notificationSettings.commentMention}
                  onChange={() => handleToggleSetting('commentMention')}
                  loading={settingsSaving}
                />
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: spacing[3],
                }}
              >
                <Text>转派请求</Text>
                <Switch
                  checked={notificationSettings.transferRequest}
                  onChange={() => handleToggleSetting('transferRequest')}
                  loading={settingsSaving}
                />
              </div>
            </div>
          </div>
        ) : (
          <Empty description="无法加载通知设置" />
        )}
      </Drawer>
    </div>
  );
};

export default NotificationCenter;
